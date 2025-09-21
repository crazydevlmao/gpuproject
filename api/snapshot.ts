// api/snapshot.ts — Vercel Edge Function with retry/backoff + 60s CDN cache
// api/snapshot.ts
export const config = {
  runtime: 'edge',
  regions: ['iad1'], // pick ONE region (e.g. 'iad1' US-East)
};


const HELIUS_API_KEY = process.env.HELIUS_API_KEY as string;
if (!HELIUS_API_KEY) {
  // Vercel will still build, but the function will return 500 until you set the env var
  console.warn("[snapshot] HELIUS_API_KEY is not set");
}

// === keep these in sync with your UI labels ===
const TRACKED_MINT = "8GftvtSGMyk15hJFfc9bESxhVbPJtLGdT4ztyGZapump";
const SOL_WALLET = "BJQ2F2Rjegd345Ti6f1Pg5GwXQJ7aspZCGFXvEPjsae";
const EPOCH_REWARDS_WALLET = "CxU4DH2fY11MR5ZyWUG1AJzpqzP824zVyBnoxiJggPMg";
const PUMPFUN_AMM_WALLET = "pvJzn1Xpbfsu6e7gaSnVGPZAwLRP9dLAjSxrzbGtUAU";
const TOKENS_PER_GPU = 1_000_000;
// ===============================================

// Use mainnet by default. If your token is on devnet, switch the host below.
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Cache longer to reduce calls per region
const S_MAXAGE = 60; // seconds
const STALE_WHILE_REVALIDATE = 30;

class RetryableError extends Error {}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rpc(method: string, params: any[], attempts = 5) {
  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(HELIUS_RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
      });
      const txt = await r.text();
      const json = txt ? JSON.parse(txt) : {};

      if (!r.ok || json?.error) {
        const msg = json?.error?.message || `HTTP ${r.status}`;
        // Treat 429 and 5xx as retryable
        if (r.status === 429 || r.status >= 500 || /rate ?limit/i.test(msg) || /Too Many/i.test(msg)) {
          throw new RetryableError(msg);
        }
        throw new Error(msg);
      }
      return json;
    } catch (e: any) {
      lastErr = e;
      const retryable = e instanceof RetryableError;
      if (!retryable || i === attempts - 1) break;
      // Exponential backoff with jitter
      const wait = 300 * (i + 1) + Math.random() * 250;
      await sleep(wait);
    }
  }
  throw lastErr;
}

function coerceGPAList(j: any): any[] {
  if (Array.isArray(j?.result)) return j.result;
  if (Array.isArray(j?.result?.value)) return j.result.value;
  return [];
}

function toSOL(lamports: number) {
  return (Number(lamports) || 0) / 1e9;
}

async function getBalanceSOL(pubkey: string): Promise<number> {
  // Sequential + retry keeps us gentle on the RPC
  const j = await rpc("getBalance", [pubkey], 5);
  const lamports = Number(j?.result?.value ?? j?.result ?? 0);
  return Number.isFinite(lamports) ? lamports / 1e9 : 0;
}

async function getHolders(mint: string) {
  // We run the two GPA calls one after the other (not in parallel) to avoid burst limits.
  async function byProgram(programId: string, withDataSize: boolean) {
    const filters: any[] = [{ memcmp: { offset: 0, bytes: mint } }];
    if (withDataSize) filters.unshift({ dataSize: 165 }); // legacy SPL only
    const j = await rpc("getProgramAccounts", [
      programId,
      { encoding: "jsonParsed", commitment: "confirmed", filters },
    ]);
    const list = coerceGPAList(j);
    const out: Record<string, number> = {};
    for (const it of list) {
      const info = it?.account?.data?.parsed?.info;
      const owner = info?.owner;
      const amt = Number(info?.tokenAmount?.uiAmount ?? 0);
      if (!owner || !(amt > 0)) continue;
      out[owner] = (out[owner] ?? 0) + amt;
    }
    return out;
  }

  let merged: Record<string, number> = {};
  try {
    // legacy SPL
    const legacy = await byProgram("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", true);
    // token-2022
    const t22 = await byProgram("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCx2w6G3W", false);
    for (const m of [legacy, t22]) {
      for (const [k, v] of Object.entries(m)) merged[k] = (merged[k] ?? 0) + (v as number);
    }
  } catch (e) {
    // As a soft fallback on repeated rate limits, try largest accounts → owners mapping
    try {
      const largest = await rpc("getTokenLargestAccounts", [mint, { commitment: "confirmed" }], 5);
      const vals: any[] = Array.isArray(largest?.result?.value) ? largest.result.value : [];
      const accounts = vals.map((row) => ({ address: row.address, balance: Number(row.uiAmount ?? 0) }));
      const pubkeys = accounts.map((a) => a.address);
      if (pubkeys.length) {
        const multi = await rpc("getMultipleAccounts", [pubkeys, { encoding: "jsonParsed", commitment: "confirmed" }], 5);
        const infos: any[] = Array.isArray(multi?.result?.value) ? multi.result.value : [];
        const fallbackMerged: Record<string, number> = {};
        accounts.forEach((acc, i) => {
          const owner = infos[i]?.data?.parsed?.info?.owner ?? null;
          if (!owner) return;
          fallbackMerged[owner] = (fallbackMerged[owner] ?? 0) + Number(acc.balance ?? 0);
        });
        merged = fallbackMerged;
      }
    } catch {
      // give up; return whatever we have (possibly empty)
      merged = {};
    }
  }

  return Object.entries(merged)
    .filter(([addr, bal]) => addr !== PUMPFUN_AMM_WALLET && (bal as number) > 0)
    .map(([address, balance]) => ({ address, balance: Number(balance), gpus: Math.floor(Number(balance) / TOKENS_PER_GPU) }))
    .sort((a, b) => b.balance - a.balance);
}

async function getEpochCountdown() {
  let info: any;
  try {
    info = await rpc("getEpochInfo", [{ commitment: "finalized" }], 5);
  } catch {
    info = await rpc("getEpochInfo", [], 5);
  }
  const r = info?.result || {};
  const slotIndex = Number(r.slotIndex ?? 0);
  const slotsInEpoch = Number(r.slotsInEpoch ?? 0);
  const slotsRemaining = Math.max(0, slotsInEpoch - slotIndex);

  let samples: any;
  try {
    samples = await rpc("getRecentPerformanceSamples", [1], 5);
  } catch {
    samples = null;
  }
  let avgSlotMs = 400;
  const s0 = samples?.result?.[0];
  if (s0 && Number(s0.numSlots) && Number(s0.samplePeriodSecs)) {
    avgSlotMs = (Number(s0.samplePeriodSecs) / Number(s0.numSlots)) * 1000;
  }
  const totalMs = Math.max(1, Math.round(slotsInEpoch * avgSlotMs));
  const remainingMs = Math.max(0, Math.round(slotsRemaining * avgSlotMs));
  return { totalMs, remainingMs };
}

export default async function handler(req: Request) {
  if (!HELIUS_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing HELIUS_API_KEY" }), { status: 500 });
  }

  // Optional: allow ?mint=... to test different mints without redeploy
  const url = new URL(req.url);
  const mintParam = url.searchParams.get("mint")?.trim();
  const MINT =
    mintParam && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mintParam) ? mintParam : TRACKED_MINT;

  try {
    // Run sequentially to avoid bursty 429s; balances can be quick but still keep it gentle
    const holders = await getHolders(MINT);
    const gpuRewardsSol = await getBalanceSOL(SOL_WALLET);
    const epochRewardsSol = await getBalanceSOL(EPOCH_REWARDS_WALLET);
    const epoch = await getEpochCountdown();

    const payload = {
      updatedAt: new Date().toISOString(),
      holders,
      gpuRewardsSol,
      epochRewardsSol,
      epoch,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=0, s-maxage=${S_MAXAGE}, stale-while-revalidate=${STALE_WHILE_REVALIDATE}`,
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "snapshot failed" }), {
      status: 500,
      headers: {
        "Cache-Control": "no-store", // don't cache failures
      },
    });
  }
}










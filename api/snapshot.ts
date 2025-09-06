// api/snapshot.ts — Vercel Edge Function with 30s CDN cache
export const config = { runtime: "edge" };

const HELIUS_API_KEY = process.env.HELIUS_API_KEY as string;

// === keep these in sync with your UI labels ===
const TRACKED_MINT = "HUz9dMkUd1TiDzpm9nwkiQDUgUp9gazuVF59DyAjpump";
const SOL_WALLET = "85rjKGRFu9emw1Jyue3BfuJd3m8mqbhZQKrK7Gwfk7Jq";
const EPOCH_REWARDS_WALLET = "Ch8xxccjR5iYVwDrNmFdCt3tSX4VaVKfjAqMsoMNRmfv";
const PUMPFUN_AMM_WALLET = "GXz5QGRpugxBZ7V9S9YiJ27K5Zt7TqizqvrjZRVegeU5";
const TOKENS_PER_GPU = 1_000_000;
// ===============================================

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// --- helpers ---
function normalizeMint(input: string): string {
  const m = input.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  return m ? m[0] : input;
}

async function rpc(method: string, params: any[]) {
  const r = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
  });
  const txt = await r.text();
  const json = txt ? JSON.parse(txt) : {};
  if (!r.ok || json.error) throw new Error(json?.error?.message || `HTTP ${r.status}`);
  return json;
}

function coerceGPAList(j: any): any[] {
  if (Array.isArray(j?.result)) return j.result;
  if (Array.isArray(j?.result?.value)) return j.result.value;
  return [];
}

async function getBalanceSOL(pubkey: string): Promise<number> {
  const j = await rpc("getBalance", [pubkey]);
  const lamports = Number(j?.result?.value ?? j?.result ?? 0);
  return Number.isFinite(lamports) ? lamports / 1e9 : 0;
}

async function getHolders() {
  const mint = normalizeMint(TRACKED_MINT);

  // 1) Try direct owner aggregation via getProgramAccounts (legacy + token22)
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
    const [legacy, t22] = await Promise.all([
      byProgram("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", true),
      byProgram("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCx2w6G3W", false),
    ]);
    for (const m of [legacy, t22]) for (const [k, v] of Object.entries(m)) merged[k] = (merged[k] ?? 0) + (v as number);
  } catch {
    merged = {};
  }

  let entries = Object.entries(merged);

  // 2) Fallback if empty: largest token accounts -> resolve owner pubkeys
  if (entries.length === 0) {
    try {
      const largest = await rpc("getTokenLargestAccounts", [mint, { commitment: "confirmed" }]);
      const vals: any[] = Array.isArray(largest?.result?.value) ? largest.result.value : [];
      const accounts = vals
        .map((row) => ({ address: row.address, amount: Number(row.uiAmount ?? 0) }))
        .filter((r) => r.amount > 0);

      const pubkeys = accounts.map((a) => a.address);
      if (pubkeys.length) {
        const multi = await rpc("getMultipleAccounts", [
          pubkeys,
          { encoding: "jsonParsed", commitment: "confirmed" },
        ]);
        const infos: any[] = Array.isArray(multi?.result?.value) ? multi.result.value : [];
        const fallbackMerged: Record<string, number> = {};
        accounts.forEach((acc, i) => {
          const owner = infos[i]?.data?.parsed?.info?.owner ?? null;
          if (!owner) return;
          fallbackMerged[owner] = (fallbackMerged[owner] ?? 0) + acc.amount;
        });
        entries = Object.entries(fallbackMerged);
      }
    } catch {
      // keep empty
    }
  }

  const filtered = entries
    .filter(([addr, bal]) => addr !== PUMPFUN_AMM_WALLET && (bal as number) > 0)
    .map(([address, balance]) => ({ address, balance: Number(balance) }))
    .sort((a, b) => b.balance - a.balance);

  // add GPU count for convenience if you want
  return filtered.map((h) => ({ ...h, gpus: Math.floor(h.balance / TOKENS_PER_GPU) }));
}

async function getEpochCountdown() {
  let info: any;
  try {
    info = await rpc("getEpochInfo", [{ commitment: "finalized" }]);
  } catch {
    info = await rpc("getEpochInfo", []);
  }
  const r = info?.result || {};
  const slotIndex = Number(r.slotIndex ?? 0);
  const slotsInEpoch = Number(r.slotsInEpoch ?? 0);
  const slotsRemaining = Math.max(0, slotsInEpoch - slotIndex);

  let samples: any;
  try {
    samples = await rpc("getRecentPerformanceSamples", [1]);
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

export default async function handler() {
  if (!HELIUS_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing HELIUS_API_KEY" }), { status: 500 });
  }
  try {
    const [holders, gpuRewardsSol, epochRewardsSol, epoch] = await Promise.all([
      getHolders(),
      getBalanceSOL(SOL_WALLET),
      getBalanceSOL(EPOCH_REWARDS_WALLET),
      getEpochCountdown(),
    ]);
    const payload = { updatedAt: new Date().toISOString(), holders, gpuRewardsSol, epochRewardsSol, epoch };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        // CDN cache: one fresh render per ~30s per edge region
        "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=30",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "snapshot failed" }), { status: 500 });
  }
}

// api/snapshot.ts — Vercel Edge Function with 30s CDN cache (robust holders fetch)
export const config = { runtime: "edge" };

const HELIUS_API_KEY = process.env.HELIUS_API_KEY as string;

// === keep these in sync with your UI ===
const TRACKED_MINT = "HUz9dMkUd1TiDzpm9nwkiQDUgUp9gazuVF59DyAjpump";
const SOL_WALLET = "85rjKGRFu9emw1Jyue3BfuJd3m8mqbhZQKrK7Gwfk7Jq";
const EPOCH_REWARDS_WALLET = "Ch8xxccjR5iYVwDrNmFdCt3tSX4VaVKfjAqMsoMNRmfv";
const PUMPFUN_AMM_WALLET = "GXz5QGRpugxBZ7V9S9YiJ27K5Zt7TqizqvrjZRVegeU5";
const TOKENS_PER_GPU = 1_000_000;

const TOKEN_LEGACY = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022  = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCx2w6G3W";
// =======================================

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

function normMint(s: string) {
  const m = s.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  return m ? m[0] : s;
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

async function getBalanceSOL(pubkey: string): Promise<number> {
  const j = await rpc("getBalance", [pubkey]);
  const lamports = Number(j?.result?.value ?? j?.result ?? 0);
  return Number.isFinite(lamports) ? lamports / 1e9 : 0;
}

/* ---------- Holders (hybrid, robust) ---------- */

// A) Preferred: getTokenAccountsByMint (jsonParsed) for each program
async function tokenAccountsByMintParsed(programId: string, mint: string) {
  const j = await rpc("getTokenAccountsByMint", [
    mint,
    { programId, commitment: "confirmed", encoding: "jsonParsed" },
  ]);
  const arr: any[] = Array.isArray(j?.result?.value) ? j.result.value : [];
  const out: Record<string, number> = {};
  for (const row of arr) {
    const info = row?.account?.data?.parsed?.info;
    const owner = info?.owner;
    const amt = Number(info?.tokenAmount?.uiAmount ?? 0);
    if (!owner || !(amt > 0)) continue;
    out[owner] = (out[owner] ?? 0) + amt;
  }
  return out;
}

// B) Fallback: base64 GPA (only pubkeys) -> hydrate with getMultipleAccounts(jsonParsed)
async function listTokenAccountPubkeys(programId: string, withDataSize: boolean, mint: string): Promise<string[]> {
  const filters: any[] = [{ memcmp: { offset: 0, bytes: mint } }];
  if (withDataSize) filters.unshift({ dataSize: 165 }); // legacy only
  const j = await rpc("getProgramAccounts", [
    programId,
    { commitment: "confirmed", encoding: "base64", dataSlice: { offset: 0, length: 0 }, filters },
  ]);
  const arr: any[] = Array.isArray(j?.result) ? j.result : [];
  return arr.map((it: any) => String(it?.pubkey)).filter(Boolean);
}
async function hydrateOwners(pubkeys: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const CHUNK = 100;
  for (let i = 0; i < pubkeys.length; i += CHUNK) {
    const slice = pubkeys.slice(i, i + CHUNK);
    const j = await rpc("getMultipleAccounts", [slice, { encoding: "jsonParsed", commitment: "confirmed" }]);
    const vals: any[] = Array.isArray(j?.result?.value) ? j.result.value : [];
    for (const v of vals) {
      const info = v?.data?.parsed?.info;
      const owner = info?.owner;
      const amt = Number(info?.tokenAmount?.uiAmount ?? 0);
      if (!owner || !(amt > 0)) continue;
      out[owner] = (out[owner] ?? 0) + amt;
    }
  }
  return out;
}

async function getHolders() {
  const mint = normMint(TRACKED_MINT);

  // Try the simple/fast path first (both programs)
  let mapA: Record<string, number> = {};
  let mapB: Record<string, number> = {};
  let usedParsed = true;
  try { mapA = await tokenAccountsByMintParsed(TOKEN_LEGACY, mint); } catch { usedParsed = false; }
  try { mapB = await tokenAccountsByMintParsed(TOKEN_2022, mint); } catch { usedParsed = false; }

  let merged: Record<string, number> = {};
  if (usedParsed) {
    merged = { ...mapA };
    for (const [k, v] of Object.entries(mapB)) merged[k] = (merged[k] ?? 0) + (v as number);
  } else {
    // fallback route
    let legacyKeys: string[] = [];
    let t22Keys: string[] = [];
    try { legacyKeys = await listTokenAccountPubkeys(TOKEN_LEGACY, true, mint); } catch {}
    try { t22Keys    = await listTokenAccountPubkeys(TOKEN_2022, false, mint); } catch {}
    const keys = [...new Set([...legacyKeys, ...t22Keys])];
    if (keys.length === 0) return [];
    merged = await hydrateOwners(keys);
  }

  const entries = Object.entries(merged)
    .filter(([addr, bal]) => addr !== PUMPFUN_AMM_WALLET && (bal as number) > 0)
    .map(([address, balance]) => ({ address, balance: Number(balance) }))
    .sort((a, b) => b.balance - a.balance);

  // include gpus for convenience (UI ignores if not needed)
  return entries.map((h) => ({ ...h, gpus: Math.floor(h.balance / TOKENS_PER_GPU) }));
}

/* ---------- Epoch (unchanged) ---------- */
async function getEpochCountdown() {
  let info: any;
  try { info = await rpc("getEpochInfo", [{ commitment: "finalized" }]); }
  catch { info = await rpc("getEpochInfo", []); }
  const r = info?.result || {};
  const slotIndex = Number(r.slotIndex ?? 0);
  const slotsInEpoch = Number(r.slotsInEpoch ?? 0);
  const slotsRemaining = Math.max(0, slotsInEpoch - slotIndex);

  let samples: any;
  try { samples = await rpc("getRecentPerformanceSamples", [1]); }
  catch { samples = null; }
  let avgSlotMs = 400;
  const s0 = samples?.result?.[0];
  if (s0 && Number(s0.numSlots) && Number(s0.samplePeriodSecs)) {
    avgSlotMs = (Number(s0.samplePeriodSecs) / Number(s0.numSlots)) * 1000;
  }
  const totalMs = Math.max(1, Math.round(slotsInEpoch * avgSlotMs));
  const remainingMs = Math.max(0, Math.round(slotsRemaining * avgSlotMs));
  return { totalMs, remainingMs };
}

/* ---------- Handler ---------- */
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

    return new Response(JSON.stringify({
      updatedAt: new Date().toISOString(),
      holders, gpuRewardsSol, epochRewardsSol, epoch,
    }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=30",
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "snapshot failed" }), { status: 500 });
  }
}

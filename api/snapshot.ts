// api/snapshot.ts  — Vercel Edge Function with 30s CDN cache
export const config = { runtime: 'edge' };

const HELIUS_API_KEY = process.env.HELIUS_API_KEY as string;

// === keep these in sync with your UI labels ===
const TRACKED_MINT = 'HUz9dMkUd1TiDzpm9nwkiQDUgUp9gazuVF59DyAjpump';
const SOL_WALLET = '85rjKGRFu9emw1Jyue3BfuJd3m8mqbhZQKrK7Gwfk7Jq';
const EPOCH_REWARDS_WALLET = 'Ch8xxccjR5iYVwDrNmFdCt3tSX4VaVKfjAqMsoMNRmfv';
const PUMPFUN_AMM_WALLET = 'GXz5QGRpugxBZ7V9S9YiJ27K5Zt7TqizqvrjZRVegeU5';
const TOKENS_PER_GPU = 1_000_000;
// ===============================================

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

async function rpc(method: string, params: any[]) {
  const r = await fetch(HELIUS_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: method, method, params }),
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
  const j = await rpc('getBalance', [pubkey]);
  const lamports = Number(j?.result?.value ?? j?.result ?? 0);
  return Number.isFinite(lamports) ? lamports / 1e9 : 0;
}

async function getHolders() {
  const mint = TRACKED_MINT;

  async function byProgram(programId: string, withDataSize: boolean) {
    const filters: any[] = [{ memcmp: { offset: 0, bytes: mint } }];
    if (withDataSize) filters.unshift({ dataSize: 165 }); // legacy SPL only
    const j = await rpc('getProgramAccounts', [
      programId,
      { encoding: 'jsonParsed', commitment: 'confirmed', filters },
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
      byProgram('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', true),
      byProgram('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCx2w6G3W', false),
    ]);
    for (const m of [legacy, t22]) for (const [k, v] of Object.entries(m)) merged[k] = (merged[k] ?? 0) + (v as number);
  } catch { merged = {}; }

  const entries = Object.entries(merged)
    .filter(([addr, bal]) => addr !== PUMPFUN_AMM_WALLET && (bal as number) > 0)
    .map(([address, balance]) => ({ address, balance: Number(balance) }))
    .sort((a, b) => b.balance - a.balance);

  return entries.map(h => ({ ...h, gpus: Math.floor(h.balance / TOKENS_PER_GPU) }));
}

async function getEpochCountdown() {
  let info: any;
  try { info = await rpc('getEpochInfo', [{ commitment: 'finalized' }]); }
  catch { info = await rpc('getEpochInfo', []); }
  const r = info?.result || {};
  const slotIndex = Number(r.slotIndex ?? 0);
  const slotsInEpoch = Number(r.slotsInEpoch ?? 0);
  const slotsRemaining = Math.max(0, slotsInEpoch - slotIndex);

  let samples: any;
  try { samples = await rpc('getRecentPerformanceSamples', [1]); } catch { samples = null; }
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
    return new Response(JSON.stringify({ error: 'Missing HELIUS_API_KEY' }), { status: 500 });
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
        'content-type': 'application/json; charset=utf-8',
        // CDN cache: one fresh render per ~30s per edge region
        'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=30',
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'snapshot failed' }), { status: 500 });
  }
}

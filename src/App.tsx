import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

// ========================= THEME =========================
const GREEN = "#59d696";
const BG = "#0e0f11";
const CARD = "#17191d";
const GRID = "#1f232a";

// ========================= PROTOCOL CONSTANTS =========================
const TOKENS_PER_GPU = 1_000_000;
const TRACKED_MINT = "5FavEXMxHed7BNCrV1yRQKePS6QZ39BFRo4ssc38pump";

// ========================= EXCLUSIONS =========================
export const PUMPFUN_AMM_WALLET = "2WRdVS3tTha4ZxiC2YhQSqgw3zP5WHEhZ7Vbuf4hDze1"; // replace on deploy
const EXCLUDED_HOLDERS = new Set<string>([PUMPFUN_AMM_WALLET]);
export const isExcludedHolder = (addr: string) => EXCLUDED_HOLDERS.has(addr);

// ========================= HELPERS =========================
const nf = new Intl.NumberFormat("en-US");
export const toGPUs = (balance: number) => Math.floor(balance / TOKENS_PER_GPU);
export function normalizeMint(input: string): string {
  const match = input.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  return match ? match[0] : input;
}
// (dev tests use this)
function parseLamportsFromGetBalance(payload: any): number {
  const lamports = Number(payload?.result?.value ?? payload?.result ?? 0);
  return Number.isFinite(lamports) ? lamports : 0;
}

// ========================= HEADER (with X link) =========================
function Header() {
  return (
    <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center py-5">
      {/* Left: GPU */}
      <div className="flex items-center gap-3">
        <div
          className="text-sm tracking-[0.3em] uppercase select-none"
          style={{ color: GREEN, textShadow: `0 0 8px ${GREEN}aa, 0 0 18px ${GREEN}55` }}
        >
          GPU
        </div>
      </div>

      {/* Center: X link */}
      <a
        href="https://x.com/minesolgpu"
        target="_blank"
        rel="noopener noreferrer"
        className="justify-self-center group inline-flex items-center"
        aria-label="Open X (Twitter)"
        title="Open X (Twitter)"
      >
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border transition-transform group-hover:scale-105"
          style={{ background: CARD, borderColor: GRID, color: "#e5e7eb", boxShadow: `0 0 8px ${GREEN}44` }}
        >
          <span className="text-sm font-semibold leading-none" style={{ textShadow: `0 0 6px ${GREEN}55` }}>
            X
          </span>
        </span>
      </a>

      {/* Right: status */}
      <div className="flex items-center gap-2 justify-self-end text-xs text-gray-300">
        <div className="relative h-3 w-3">
          <span className="absolute inset-0 rounded-full" style={{ background: GREEN, opacity: 0.25 }} />
          <span className="absolute inset-0 rounded-full animate-ping" style={{ background: GREEN, opacity: 0.5 }} />
          <span className="absolute inset-0 rounded-full" style={{ background: GREEN }} />
        </div>
        <span className="opacity-80">All systems operational</span>
      </div>
    </div>
  );
}

// ========================= INFO CARDS =========================
function InfoCarousel() {
  const cards = [
    { t: "Mining rewards every 1800s", s: "Snapshot + distribution cycle." },
    { t: "1 GPU = 1,000,000 $GPU", s: "Hard cap: 1,000 GPUs circulating." },
    { t: "Direct deposit into your wallet", s: "No claiming process. Mining rewards sent to your GPUs." },
    { t: "100% of creator rewards", s: "100% of creator rewards are distributed to miners." },
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((x) => (x + 1) % cards.length), 4000);
    return () => clearInterval(id);
  }, [cards.length]);

  return (
    <div className="w-full flex justify-center mt-6">
      <div className="relative flex items-center justify-center">
        {/* neon baseline */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 z-0">
          <div className="h-[2px] w-full rounded-full" style={{ background: GREEN + "55", boxShadow: `0 0 10px ${GREEN}77, 0 0 24px ${GREEN}44` }} />
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 h-[4px] rounded-full"
            style={{ width: 140, background: `linear-gradient(90deg, transparent 0%, ${GREEN} 50%, transparent 100%)`, filter: "blur(0.5px)", boxShadow: `0 0 18px ${GREEN}, 0 0 30px ${GREEN}` }}
            animate={{ left: ["-140px", "calc(100% - 140px)"] }}
            transition={{ duration: 6.15, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 h-[4px] rounded-full"
            style={{ width: 140, background: `linear-gradient(90deg, transparent 0%, ${GREEN} 50%, transparent 100%)`, filter: "blur(0.5px)", boxShadow: `0 0 18px ${GREEN}, 0 0 30px ${GREEN}` }}
            animate={{ left: ["-140px", "calc(100% - 140px)"] }}
            transition={{ duration: 6.15, repeat: Infinity, ease: "linear", delay: 3.075 }}
          />
        </div>

        {/* cards */}
        <div className="relative z-10 flex gap-6 items-center">
          {cards.map((card, i) => {
            const active = i === idx;
            return (
              <motion.div
                key={i}
                className="relative px-5 py-4 rounded-2xl shadow-md max-w-[360px]"
                style={{ background: CARD, border: `1px solid ${GRID}`, filter: active ? "none" : "brightness(0.85) saturate(0.9)" }}
                animate={{ scale: active ? 1.05 : 0.95 }}
                transition={{ duration: 0.5 }}
              >
                {i === cards.length - 1 && (
                  <span className="absolute top-2 right-2 group inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-600 text-[10px] text-gray-300 select-none">
                    i
                    <span className="absolute z-20 hidden group-hover:block -top-2 right-5 whitespace-normal text-[11px] leading-snug bg-[#111318] border border-[#2a2f38] rounded-md px-2 py-1 text-gray-200 shadow-xl w-72">
                      65% of the creator rewards will be allocated to GPU miners at the time of each snapshot. 35% of the creator rewards will be allocated to miners that have been active for 12+ hours without interruption at the time of each epoch cycle reward.
                    </span>
                  </span>
                )}
                <div className="text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: GREEN }}>
                  {card.t}
                </div>
                <div className="text-xs text-gray-300/85 mt-1 leading-relaxed">{card.s}</div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ========================= TOP GAUGES =========================
interface GPUsWorkingProps {
  holders: { address: string; balance: number }[];
  sol: number | null;
  epochSol: number | null;
}
function GPUsWorking({ holders, sol, epochSol }: GPUsWorkingProps) {
  const totalGPUs = useMemo(() => holders.reduce((acc, h) => acc + toGPUs(h.balance), 0), [holders]);

  return (
    <div className="mt-6 relative grid grid-cols-1 md:grid-cols-3 gap-6 md:items-center">
      {/* separators */}
      <motion.div
        className="hidden md:block pointer-events-none absolute top-0 bottom-0"
        style={{ left: "33.333%", transform: "translateX(-50%)", width: 2, background: `linear-gradient(180deg, transparent, ${GREEN}, transparent)`, boxShadow: `0 0 12px ${GREEN}AA, 0 0 24px ${GREEN}66` }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="hidden md:block pointer-events-none absolute top-0 bottom-0"
        style={{ left: "66.666%", transform: "translateX(-50%)", width: 2, background: `linear-gradient(180deg, transparent, ${GREEN}, transparent)`, boxShadow: `0 0 12px ${GREEN}AA, 0 0 24px ${GREEN}66` }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 1.6 }}
      />

      {/* Left: GPUs */}
      <div className="flex items-center gap-3 order-1 md:order-1">
        <div className="text-base md:text-lg tracking-wide text-gray-200/90">GPUs working:</div>
        <div className="text-xl md:text-2xl font-semibold" style={{ color: GREEN, textShadow: `0 0 10px ${GREEN}77` }}>
          {nf.format(totalGPUs)}
        </div>
      </div>

      {/* Middle: GPU Rewards */}
      <div className="relative flex items-center justify-start md:justify-center gap-3 order-2 md:order-2">
        <div className="text-base md:text-lg tracking-wide text-gray-200/90">GPU Rewards:</div>
        <div className="text-xl md:text-2xl font-semibold" style={{ color: GREEN, textShadow: `0 0 10px ${GREEN}77` }}>
          {sol === null ? "—" : (
            <span className="inline-flex items-center gap-1">
              <span>{sol.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SOL</span>
              <span className="relative group inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-600 text-[10px] text-gray-300 ml-1">
                i
                <span className="absolute z-20 hidden group-hover:block -top-2 left-5 whitespace-normal text-[11px] leading-snug bg-[#111318] border border-[#2a2f38] rounded-md px-2 py-1 text-gray-200 shadow-xl w-64">
                  Total creator rewards already claimed that will be distributed to GPUs in the next reward cycle.
                </span>
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Right: Epoch Rewards */}
      <div className="relative flex items-center gap-3 justify-start md:justify-end order-3 md:order-3">
        <div className="text-base md:text-lg tracking-wide text-gray-200/90">Epoch Rewards:</div>
        <div className="text-xl md:text-2xl font-semibold" style={{ color: GREEN, textShadow: `0 0 10px ${GREEN}77` }}>
          {epochSol === null ? "—" : (
            <span className="inline-flex items-center gap-1">
              <span>{epochSol.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SOL</span>
              <span className="relative group inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-600 text-[10px] text-gray-300 ml-1">
                i
                <span className="absolute z-20 hidden group-hover:block -top-2 right-5 whitespace-normal text-[11px] leading-snug bg-[#111318] border border-[#2a2f38] rounded-md px-2 py-1 text-gray-200 shadow-xl w-72">
                  Creator rewards (35%) allocated to the next epoch cycle for miners active 12+ hours without interruption.
                </span>
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ========================= COUNTDOWNS =========================
function msUntilNextThirty(): number {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(now.getMinutes() < 30 ? 30 : 60);
  return next.getTime() - now.getTime();
}
function useHalfHourCountdown() {
  const [remaining, setRemaining] = useState<number>(() => msUntilNextThirty());
  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => (r - 1000 <= 0 ? msUntilNextThirty() : r - 1000)), 1000);
    const onVis = () => setRemaining(msUntilNextThirty());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  const total = 30 * 60 * 1000;
  const elapsed = Math.max(0, total - remaining);
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  return { display: `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`, progress: elapsed / total };
}
function CountdownBar() {
  const { display, progress } = useHalfHourCountdown();
  return (
    <div className="mt-4 w-full">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Next reward cycle</span>
        <span className="font-mono text-gray-200">{display}</span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full overflow-hidden" style={{ background: GRID }}>
        <motion.div className="h-full" style={{ background: GREEN }} animate={{ width: `${Math.min(100, Math.max(0, progress * 100)).toFixed(2)}%` }} transition={{ type: "tween", ease: "linear", duration: 0.9 }} />
      </div>
    </div>
  );
}

// epoch countdown (driven by server snapshot)
type EpochState = { totalMs: number; remainingMs: number };
function formatHMS(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function useEpochCountdownFromServer(initial?: EpochState) {
  const [state, setState] = useState<EpochState>(initial ?? { totalMs: 0, remainingMs: 0 });

  useEffect(() => {
    if (initial) setState(initial);
  }, [initial?.totalMs, initial?.remainingMs]);

  useEffect(() => {
    if (!state.totalMs) return;
    const id = setInterval(() => setState((s) => ({ ...s, remainingMs: Math.max(0, s.remainingMs - 1000) })), 1000);
    return () => clearInterval(id);
  }, [state.totalMs]);

  const progress = state.totalMs ? (state.totalMs - state.remainingMs) / state.totalMs : 0;
  const display = formatHMS(state.remainingMs);
  return { display, progress };
}
function EpochCountdownBar({ epoch }: { epoch: EpochState | null }) {
  const { display, progress } = useEpochCountdownFromServer(epoch ?? undefined);
  return (
    <div className="mt-3 w-full">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-2">
          Next epoch cycle
          <span className="relative group inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-600 text-[10px] text-gray-300">
            i
            <span className="absolute z-20 hidden group-hover:block -top-2 left-5 whitespace-normal text-[11px] leading-snug bg-[#111318] border border-[#2a2f38] rounded-md px-2 py-1 text-gray-200 shadow-xl w-64">
              Each GPU that has been working for over 12 hours without interruption during the current epoch receives a share of the epoch reward.
            </span>
          </span>
        </span>
        <span className="font-mono text-gray-200">{display}</span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full overflow-hidden" style={{ background: GRID }}>
        <motion.div className="h-full" style={{ background: GREEN }} animate={{ width: `${Math.min(100, Math.max(0, progress * 100)).toFixed(2)}%` }} transition={{ type: "tween", ease: "linear", duration: 0.9 }} />
      </div>
    </div>
  );
}

// ========================= TABLE =========================
function HoldersTable({ holders }: { holders: { address: string; balance: number }[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const processed = useMemo(
    () => holders.map((h) => ({ address: String(h.address), balance: Number(h.balance), gpus: toGPUs(Number(h.balance)) })),
    [holders]
  );

  const ranks = useMemo(() => {
    const sorted = [...processed].sort((a, b) => b.balance - a.balance);
    const m = new Map<string, number>();
    sorted.forEach((h, idx) => m.set(h.address, idx + 1));
    return m;
  }, [processed]);

  const filtered = useMemo(
    () => processed.filter((h) => (query ? h.address.toLowerCase().includes(query.toLowerCase()) : true)),
    [processed, query]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  const podiumStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return { background: "linear-gradient(90deg, rgba(255,215,0,0) 0, rgba(255,215,0,0) 16px, rgba(255,215,0,0.12) 40px, rgba(255,215,0,0.05) calc(100% - 40px), rgba(255,215,0,0) 100%)", boxShadow: "none" } as React.CSSProperties;
      case 2:
        return { background: "linear-gradient(90deg, rgba(192,192,192,0) 0, rgba(192,192,192,0) 16px, rgba(192,192,192,0.12) 40px, rgba(192,192,192,0.05) calc(100% - 40px), rgba(192,192,192,0) 100%)", boxShadow: "none" } as React.CSSProperties;
      case 3:
        return { background: "linear-gradient(90deg, rgba(205,127,50,0) 0, rgba(205,127,50,0) 16px, rgba(205,127,50,0.12) 40px, rgba(205,127,50,0.05) calc(100% - 40px), rgba(205,127,50,0) 100%)", boxShadow: "none" } as React.CSSProperties;
      default:
        return {} as React.CSSProperties;
    }
  };
  const medalColor = (rank: number) => (rank === 1 ? "#ffd700" : rank === 2 ? "#c0c0c0" : rank === 3 ? "#cd7f32" : "");

  return (
    <div className="mt-8 p-5 rounded-2xl relative overflow-hidden" style={{ background: CARD, border: `1px solid ${GRID}` }}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-sm text-gray-300/90">Holder registry</div>
          <div className="text-xs text-gray-400/90">1 GPU = {nf.format(TOKENS_PER_GPU)} $GPU</div>
        </div>
        <input
          value={query}
          onChange={(e) => {
            setPage(1);
            setQuery(e.target.value);
          }}
          placeholder="Search wallet…"
          className="w-full md:w-72 px-3 py-2 rounded-xl outline-none text-sm"
          style={{ background: "#121418", border: `1px solid ${GRID}`, color: "#e5e7eb" }}
        />
      </div>

      <div className="mt-4 w-full overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400">
              <th className="py-2 pr-4">#</th>
              <th className="py-2 pr-4">Wallet</th>
              <th className="py-2 pr-4">Balance</th>
              <th className="py-2 pr-4">GPUs</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((h, i) => {
              const rank = ranks.get(h.address) ?? start + i + 1;
              const rowStyle = podiumStyle(rank);
              return (
                <tr key={`${h.address}-${i}`} className="border-t border-[#232831] hover:bg-[#14171d] transition-colors" style={rowStyle}>
                  <td className="py-3 pr-4 relative" style={{ isolation: "isolate" }}>
                    {(() => {
                      const mc = medalColor(rank);
                      if (!mc) return <span className="text-gray-400">{rank}</span>;
                      return (
                        <span
                          className="relative z-10 inline-block px-2 py-0.5 rounded-full font-semibold"
                          style={{ color: mc, background: "#0e0f11", filter: `drop-shadow(0 0 6px ${mc}66)`, border: `1px solid ${mc}88` }}
                        >
                          {rank}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-3 pr-4 font-mono text-gray-200 break-all">{h.address}</td>
                  <td className="py-3 pr-4 text-gray-300">{nf.format(Math.floor(h.balance))}</td>
                  <td className="py-3 pr-4 font-semibold" style={{ color: GREEN }}>
                    {nf.format(h.gpus)}
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-xs text-gray-400">
                  No holders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
        <span>Page {currentPage} of {totalPages}</span>
        <div className="flex gap-2">
          <button disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 rounded bg-[#121418] disabled:opacity-30" style={{ border: `1px solid ${GRID}` }}>
            Prev
          </button>
          <button disabled={currentPage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1 rounded bg-[#121418] disabled:opacity-30" style={{ border: `1px solid ${GRID}` }}>
            Next
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-6" style={{ background: `linear-gradient(180deg, ${CARD}, transparent)` }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10" style={{ background: `linear-gradient(90deg, transparent, ${CARD})` }} />
    </div>
  );
}

// ========================= DATA LAYER (dev tests only) =========================
function coerceGPAList(json: any): any[] {
  if (Array.isArray(json?.result)) return json.result as any[];
  if (Array.isArray(json?.result?.value)) return json.result.value as any[];
  return [];
}

// ========================= APP (snapshot-first) =========================
export default function App() {
  const [holders, setHolders] = useState<{ address: string; balance: number }[]>([]);
  const [sol, setSol] = useState<number | null>(null);
  const [epochSol, setEpochSol] = useState<number | null>(null);
  const [epoch, setEpoch] = useState<EpochState | null>(null);

  // global base styles
  useEffect(() => {
    document.documentElement.style.background = BG;
    document.documentElement.style.color = "#e5e7eb";
    document.documentElement.style.fontFamily = "";
  }, []);

  // read CDN-cached snapshot every 30s
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await fetch("/api/snapshot", { cache: "no-store" });
        if (!mounted) return;
        if (res.ok) {
          const data = await res.json();
          const h = Array.isArray(data?.holders)
            ? data.holders.map((x: any) => ({ address: String(x.address), balance: Number(x.balance) }))
            : [];
          setHolders(h);
          setSol(Number(data?.gpuRewardsSol ?? 0));
          setEpochSol(Number(data?.epochRewardsSol ?? 0));
          const e = data?.epoch;
          if (e && Number.isFinite(e.totalMs) && Number.isFinite(e.remainingMs)) {
            setEpoch({ totalMs: Number(e.totalMs), remainingMs: Number(e.remainingMs) });
          }
        }
      } catch {
        /* ignore; next tick will refresh */
      }
    };

    const safeLoad = () => {
      if (document.visibilityState !== "visible") return; // skip hidden tabs
      load();
    };

    safeLoad(); // initial
    const id = setInterval(safeLoad, 30_000);
    const onVis = () => document.visibilityState === "visible" && safeLoad();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      mounted = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div className="min-h-screen w-full" style={{ background: BG }}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700&family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet" />
      <div className="mx-auto max-w-6xl px-5 pb-24">
        <Header />
        <InfoCarousel />
        <GPUsWorking holders={holders} sol={sol} epochSol={epochSol} />
        <CountdownBar />
        <EpochCountdownBar epoch={epoch} />
        <HoldersTable holders={holders} />
      </div>
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 50% -10%, rgba(89,214,150,0.08), transparent 60%), radial-gradient(800px 400px at 120% 10%, rgba(89,214,150,0.06), transparent 60%)",
        }}
      />
    </div>
  );
}

// ========================= DEV TESTS =========================
function runDevTests() {
  try {
    console.groupCollapsed("GPU site – dev tests");
    // toGPUs
    console.assert(toGPUs(0) === 0);
    console.assert(toGPUs(999_999) === 0);
    console.assert(toGPUs(1_000_000) === 1);
    console.assert(toGPUs(1_999_999) === 1);
    console.assert(toGPUs(2_000_000) === 2);
    // normalizeMint extracts base58
    const mixed = `mint: ${TRACKED_MINT}`;
    console.assert(normalizeMint(mixed) === TRACKED_MINT.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/)![0]);
    // msUntilNextThirty bounds
    const ms = msUntilNextThirty();
    console.assert(ms > 0 && ms <= 30 * 60 * 1000);
    // parseLamportsFromGetBalance shapes
    console.assert(parseLamportsFromGetBalance({ result: { value: 123 } }) === 123);
    console.assert(parseLamportsFromGetBalance({ result: 456 }) === 456);
    console.assert(parseLamportsFromGetBalance({ foo: "bar" }) === 0);
    // GPA coercion
    console.assert(Array.isArray(coerceGPAList({ result: [] })));
    console.assert(Array.isArray(coerceGPAList({ result: { value: [] } })));
    // exclusions
    console.assert(isExcludedHolder("GXz5QGRpugxBZ7V9S9YiJ27K5Zt7TqizqvrjZRVegeU5") === true);
    console.assert(isExcludedHolder("11111111111111111111111111111111") === false);
    console.groupEnd();
  } catch (e) {
    console.warn("Dev tests error", e);
  }
}
if (typeof window !== "undefined") setTimeout(runDevTests, 0);

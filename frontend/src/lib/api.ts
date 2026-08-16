// API 客户端 — 全部走后端 /api（数据源：TDX/Tushare/东财，由后端统一接管）
const base = '/api';

async function j<T>(path: string, method: string = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const e = await res.json(); msg = e.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  health: () => j('/health', 'GET'),
  marketSummary: () => j<MarketSummary>('/market/summary?maxAge=45', 'GET'),
  quotes: (codes: string[]) => j<QuotesRes>(`/market/quotes?codes=${codes.join(',')}`, 'GET'),
  kline: (code: string, setcode: string, period = '4', count = '120') =>
    j<KlineRes>(`/market/kline?code=${code}&setcode=${setcode}&period=${period}&count=${count}`, 'GET'),
  volume: (days = 10) => j<VolumeRes>(`/market/volume?days=${days}`, 'GET'),
  amv: (days = 10) => j<AmvRes>(`/market/amv?days=${days}`, 'GET'),
  emotion: () => j<EmotionPanel>(`/emotion?maxAge=120`, 'GET'),
  emotionHistory: (days = 14) => j<EmotionHistory>(`/emotion/history?days=${days}`, 'GET'),
  emotionHistoryFrom: (from: string, maxAge = 7200) => j<EmotionHistory>(`/emotion/history?from=${from}&maxAge=${maxAge}`, 'GET'),
  globalIndices: () => j<{ data: Record<string, GlobalIndex> }>('/global/indices', 'GET'),
  globalAll: () => j<GlobalAll>('/global/all?maxAge=3600', 'GET'),
  breadth: () => j<{ up: number; down: number; flat: number }>('/market/breadth?maxAge=300', 'GET'),
  stats: (days = 10) => j<{ data: StatsDay[] }>(`/market/stats?days=${days}`, 'GET'),
  year: () => j<YearData>('/market/year?maxAge=1800', 'GET'),
  kgSector: (type = 'concept', sort = 'score', limit = 40) => j<KgSectorRes>(`/sector/kg?type=${type}&sort=${sort}&limit=${limit}`, 'GET'),
  sectorFlow: (type = 'industry', pz = 30) => j<SectorFlowRes>(`/sector/flow?type=${type}&pz=${pz}`, 'GET'),
  moneyflow: (codes: string[]) => j<{ data: Record<string, { date: string; mainNet: number; netRatio: number | null }> }>(`/market/moneyflow?codes=${codes.join(',')}`, 'GET'),

  premarket: (date: string) => j<PremarketRes>(`/premarket?date=${date}`, 'GET'),
  premarketDates: () => j<{ dates: string[] }>('/premarket', 'GET'),
  premarketSave: (item: { trade_date: string; section: string; item_key: string; payload: Record<string, unknown> }) =>
    j<{ items: PremarketItem[] }>('/premarket', 'POST', item),
  premarketDelete: (id: number) => j<{ ok: boolean }>(`/premarket/${id}`, 'DELETE'),
  premarketCopy: (from: string, to: string) => j<{ items: PremarketItem[] }>('/premarket/copy', 'POST', { from, to }),

  watchlist: () => j<{ data: WatchItem[] }>('/watchlist', 'GET'),
  watchAdd: (item: { code: string; name?: string; group_name?: string; note?: string }) =>
    j<{ data: WatchItem[] }>('/watchlist', 'POST', item),
  watchRemove: (code: string) => j<{ ok: boolean }>(`/watchlist/${code}`, 'DELETE'),

  trades: () => j<{ data: Trade[] }>('/trades', 'GET'),
  tradeAdd: (t: Record<string, unknown>) => j<{ id: number }>('/trades', 'POST', t),
  tradeModeUpdate: (id: number, mode: string) => j<{ data: Trade[] }>(`/trades/${id}/mode`, 'PATCH', { mode }),
  importTrades: (rows: unknown[]) => j<{ ok: number; skip: number }>('/import/trades', 'POST', { rows }),

  reviews: () => j<{ data: ReviewItem[] }>('/review', 'GET'),
  reviewGet: (d: string) => j<{ data: ReviewDetail }>(`/review/${d}`, 'GET'),
  reviewSave: (r: { trade_date: string; summary?: string; plan?: string; data?: unknown }) =>
    j<{ ok: boolean }>('/review', 'POST', r),

  // ── 重构新增：核心股池 / 情绪节点 / 买卖计划 / 日自选观察 / 对标 / 巡检 ──
  core: () => j<{ data: CoreStock[] }>('/core', 'GET'),
  coreAdd: (c: { type: string; sector?: string; code: string; name?: string; note?: string }) =>
    j<{ data: CoreStock[] }>('/core', 'POST', c),
  coreRemove: (type: string, code: string) => j<{ data: CoreStock[] }>(`/core/${type}/${code}`, 'DELETE'),
  nodes: () => j<{ data: EmotionNode[] }>('/nodes', 'GET'),
  nodeAdd: (n: { node_date: string; label: string; kind?: string; desc?: string }) =>
    j<{ data: EmotionNode[] }>('/nodes', 'POST', n),
  nodeRemove: (id: number) => j<{ data: EmotionNode[] }>(`/nodes/${id}`, 'DELETE'),
  plans: (date?: string) => j<{ data: TradePlan[] }>(`/plans${date ? `?trade_date=${date}` : ''}`, 'GET'),
  planAdd: (p: Record<string, unknown>) => j<{ data: TradePlan[] }>('/plans', 'POST', p),
  planPatch: (id: number, p: Record<string, unknown>) => j<{ data: TradePlan[] }>(`/plans/${id}`, 'PATCH', p),
  planDelete: (id: number) => j<{ data: TradePlan[] }>(`/plans/${id}`, 'DELETE'),
  watchItems: (date?: string) => j<{ data: WatchItemRow[] }>(`/watch-items${date ? `?trade_date=${date}` : ''}`, 'GET'),
  watchItemAdd: (w: { trade_date: string; code: string; name?: string; sector?: string; note?: string }) =>
    j<{ data: WatchItemRow[] }>('/watch-items', 'POST', w),
  watchItemRemove: (id: number) => j<{ data: WatchItemRow[] }>(`/watch-items/${id}`, 'DELETE'),
  compare: (codes: string[], days = 30) => j<{ data: CompareRes; cached?: boolean }>(`/compare?codes=${codes.join(',')}&days=${days}`, 'GET'),
  patrol: () => j<{ items: PatrolItem[]; cached?: boolean }>('/patrol', 'GET'),
  getConfig: () => j<{ data: RuntimeConfig }>('/config', 'GET'),
  saveConfig: (patch: Record<string, string>) => j<{ data: RuntimeConfig; ok: boolean }>('/config', 'POST', patch),
};

// ── 重构新增类型 ──
export interface CoreStock { id: number; type: string; sector: string; code: string; name: string; note: string; sort: number; created_at: string }
export interface EmotionNode { id: number; node_date: string; label: string; kind: string; desc: string }
export interface TradePlan { id: number; trade_date: string; side: 'buy' | 'sell'; code: string; name: string; mode: string; logic: string; tp: string; sl: string; status: string; created_at: string }
export interface WatchItemRow { id: number; trade_date: string; code: string; name: string; sector: string; note: string }
export interface CompareRes { series: { code: string; name: string; dates: string[]; pct: number[]; close: number[] }[]; days: number }
export interface PatrolItem { title: string; time: string; source: string; url: string }
export interface RuntimeConfig {
  tushare_token_set: boolean;
  wudao_url: string;
  wudao_token_set: boolean;
  tdxhub_url: string;
  port: string;
}

// ── 类型 ──
export interface IndexInfo {
  key: string; name: string; code: string; setcode: string;
  now: number | null; pctChg: number | null; amount: number | null; time?: string;
}
export interface MarketSummary {
  indices: Record<string, IndexInfo>; turnover: number | null; source: string; ts: number;
}
export interface QuotesRes { data: { code: string; setcode: string; data: { HQInfo: Record<string, number | string>; BaseInfo: Record<string, string> } }[] }
export interface KlineRes { data: { code: string; period: string; items: { Data: string; Second?: string; Open: string; High: string; Low: string; Close: string; VolInStock: string }[] } }
export interface VolumeRes {
  series: { date: string; amount: number }[]; source: string;
  rally?: {
    openSurge: boolean; sustained: boolean; rally: boolean;
    at1030: number | null; at1130: number | null; now: number | null;
    timeline: { t: string; amount: number }[];
  };
}
export interface AmvRes { series: { date: string; close: number; change: number | null }[]; source: string }
export interface EmotionPanel {
  date: string | null;
  stats: { limitUpCount: number; limitDownCount: number; brokenCount: number; sealRate: number; maxStreak: number; ladderLevels: number };
  ladder: { streak: number; count: number; stocks: { code: string; name: string; pattern: string; seal: number }[] }[];
  themeRank: { name: string; count: number }[];
  limitUps: Record<string, unknown>[];
  source: string;
}
export interface EmotionHistory {
  dates: string[];
  daily: { date: string; count: number; ups: { code: string; name: string; streak: number; reason: string; pattern: string; seal: number | null }[] }[];
  rally: { date: string; rate: number | null; promoted: number | null; prevCount: number | null }[];
  ts: number;
}
export interface GlobalIndex { key: string; name: string; date: string; close: number; pctChg: number | null }
export interface UsQuote { key: string; name: string; code: string; price: number; pctChg: number }
export interface GlobalAll { indices: Record<string, GlobalIndex>; us: Record<string, UsQuote>; gold: UsQuote | null; ts: number }
export interface StatsDay {
  date: string;
  limit_up: number | null; limit_down: number | null; broken: number | null;
  seal_rate: number | null; max_streak: number | null;
  up_count: number | null; down_count: number | null; flat_count: number | null;
  turnover: number | null;
}
export interface KgSectorRow {
  rank: number; name: string; pctChg: number | null;
  score: number | null; ratio: number | null; net: number | null;
  swingAmt: number | null; leadStock: string;
}
export interface KgSectorRes { date: string; type: string; total: number; list: KgSectorRow[] }
export interface YearData {
  indices: { date: string; sh: number; sz: number; cyb: number; amount: number }[];
  kline: { sh: KBar[]; cyb: KBar[]; kc50: KBar[] };
  amv: { date: string; close: number; change: number | null }[];
  stats: (StatsDay & { date: string })[];
  ts: number;
}
export interface KBar { date: string; o: number; h: number; l: number; c: number }
export interface SectorFlowRes { list: { code: string; name: string; pctChg: number; mainNet: number; mainPct: number }[]; type: string }
export interface PremarketItem { id: number; trade_date: string; section: string; item_key: string; payload: Record<string, any> }
export interface PremarketRes { date: string; items: PremarketItem[] }
export interface WatchItem { id: number; code: string; name: string; group_name: string; note: string }
export interface Trade { id: number; trade_date: string; code: string; name: string; side: 'buy' | 'sell'; price: number | null; shares: number | null; amount: number | null; note: string; mode?: string }
export interface ReviewItem { id: number; trade_date: string; summary: string; plan: string; created_at: string }
export interface ReviewDetail { id: number; trade_date: string; summary: string; plan: string; data: Record<string, any> }

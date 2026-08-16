// API 封装
const base = '/api';

async function j(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const e = await res.json(); msg = e.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  health: () => j('GET', '/health'),
  marketSummary: (maxAge = 60) => j('GET', `/market/summary?maxAge=${maxAge}`),
  volume: (days = 10) => j('GET', `/market/volume?days=${days}`),
  emotion: (maxAge = 120) => j('GET', `/emotion?maxAge=${maxAge}`),
  quotes: (codes) => j('GET', `/market/quotes?codes=${codes.join(',')}`),
  kline: (code, period = '0', count = '120') => j('GET', `/market/kline?code=${code}&period=${period}&count=${count}`),
  tushare: (api_name, params = {}) => j('POST', '/tushare/call', { api_name, params }),
  watchlist: () => j('GET', '/watchlist'),
  watchAdd: (item) => j('POST', '/watchlist', item),
  watchRemove: (code) => j('DELETE', `/watchlist/${code}`),
  watchUpdate: (code, patch) => j('PATCH', `/watchlist/${code}`, patch),
  trades: (q = {}) => j('GET', `/trades?${new URLSearchParams(q)}`),
  tradeAdd: (t) => j('POST', '/trades', t),
  reviews: () => j('GET', '/review'),
  reviewGet: (d) => j('GET', `/review/${d}`),
  reviewSave: (r) => j('POST', '/review', r),
  premarket: (date) => j('GET', `/premarket?date=${date}`),
  premarketDates: () => j('GET', '/premarket'),
  premarketSave: (item) => j('POST', '/premarket', item),
  premarketCopy: (from, to) => j('POST', '/premarket/copy', { from, to }),
  premarketDelete: (id) => j('DELETE', `/premarket/${id}`),
  status: () => j('GET', '/status'),
  globalIndices: () => j('GET', '/global/indices'),
  sectorFlow: (type = 'industry', pz = 30) => j('GET', `/sector/flow?type=${type}&pz=${pz}`),
  importTrades: (rows) => j('POST', '/import/trades', { rows }),
  amv: (days = 10) => j('GET', `/market/amv?days=${days}`),
};

export function fmtAmount(v) {
  if (v == null || isNaN(v)) return '--';
  const y = v / 1e8;
  if (y >= 1e4) return (y / 1e4).toFixed(2) + ' 万亿';
  return y.toFixed(0) + ' 亿';
}

export function fmtPct(v, digits = 2) {
  if (v == null || isNaN(v)) return '--';
  const s = v > 0 ? '+' : '';
  return s + v.toFixed(digits) + '%';
}

export function cls(v) {
  if (v == null || isNaN(v) || v === 0) return 'flat';
  return v > 0 ? 'up' : 'down';
}

/**
 * 定时任务：盘中自动刷新核心数据 → 快照缓存
 * 交易时段: 9:15-11:35 / 12:55-15:05（含竞价与尾盘）
 * 刷新节奏：核心面板每小时（整点）；盘后收盘自动拉复盘数据包。
 */
import cron from 'node-cron';
import { marketSummary } from './datasources/index.js';
import { emotionPanel } from './services/emotion.js';
import { globalIndices, usSnapshot } from './services/global.js';
import { marketBreadth } from './services/breadth.js';
import { cacheGet, cacheSet, statsSave } from './db.js';

let lastRefresh = null;
let lastStatus = null;

function inTradingSession(now = new Date()) {
  const d = now.getDay();
  if (d === 0 || d === 6) return false;
  const t = now.getHours() * 100 + now.getMinutes();
  return (t >= 915 && t <= 1135) || (t >= 1255 && t <= 1505);
}

function fmtDate(d = new Date()) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

async function refreshCore() {
  try {
    const m = await marketSummary();
    cacheSet('market:summary', m, m.source);
    lastRefresh = new Date().toISOString();
    lastStatus = { ok: true, source: m.source, ts: lastRefresh };
  } catch (e) {
    lastStatus = { ok: false, error: e.message, ts: new Date().toISOString() };
    console.error('[scheduler] refreshCore 失败:', e.message);
  }
  // 情绪面板（涨停/跌停/炸板）盘中每2分钟刷一次，失败不影响主状态
  try {
    const emo = await emotionPanel();
    cacheSet('emotion:panel', emo, emo.source);
  } catch (e) {
    console.error('[scheduler] emotionPanel 失败:', e.message);
  }
}

/** 盘中宽度（涨跌家数）缓存 */
async function refreshBreadth() {
  try {
    const b = await marketBreadth();
    cacheSet('breadth:now', b, 'eastmoney');
  } catch (e) {
    console.error('[scheduler] breadth 失败:', e.message);
  }
}

/** 盘中两市成交额时间序列（主升侦测数据源） */
async function refreshTurnoverTimeline() {
  try {
    const m = await marketSummary();
    if (!m?.turnover) return;
    const now = new Date();
    const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const date = fmtDate(now);
    let seq = cacheGet('turnover:intraday')?.payload || [];
    // 跨日重置
    if (seq.length && seq[seq.length - 1].date !== date) seq = [];
    seq = seq.filter(x => x.date === date);
    seq.push({ date, t, amount: m.turnover });
    // 保留最近 40 个点
    cacheSet('turnover:intraday', seq.slice(-40), 'tdx');
  } catch (e) {
    console.error('[scheduler] turnoverTimeline 失败:', e.message);
  }
}

/** 外盘（指数+美股+黄金）缓存，每日刷新 */
async function refreshGlobal() {
  try {
    const [indices, snap] = await Promise.all([globalIndices(), usSnapshot()]);
    cacheSet('global:all', { indices, us: snap.us, gold: snap.gold, ts: Date.now() }, 'eastmoney');
  } catch (e) {
    console.error('[scheduler] global 失败:', e.message);
  }
}

/** 盘后：组装当日市场快照入库（图表历史序列数据源） */
async function saveDailyStats() {
  try {
    const date = fmtDate();
    const [emotion, breadth, summary] = await Promise.all([
      emotionPanel(),
      marketBreadth().catch(() => null),
      marketSummary().catch(() => null),
    ]);
    const payload = {
      limit_up: emotion?.stats?.limitUpCount ?? null,
      limit_down: emotion?.stats?.limitDownCount ?? null,
      broken: emotion?.stats?.brokenCount ?? null,
      seal_rate: emotion?.stats?.sealRate ?? null,
      max_streak: emotion?.stats?.maxStreak ?? null,
      up_count: breadth?.up ?? null,
      down_count: breadth?.down ?? null,
      flat_count: breadth?.flat ?? null,
      turnover: summary?.turnover ?? null,
    };
    statsSave(date, payload);
    console.log(`[scheduler] 当日快照已入库: ${date}`);
  } catch (e) {
    console.error('[scheduler] saveDailyStats 失败:', e.message);
  }
}

export function startScheduler() {
  // 盘中每小时整点刷一次核心面板（低频模式：行情最多滞后1小时）
  cron.schedule('0 * * * *', async () => {
    if (!inTradingSession()) return;
    await refreshCore();
  });

  // 盘中每小时整点刷涨跌家数 + 成交额时间线
  cron.schedule('0 * * * *', async () => {
    if (!inTradingSession()) return;
    await refreshBreadth();
    await refreshTurnoverTimeline();
  });

  // 外盘每日刷新：8:00（美股隔夜收盘）与 9:10 盘前
  cron.schedule('0 8 * * 1-5', refreshGlobal);
  cron.schedule('10 9 * * 1-5', async () => { await refreshGlobal(); await refreshCore(); });

  // 盘后 15:10 自动拉收盘数据包 + 当日快照入库
  cron.schedule('10 15 * * 1-5', async () => {
    await refreshCore();
    await refreshBreadth();
    await refreshGlobal();
    await saveDailyStats();
    // 预热 4/8 至今历史连板缓存（龙头轨迹/晋级率，避免次日首次打开等2-3分钟）
    try {
      const { emotionHistory } = await import('./services/emotion.js');
      const h = await emotionHistory(14, '20260408');
      cacheSet('emotion:history:20260408', h, 'tdx');
      console.log('[scheduler] 历史连板缓存已预热:', h.dates?.length, '个交易日');
    } catch (e) { console.error('[scheduler] 历史连板预热失败:', e.message); }
  });

  // 启动即刷新一次
  refreshCore();
  refreshBreadth();
  refreshTurnoverTimeline();
  refreshGlobal();
  console.log('[scheduler] 定时任务已启动（盘中每小时整点 / 外盘每日 / 盘后快照）');
}

export function schedulerStatus() {
  return { lastRefresh, lastStatus, inSession: inTradingSession() };
}

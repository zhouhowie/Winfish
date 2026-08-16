/**
 * REST API 路由
 * /api/market/summary  大盘指数+两市成交额
 * /api/watchlist       观察池 CRUD
 * /api/trades          操作记录
 * /api/review          复盘归档
 * /api/status          调度器状态
 */
import { Router } from 'express';
import { marketSummary } from '../datasources/index.js';
import * as tdx from '../datasources/tdx.js';
import * as tushare from '../datasources/tushare.js';
import { cacheGet, cacheSet, watchAdd, watchList, watchRemove, watchUpdate, tradeAdd, tradeUpdateMode, tradeList, reviewSave, reviewList, reviewGet, premktList, premktDates, premktUpsert, premktDelete, premktCopy, statsList, coreList, coreUpsert, coreRemove, nodeList, nodeUpsert, nodeRemove, planList, planDates, planAdd, planUpdate, planAll, planDelete, watchItemList, watchItemDates, watchItemAdd, watchItemRemove, watchItemAll } from '../db.js';
import { schedulerStatus } from '../scheduler.js';
import { emotionPanel, emotionHistory } from '../services/emotion.js';
import { globalIndices, usSnapshot } from '../services/global.js';
import { sectorFlow } from '../services/sector.js';
import { marketBreadth } from '../services/breadth.js';
import { kgSectors, kgDates } from '../datasources/kg.js';
import { yearData } from '../services/year.js';
import { withCache } from '../cache.js';
import fs from 'fs';
import path from 'path';

const router = Router();

// ── 个股资金流（Tushare moneyflow，2000积分，缓存30分钟）──
router.get('/market/moneyflow', async (req, res) => {
  try {
    const codes = String(req.query.codes || '').split(',').filter(Boolean);
    if (!codes.length) return res.status(400).json({ error: '需要 codes' });
    const date = String(req.query.date || '').replace(/-/g, '') || '';
    const key = `moneyflow:${date || 'latest'}:${codes.join(',')}`;
    const r = await withCache(key, 30 * 60 * 1000, async () => {
      const out = {};
      for (const code of codes) {
        const tsCode = code.startsWith('6') ? `${code}.SH` : code.startsWith('4') || code.startsWith('8') ? `${code}.BJ` : `${code}.SZ`;
        try {
          const params = {};
          if (date) {
            params.tradeDate = date;
          } else {
            const end = new Date();
            const start = new Date(end);
            start.setDate(start.getDate() - 10);
            const f = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
            params.start = f(start);
            params.end = f(end);
          }
          const rows = await tushare.moneyflow(tsCode, params);
          const row = rows[0];
          if (row) {
            const buyLg = Number(row.buy_lg_amount || 0);
            const buyElg = Number(row.buy_elg_amount || 0);
            const sellLg = Number(row.sell_lg_amount || 0);
            const sellElg = Number(row.sell_elg_amount || 0);
            out[code] = {
              date: row.trade_date,
              mainNet: +(buyLg + buyElg - sellLg - sellElg).toFixed(0),
              netRatio: row.net_mf_amount ? +((buyLg + buyElg - sellLg - sellElg) / Number(row.net_mf_amount) * 100).toFixed(1) : null,
            };
          }
        } catch (e) {
          console.warn(`[moneyflow] ${code} 失败:`, e.message);
        }
      }
      return { data: out, source: 'tushare' };
    });
    res.json({ data: r.data, ts: Date.now(), cached: r.cached });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── 量能：两市成交额历史序列（tdxhub 日K，无 tushare 限频问题）──
router.get('/market/volume', async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days || 10), 60);
    const key = `volume:${days}`;
    const maxAge = Number(req.query.maxAge || 3600);
    const cached = cacheGet(key);
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < maxAge * 1000) {
      return res.json({ ...cached.payload, cached: true });
    }
    const [sh, sz] = await Promise.all([
      tdx.kline('000001', { setcode: '1', period: '4', wantNum: String(days) }),
      tdx.kline('399001', { setcode: '0', period: '4', wantNum: String(days) }),
    ]);
    const map = new Map();
    for (const k of [sh, sz]) {
      for (const it of k.items) {
        const d = String(it.Data);
        const amt = it.Amount ? Number(it.Amount) : 0;
        map.set(d, (map.get(d) || 0) + amt);
      }
    }
    const series = [...map.entries()]
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-days);
    // 主升侦测：当日盘中成交额时间序列
    const intraday = (cacheGet('turnover:intraday')?.payload || []).filter(x => x.date === series[series.length - 1]?.date);
    const at = (t) => intraday.filter(x => x.t <= t).pop()?.amount ?? null;
    const at1030 = at('10:30');
    const at1130 = at('11:30');
    const openSurge = at1030 != null && at1030 >= 5000e8; // 开局(10:30前)累计成交 ≥5000亿 = 爆量
    const sustained = at1130 != null && at1130 >= 7000e8; // 11:30累计 ≥7000亿 = 持续放量
    const rally = {
      openSurge,
      sustained,
      rally: openSurge && sustained, // 主升开启
      at1030: at1030 ? +(at1030 / 1e8).toFixed(0) : null,   // 亿
      at1130: at1130 ? +(at1130 / 1e8).toFixed(0) : null,   // 亿
      now: intraday.length ? +(intraday[intraday.length - 1].amount / 1e8).toFixed(0) : null,
      timeline: intraday.map(x => ({ t: x.t, amount: +(x.amount / 1e8).toFixed(0) })),
    };
    const payload = { series, source: 'tdx', ts: Date.now(), rally };
    cacheSet(key, payload, 'tdx');
    res.json({ ...payload, cached: false });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ── 盘前预案 ──
// GET /api/premarket?date=YYYY-MM-DD
router.get('/premarket', (req, res) => {
  const date = req.query.date;
  if (!date) return res.json({ dates: premktDates() });
  res.json({ date, items: premktList(date) });
});

// POST /api/premarket   { trade_date, section, item_key, payload }
router.post('/premarket', (req, res) => {
  const { trade_date, section, item_key, payload } = req.body || {};
  if (!trade_date || !section) return res.status(400).json({ error: '需要 trade_date 和 section' });
  res.json({ items: premktUpsert({ trade_date, section, item_key: item_key || '', payload }) });
});

// POST /api/premarket/copy  { from, to }
router.post('/premarket/copy', (req, res) => {
  const { from, to } = req.body || {};
  if (!from || !to) return res.status(400).json({ error: '需要 from 和 to' });
  res.json({ items: premktCopy(from, to) });
});

// DELETE /api/premarket/:id
router.delete('/premarket/:id', (req, res) => {
  const date = premktDelete(Number(req.params.id));
  res.json({ ok: true, date });
});

// ── 外盘指数（缓存30分钟）──
router.get('/global/indices', async (req, res) => {
  try {
    const r = await withCache('global:indices', 30 * 60 * 1000, async () => ({ data: await globalIndices(), source: 'eastmoney' }));
    res.json({ data: r.data, ts: Date.now(), cached: r.cached });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── 年度走势数据（今年 1/1 起，指数/量能/活跃市值/涨跌家数/涨跌停）──
router.get('/market/year', async (req, res) => {
  try {
    const maxAge = Number(req.query.maxAge || 1800);
    const cached = cacheGet('market:year');
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < maxAge * 1000) {
      return res.json({ ...cached.payload, cached: true });
    }
    const data = await yearData();
    cacheSet('market:year', data, 'tdx');
    res.json({ ...data, cached: false });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── KG 板块资金雷达（OneChart 同源，缓存10分钟）──
router.get('/sector/kg', async (req, res) => {
  try {
    const { type = 'concept', sort = 'score', limit = 40, date } = req.query;
    const key = `kg:${type}:${sort}:${limit}:${date || 'latest'}`;
    const r = await withCache(key, 10 * 60 * 1000, async () => ({ data: kgSectors({ type, sort, limit: Number(limit), date }), source: 'kg' }));
    res.json(r.data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/sector/kg/dates', (req, res) => res.json(kgDates()));

// ── 外盘全量（指数+美股七姐妹/费半/MU/LITE+黄金）——优先读每日缓存 ──
router.get('/global/all', async (req, res) => {
  try {
    const maxAge = Number(req.query.maxAge || 3600);
    const cached = cacheGet('global:all');
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < maxAge * 1000) {
      return res.json({ ...cached.payload, cached: true });
    }
    const [indices, us] = await Promise.all([globalIndices(), usSnapshot()]);
    const payload = { indices, us: us.us, gold: us.gold, ts: Date.now() };
    cacheSet('global:all', payload, 'eastmoney');
    res.json({ ...payload, cached: false });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── 涨跌家数（市场宽度）──
router.get('/market/breadth', async (req, res) => {
  try {
    const maxAge = Number(req.query.maxAge || 300);
    const cached = cacheGet('breadth:now');
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < maxAge * 1000) {
      return res.json({ ...cached.payload, cached: true });
    }
    const b = await marketBreadth();
    cacheSet('breadth:now', b, 'eastmoney');
    res.json({ ...b, cached: false });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── 每日市场快照序列（涨跌停/涨跌家数/量能，图表数据源，10/20/30天）──
router.get('/market/stats', (req, res) => {
  const days = Math.min(Number(req.query.days || 10), 60);
  res.json({ data: statsList(days), ts: Date.now() });
});

// ── 板块资金流（东财，缓存60秒）──
router.get('/sector/flow', async (req, res) => {
  try {
    const { type = 'industry', pz = 30, sortBy = 'f62' } = req.query;
    const key = `sector:flow:${type}:${pz}:${sortBy}`;
    const r = await withCache(key, 60 * 1000, async () => ({ data: await sectorFlow({ type, pz: Number(pz), sortBy }), source: 'eastmoney' }));
    res.json(r.data);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── 交割单批量导入（前端解析 CSV 后传入 JSON）──
router.post('/import/trades', (req, res) => {
  const { rows, source = 'csv' } = req.body || {};
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: '需要 rows 数组' });
  let ok = 0, skip = 0;
  for (const r of rows) {
    const code = String(r.code || '').trim();
    const side = String(r.side || '').trim().toLowerCase();
    if (!code || !['buy', 'sell'].includes(side)) { skip++; continue; }
    tradeAdd({
      trade_date: String(r.date || '').replace(/-/g, '').slice(0, 8) || new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      code, name: r.name || '', side,
      price: r.price ? Number(r.price) : null,
      shares: r.shares ? Number(r.shares) : null,
      amount: r.amount ? Number(r.amount) : null,
      note: r.note || `导入:${source}`,
    });
    ok++;
  }
  res.json({ ok, skip });
});

// ── 活跃市值（本地 0AMV 文件，缓存10分钟）──
router.get('/market/amv', async (req, res) => {
  try {
    const days = Number(req.query.days || 10);
    const key = `amv:${days}`;
    const r = await withCache(key, 10 * 60 * 1000, async () => {
      const amvPath = process.env.AMV_CSV || 'F:\\Compass\\WavMain\\ANALYSE\\Data\\ChinaStk\\Z_SK\\0AMV_base.csv';
      if (!fs.existsSync(amvPath)) return { data: { series: [], source: 'none', note: '本地0AMV文件不存在' }, source: 'none' };
      const lines = fs.readFileSync(amvPath, 'utf-8').split(/\r?\n/).filter(Boolean);
      const header = lines[0].split(',');
      const idx = {};
      header.forEach((h, i) => idx[h.trim()] = i);
      const dateCol = idx.date ?? idx.Date ?? 0;
      const closeCol = idx.close ?? idx.Close ?? 1;
      const chgCol = idx.change ?? idx.Change;
      const series = lines.slice(1).slice(-days).map(l => {
        const p = l.split(',');
        return {
          date: p[dateCol]?.trim(),
          close: Number(p[closeCol]) || 0,
          change: chgCol != null ? (Number(p[chgCol]) || 0) : null,
        };
      }).filter(s => s.date);
      return { data: { series, source: 'local', path: amvPath }, source: 'local' };
    });
    res.json(r.data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 情绪面板 ──
router.get('/emotion', async (req, res) => {
  try {
    const maxAge = Number(req.query.maxAge || 120);
    const cached = cacheGet('emotion:panel');
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < maxAge * 1000) {
      return res.json({ ...cached.payload, cached: true });
    }
    const p = await emotionPanel();
    cacheSet('emotion:panel', p, p.source);
    res.json({ ...p, cached: false });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ── 历史连板数据（龙头轨迹/晋级率，from 起始日期，缓存30分钟）──
router.get('/emotion/history', async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days || 14), 30);
    const from = String(req.query.from || '').replace(/-/g, '') || null;
    const key = `emotion:history:${from || days}`;
    const maxAge = Number(req.query.maxAge || 1800);
    const cached = cacheGet(key);
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < maxAge * 1000) {
      return res.json({ ...cached.payload, cached: true });
    }
    const h = await emotionHistory(days, from);
    cacheSet(key, h, 'tdx');
    res.json({ ...h, cached: false });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ── 大盘 ──
router.get('/market/summary', async (req, res) => {
  try {
    const cached = cacheGet('market:summary');
    const maxAge = Number(req.query.maxAge || 60); // 秒
    if (cached && Date.now() - new Date(cached.updatedAt).getTime() < maxAge * 1000) {
      return res.json({ ...cached.payload, cached: true });
    }
    const m = await marketSummary();
    cacheSet('market:summary', m, m.source);
    res.json({ ...m, cached: false });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ── 行情（实时快照，缓存20秒——多组件共享去重）──
router.get('/market/quotes', async (req, res) => {
  try {
    const codes = String(req.query.codes || '').split(',').filter(Boolean);
    if (!codes.length) return res.status(400).json({ error: '需要 codes 参数' });
    const key = `quotes:${codes.sort().join(',')}`;
    const r = await withCache(key, 20 * 1000, async () => ({ data: await tdx.quotes(codes), source: 'tdx' }));
    res.json({ data: r.data, cached: r.cached });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// K线（缓存5分钟，按 code+period+count）
router.get('/market/kline', async (req, res) => {
  try {
    const { code, setcode, period = '4', count = '120' } = req.query;
    if (!code) return res.status(400).json({ error: '需要 code 参数' });
    const key = `kline:${code}:${setcode || ''}:${period}:${count}`;
    const r = await withCache(key, 5 * 60 * 1000, async () => ({ data: await tdx.kline(code, { setcode, period, wantNum: count }), source: 'tdx' }));
    res.json({ data: r.data, cached: r.cached });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ── Tushare 透传（受限白名单）──
router.post('/tushare/call', async (req, res) => {
  try {
    const { api_name, params } = req.body || {};
    if (!api_name) return res.status(400).json({ error: '需要 api_name' });
    const data = await tushare.call(api_name, params || {});
    res.json({ data });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ── 观察池 ──
router.get('/watchlist', (req, res) => res.json({ data: watchList() }));
router.post('/watchlist', (req, res) => {
  const { code, name, group_name, note } = req.body || {};
  if (!code) return res.status(400).json({ error: '需要 code' });
  res.json({ data: watchAdd({ code, name, group_name, note }) });
});
router.delete('/watchlist/:code', (req, res) => {
  watchRemove(req.params.code);
  res.json({ ok: true });
});
router.patch('/watchlist/:code', (req, res) => {
  const { name, group_name, note } = req.body || {};
  watchUpdate(req.params.code, { name, group_name, note });
  res.json({ ok: true });
});

// ── 操作记录 ──
router.get('/trades', (req, res) => {
  const { trade_date, code } = req.query;
  res.json({ data: tradeList({ trade_date, code }) });
});
router.post('/trades', (req, res) => {
  const b = req.body || {};
  if (!b.code || !b.side) return res.status(400).json({ error: '需要 code 和 side' });
  const id = tradeAdd({
    trade_date: b.trade_date || new Date().toISOString().slice(0, 10),
    code: b.code, name: b.name, side: b.side, price: b.price, shares: b.shares,
    amount: b.amount, note: b.note, mode: b.mode,
  });
  res.json({ id });
});
router.patch('/trades/:id/mode', (req, res) => {
  const { mode } = req.body || {};
  res.json({ data: tradeUpdateMode(Number(req.params.id), mode || '') });
});

// ── 复盘归档 ──
router.get('/review', (req, res) => res.json({ data: reviewList() }));
router.get('/review/:trade_date', (req, res) => {
  const r = reviewGet(req.params.trade_date);
  if (!r) return res.status(404).json({ error: '未找到' });
  res.json({ data: r });
});
router.post('/review', (req, res) => {
  const { trade_date, summary, plan, data } = req.body || {};
  if (!trade_date) return res.status(400).json({ error: '需要 trade_date' });
  reviewSave({ trade_date, summary, plan, data });
  res.json({ ok: true });
});

// ── 状态 ──
router.get('/status', (req, res) => res.json({ ...schedulerStatus(), now: new Date().toISOString() }));

// ═ 核心股池 ═
const CORE_SEED = [
  // 反弹核心
  ['rebound', '半导体材料', '688146', '中船特气'],
  ['rebound', '半导体材料', '688549', '中巨芯'],
  ['rebound', '半导体材料', '688596', '正帆科技'],
  ['rebound', '半导体材料', '688432', '有研硅'],
  ['rebound', '半导体材料', '600206', '有研新材'],
  ['rebound', '半导体材料', '002428', '云南锗业'],
  ['rebound', '半导体材料', '600397', '江钨装备'],
  ['rebound', '半导体材料', '603928', '兴业股份'],
  ['rebound', 'PCB', '002552', '宝鼎科技'],
  ['rebound', 'PCB', '301377', '鼎泰高科'],
  ['rebound', 'PCB', '301526', '国际复材'],
  ['rebound', 'MLCC', '000636', '风华高科'],
  ['rebound', 'IDC', '603629', '利通电子'],
  ['rebound', 'IDC', '301396', '宏景科技'],
  ['rebound', 'IDC', '300857', '协创数据'],
  ['rebound', 'IDC', '000815', '美利云'],
  ['rebound', '光', '001267', '汇绿生态'],
  ['rebound', '光', '002957', '科瑞技术'],
  // 机构核心
  ['inst', '光模块', '300308', '中际旭创'],
  ['inst', 'PCB', '002384', '东山精密'],
  ['inst', 'PCB', '002463', '沪电股份'],
  ['inst', 'PCB', '603256', '宏和科技'],
  ['inst', '算力', '601138', '工业富联'],
  ['inst', '算力', '688256', '寒武纪'],
  ['inst', '存储', '001309', '德明利'],
  ['inst', '存储', '301308', '江波龙'],
  ['inst', '半导体', '688981', '中芯国际'],
  ['inst', '半导体设备', '300604', '长川科技'],
  ['inst', '半导体', '688347', '华虹公司'],
  ['inst', '封测', '002185', '华天科技'],
  // 情绪核心
  ['emotion', '医药', '600721', '百花医药'],
  ['emotion', 'AI应用', '003032', '传智教育'],
  ['emotion', '消费', '605179', '一鸣食品'],
];
router.get('/core', (req, res) => {
  const cur = coreList();
  if (!cur.length) {
    for (const [type, sector, code, name] of CORE_SEED) coreUpsert({ type, sector, code, name });
    return res.json({ data: coreList(), seeded: true });
  }
  res.json({ data: cur });
});
router.post('/core', (req, res) => {
  const { type, sector, code, name, note, sort } = req.body || {};
  if (!type || !code) return res.status(400).json({ error: '需要 type 和 code' });
  res.json({ data: coreUpsert({ type, sector, code, name, note, sort }) });
});
router.delete('/core/:type/:code', (req, res) => {
  res.json({ data: coreRemove(req.params.type, req.params.code) });
});

// ═ 情绪节点 ═
router.get('/nodes', (req, res) => res.json({ data: nodeList() }));
router.post('/nodes', (req, res) => {
  const { node_date, label, kind, desc } = req.body || {};
  if (!node_date || !label) return res.status(400).json({ error: '需要 node_date 和 label' });
  res.json({ data: nodeUpsert({ node_date, label, kind, desc }) });
});
router.delete('/nodes/:id', (req, res) => {
  res.json({ data: nodeRemove(Number(req.params.id)) });
});

// ═ 买卖计划（盘前预期）═
router.get('/plans', (req, res) => {
  const { trade_date } = req.query;
  res.json({ data: trade_date ? planList(String(trade_date).replace(/-/g, '')) : planAll() });
});
router.post('/plans', (req, res) => {
  const b = req.body || {};
  if (!b.trade_date || !b.side || !b.code) return res.status(400).json({ error: '需要 trade_date/side/code' });
  const d = String(b.trade_date).replace(/-/g, '');
  const list = planAdd({ trade_date: d, side: b.side, code: b.code, name: b.name, mode: b.mode, logic: b.logic, tp: b.tp, sl: b.sl, status: b.status });
  // 买入计划默认加入自选（盘前预案→核心跟踪模块呈现）
  if (b.side === 'buy') watchAdd({ code: b.code, name: b.name, group_name: '买入计划', note: `${d} ${b.mode || ''}`.trim() });
  res.json({ data: list });
});
router.patch('/plans/:id', (req, res) => {
  const { mode, logic, tp, sl, status, name, code } = req.body || {};
  res.json({ data: planUpdate(Number(req.params.id), { mode, logic, tp, sl, status, name, code }) });
});
router.delete('/plans/:id', (req, res) => {
  res.json({ data: planDelete(Number(req.params.id)) });
});

// ═ 按日期自选观察（每日≤10只）═
router.get('/watch-items', (req, res) => {
  const { trade_date } = req.query;
  res.json({ data: trade_date ? watchItemList(String(trade_date).replace(/-/g, '')) : watchItemAll() });
});
router.post('/watch-items', (req, res) => {
  const b = req.body || {};
  if (!b.trade_date || !b.code) return res.status(400).json({ error: '需要 trade_date/code' });
  res.json({ data: watchItemAdd({ trade_date: String(b.trade_date).replace(/-/g, ''), code: b.code, name: b.name, sector: b.sector, note: b.note }) });
});
router.delete('/watch-items/:id', (req, res) => {
  res.json({ data: watchItemRemove(Number(req.params.id)) });
});

// ═ 股票搜索（Tushare stock_basic 全市场缓存）═
router.get('/search', async (req, res) => {
  try {
    const kw = String(req.query.kw || '').trim().toUpperCase();
    if (!kw) return res.json({ data: [] });
    const r = await withCache('search:stocks:all', 7 * 24 * 3600 * 1000, async () => {
      const rows = await tushare.call('stock_basic', { list_status: 'L', fields: 'ts_code,symbol,name' });
      return { data: rows.map(x => ({ code: x.symbol, name: x.name, ts: x.ts_code })) };
    });
    const list = r.data.filter(x => x.code.includes(kw) || x.name.includes(kw)).slice(0, 10);
    res.json({ data: list });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ═ 个股对标（K线叠加对比，核心池+自选列表）═
router.get('/compare', async (req, res) => {
  try {
    const codes = String(req.query.codes || '').split(',').filter(Boolean).slice(0, 8);
    if (codes.length < 2) return res.status(400).json({ error: '至少需要2只股票对比' });
    const days = Math.min(Number(req.query.days || 30), 120);
    const key = `compare:${codes.join(',')}:${days}`;
    const r = await withCache(key, 5 * 60 * 1000, async () => {
      const out = [];
      for (const code of codes) {
        try {
          const k = await tdx.kline(code, { period: 4, wantNum: days + 5 });
          const rows = (k.items || []).slice(-days);
          if (!rows.length) continue;
          const base = Number(rows[0].Close) || 1;
          out.push({
            code, name: rows[0].Name || code,
            dates: rows.map(r => String(r.Date)),
            pct: rows.map(r => +(((Number(r.Close) - base) / base) * 100).toFixed(2)),
            close: rows.map(r => Number(r.Close)),
          });
        } catch (e) { console.warn('[compare]', code, e.message); }
      }
      return { data: { series: out, days } };
    });
    res.json({ data: r.data, cached: r.cached });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ═ 信息巡检：当日要闻（新浪财经 7x24，东财降级）═
router.get('/patrol', async (req, res) => {
  try {
    const r = await withCache('patrol:news', 10 * 60 * 1000, async () => {
      // 主源：新浪 7x24 直播
      let items = [];
      try {
        const url = 'https://zhibo.sina.com.cn/api/zhibo/feed?page=1&page_size=30&zhibo_id=152';
        const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const j = await resp.json();
        items = (j?.result?.data?.feed?.list || []).map(n => ({
          title: n.rich_text || '',
          time: new Date(Number(n.create_time) * 1000).toLocaleTimeString('zh-CN', { hour12: false }),
          source: '新浪财经',
          url: '',
        })).filter(n => n.title);
      } catch (e) { console.warn('[patrol] sina fail:', e.message); }
      // 降级：东财快讯
      if (!items.length) {
        try {
          const url = 'https://np-listapi.eastmoney.com/comm/web/getNewsByColumns?client=web&biz=web_724&column=102&order=1&needInteractData=0&page_index=1&page_size=20';
          const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          const j = await resp.json();
          items = (j?.data?.list || []).map(n => ({ title: n.title || '', time: n.showTime || '', source: n.source || '东财', url: n.url || '' }));
        } catch (e) { console.warn('[patrol] eastmoney fail:', e.message); }
      }
      return { data: { items } };
    });
    res.json({ ...r.data, ts: Date.now(), cached: r.cached });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

export default router;

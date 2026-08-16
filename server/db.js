/**
 * SQLite 持久化：观察池 / 操作记录 / 复盘归档 / 数据快照缓存
 * 使用 Node 24 内置 node:sqlite，无需原生编译，云端/本地均可直接运行
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.paths.db), { recursive: true });
fs.mkdirSync(config.paths.cache, { recursive: true });

export const db = new DatabaseSync(config.paths.db);
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  group_name TEXT DEFAULT '默认',
  note TEXT DEFAULT '',
  added_at TEXT DEFAULT (datetime('now','localtime')),
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_date TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT,
  side TEXT NOT NULL,            -- buy / sell
  price REAL,
  shares INTEGER,
  amount REAL,
  note TEXT DEFAULT '',
  mode TEXT DEFAULT '',          -- 操作模式（模式检验用）
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS review_archive (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_date TEXT UNIQUE NOT NULL,
  summary TEXT,                  -- 当日要点（情绪/主线/风险）
  plan TEXT,                     -- 次日预案
  data JSON,                     -- 当日数据快照
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS snapshot_cache (
  key TEXT PRIMARY KEY,
  payload JSON,
  source TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS premkt_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_date TEXT NOT NULL,
  section TEXT NOT NULL,          -- market / strategy / direction / target / holding
  item_key TEXT DEFAULT '',       -- 条目键（方向名/代码等），同日期同 section 内唯一
  payload JSON,                   -- 条目数据
  created_at TEXT DEFAULT (datetime('now','localtime')),
  updated_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(trade_date, section, item_key)
);

-- 每日市场快照（涨跌停/涨跌家数/量能/活跃市值/外盘），图表数据源
CREATE TABLE IF NOT EXISTS daily_stats (
  trade_date TEXT PRIMARY KEY,
  payload JSON,
  updated_at TEXT DEFAULT (datetime('now','localtime'))
);

-- 兼容迁移：老库补列
`);
try { db.exec("ALTER TABLE trades ADD COLUMN mode TEXT DEFAULT ''"); } catch { /* 已存在 */ }
try { db.exec("ALTER TABLE watchlist ADD COLUMN active INTEGER DEFAULT 1"); } catch { /* 已存在 */ }
db.exec(`
-- 核心股池（反弹核心/机构核心/情绪核心）
CREATE TABLE IF NOT EXISTS core_stocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,            -- rebound 反弹核心 / inst 机构核心 / emotion 情绪核心
  sector TEXT DEFAULT '',        -- 板块分类（半导体材料/PCB/MLCC/IDC/光/医药/AI应用/消费…）
  code TEXT NOT NULL,
  name TEXT,
  note TEXT DEFAULT '',
  sort INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(type, code)
);

-- 情绪节点（政策底/市场底/共振开启等周期关键日）
CREATE TABLE IF NOT EXISTS emotion_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_date TEXT NOT NULL,
  label TEXT NOT NULL,           -- 政策底/市场底/二次确认/情绪复苏/共振开启…
  kind TEXT DEFAULT '关键节点',
  desc TEXT DEFAULT '',
  UNIQUE(node_date, label)
);

-- 买卖计划（盘前预期）
CREATE TABLE IF NOT EXISTS trade_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_date TEXT NOT NULL,
  side TEXT NOT NULL,            -- buy / sell
  code TEXT NOT NULL,
  name TEXT,
  mode TEXT DEFAULT '',          -- 买入/卖出模式
  logic TEXT DEFAULT '',         -- 买入/卖出逻辑
  tp TEXT DEFAULT '',            -- 止盈目标（买入）
  sl TEXT DEFAULT '',            -- 止损目标（买入）
  status TEXT DEFAULT 'pending', -- pending / done / cancel
  created_at TEXT DEFAULT (datetime('now','localtime'))
);

-- 按日期的自选观察（每日不超过10只）
CREATE TABLE IF NOT EXISTS watch_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_date TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT,
  sector TEXT DEFAULT '',        -- 板块分类（自定义）
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(trade_date, code)
);
`);

/** 快照缓存：key → 数据，避免盘中反复请求上游 */
export function cacheGet(key) {
  const row = db.prepare('SELECT payload, source, updated_at FROM snapshot_cache WHERE key = ?').get(key);
  return row ? { payload: JSON.parse(row.payload), source: row.source, updatedAt: row.updated_at } : null;
}

export function cacheSet(key, payload, source = '') {
  db.prepare(`
    INSERT INTO snapshot_cache (key, payload, source, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET payload=excluded.payload, source=excluded.source, updated_at=excluded.updated_at
  `).run(key, JSON.stringify(payload), source, new Date().toISOString());
}

// ── 观察池 ──
export function watchAdd({ code, name, group_name = '默认', note = '' }) {
  db.prepare(`
    INSERT INTO watchlist (code, name, group_name, note) VALUES (?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET name=excluded.name, group_name=excluded.group_name, note=excluded.note, active=1
  `).run(code, name || '', group_name, note);
  return watchList();
}

export function watchList() {
  return db.prepare('SELECT * FROM watchlist WHERE active=1 ORDER BY group_name, id').all();
}

export function watchRemove(code) {
  db.prepare('UPDATE watchlist SET active=0 WHERE code = ?').run(code);
}

export function watchUpdate(code, { name, group_name, note }) {
  db.prepare('UPDATE watchlist SET name=COALESCE(?,name), group_name=COALESCE(?,group_name), note=COALESCE(?,note) WHERE code=?')
    .run(name ?? null, group_name ?? null, note ?? null, code);
}

// ── 操作记录 ──
export function tradeAdd({ trade_date, code, name, side, price, shares, amount, note, mode }) {
  const info = db.prepare(`
    INSERT INTO trades (trade_date, code, name, side, price, shares, amount, note, mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(trade_date, code, name || '', side, price ?? null, shares ?? null, amount ?? null, note || '', mode || '');
  return info.lastInsertRowid;
}

export function tradeUpdateMode(id, mode) {
  db.prepare('UPDATE trades SET mode = ? WHERE id = ?').run(mode, id);
  return tradeList();
}

export function tradeList({ trade_date, code } = {}) {
  let sql = 'SELECT * FROM trades WHERE 1=1';
  const args = [];
  if (trade_date) { sql += ' AND trade_date = ?'; args.push(trade_date); }
  if (code) { sql += ' AND code = ?'; args.push(code); }
  sql += ' ORDER BY created_at DESC';
  return db.prepare(sql).all(...args);
}

// ── 复盘归档 ──
export function reviewSave({ trade_date, summary, plan, data }) {
  db.prepare(`
    INSERT INTO review_archive (trade_date, summary, plan, data) VALUES (?, ?, ?, ?)
    ON CONFLICT(trade_date) DO UPDATE SET summary=excluded.summary, plan=excluded.plan, data=excluded.data
  `).run(trade_date, summary || '', plan || '', JSON.stringify(data || {}));
}

export function reviewList() {
  return db.prepare('SELECT id, trade_date, summary, plan, created_at FROM review_archive ORDER BY trade_date DESC LIMIT 60').all();
}

export function reviewGet(trade_date) {
  const row = db.prepare('SELECT * FROM review_archive WHERE trade_date = ?').get(trade_date);
  return row ? { ...row, data: JSON.parse(row.data || '{}') } : null;
}

// ── 盘前预案 ──
export function premktList(trade_date) {
  const rows = db.prepare('SELECT * FROM premkt_plan WHERE trade_date = ? ORDER BY section, id').all(trade_date);
  return rows.map(r => ({ ...r, payload: JSON.parse(r.payload || '{}') }));
}

export function premktDates() {
  return db.prepare('SELECT DISTINCT trade_date FROM premkt_plan ORDER BY trade_date DESC LIMIT 30').all().map(r => r.trade_date);
}

export function premktUpsert({ trade_date, section, item_key, payload }) {
  db.prepare(`
    INSERT INTO premkt_plan (trade_date, section, item_key, payload) VALUES (?, ?, ?, ?)
    ON CONFLICT(trade_date, section, item_key) DO UPDATE SET
      payload=excluded.payload, updated_at=datetime('now','localtime')
  `).run(trade_date, section, item_key || '', JSON.stringify(payload || {}));
  return premktList(trade_date);
}

export function premktDelete(id) {
  const row = db.prepare('SELECT trade_date FROM premkt_plan WHERE id = ?').get(id);
  db.prepare('DELETE FROM premkt_plan WHERE id = ?').run(id);
  return row ? row.trade_date : null;
}

/** 复制某日预案到另一日（同 section 覆盖，保留 item_key） */
export function premktCopy(fromDate, toDate) {
  const rows = db.prepare('SELECT section, item_key, payload FROM premkt_plan WHERE trade_date = ?').all(fromDate);
  const tx = db.prepare(`
    INSERT INTO premkt_plan (trade_date, section, item_key, payload) VALUES (?, ?, ?, ?)
    ON CONFLICT(trade_date, section, item_key) DO UPDATE SET
      payload=excluded.payload, updated_at=datetime('now','localtime')
  `);
  db.exec('BEGIN');
  try {
    for (const r of rows) tx.run(toDate, r.section, r.item_key, r.payload);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return premktList(toDate);
}

// ── 每日市场快照 ──
export function statsSave(tradeDate, payload) {
  db.prepare(`
    INSERT INTO daily_stats (trade_date, payload) VALUES (?, ?)
    ON CONFLICT(trade_date) DO UPDATE SET payload=excluded.payload, updated_at=datetime('now','localtime')
  `).run(tradeDate, JSON.stringify(payload));
}

export function statsList(days = 10) {
  const rows = db.prepare('SELECT trade_date, payload FROM daily_stats ORDER BY trade_date DESC LIMIT ?').all(days);
  return rows.reverse().map(r => ({ date: r.trade_date, ...JSON.parse(r.payload || '{}') }));
}

// ── 核心股池 ──
export function coreList() {
  return db.prepare('SELECT * FROM core_stocks WHERE active=1 ORDER BY type, sort, id').all();
}
export function coreUpsert({ type, sector, code, name, note = '', sort = 0 }) {
  db.prepare(`
    INSERT INTO core_stocks (type, sector, code, name, note, sort) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(type, code) DO UPDATE SET sector=excluded.sector, name=excluded.name, note=excluded.note, sort=excluded.sort, active=1
  `).run(type, sector || '', code, name || '', note, sort);
  return coreList();
}
export function coreRemove(type, code) {
  db.prepare('UPDATE core_stocks SET active=0 WHERE type=? AND code=?').run(type, code);
  return coreList();
}

// ── 情绪节点 ──
export function nodeList() {
  return db.prepare('SELECT * FROM emotion_nodes ORDER BY node_date').all();
}
export function nodeUpsert({ node_date, label, kind = '关键节点', desc = '' }) {
  db.prepare(`
    INSERT INTO emotion_nodes (node_date, label, kind, desc) VALUES (?, ?, ?, ?)
    ON CONFLICT(node_date, label) DO UPDATE SET kind=excluded.kind, desc=excluded.desc
  `).run(node_date, label, kind, desc);
  return nodeList();
}
export function nodeRemove(id) {
  db.prepare('DELETE FROM emotion_nodes WHERE id = ?').run(id);
  return nodeList();
}

// ── 买卖计划 ──
export function planList(trade_date) {
  return db.prepare('SELECT * FROM trade_plans WHERE trade_date = ? ORDER BY side, id').all(trade_date);
}
export function planDates() {
  return db.prepare('SELECT DISTINCT trade_date FROM trade_plans ORDER BY trade_date DESC LIMIT 30').all().map(r => r.trade_date);
}
export function planAdd({ trade_date, side, code, name, mode = '', logic = '', tp = '', sl = '', status = 'pending' }) {
  db.prepare(`
    INSERT INTO trade_plans (trade_date, side, code, name, mode, logic, tp, sl, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(trade_date, side, code, name || '', mode, logic, tp, sl, status);
  return planList(trade_date);
}
export function planUpdate(id, patch) {
  const keys = Object.keys(patch);
  if (!keys.length) return planAll();
  const sets = keys.map(k => `${k}=?`).join(',');
  db.prepare(`UPDATE trade_plans SET ${sets} WHERE id=?`).run(...keys.map(k => patch[k]), id);
  return planAll();
}
export function planAll() {
  return db.prepare('SELECT * FROM trade_plans ORDER BY trade_date DESC, side, id').all();
}
export function planDelete(id) {
  db.prepare('DELETE FROM trade_plans WHERE id = ?').run(id);
  return planAll();
}

// ── 按日期自选观察 ──
export function watchItemList(trade_date) {
  return db.prepare('SELECT * FROM watch_items WHERE trade_date = ? ORDER BY id').all(trade_date);
}
export function watchItemDates() {
  return db.prepare('SELECT DISTINCT trade_date FROM watch_items ORDER BY trade_date DESC LIMIT 30').all().map(r => r.trade_date);
}
export function watchItemAdd({ trade_date, code, name, sector = '', note = '' }) {
  db.prepare(`
    INSERT INTO watch_items (trade_date, code, name, sector, note) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(trade_date, code) DO UPDATE SET name=excluded.name, sector=excluded.sector, note=excluded.note
  `).run(trade_date, code, name || '', sector, note);
  return watchItemList(trade_date);
}
export function watchItemRemove(id) {
  db.prepare('DELETE FROM watch_items WHERE id = ?').run(id);
  return watchItemAll();
}
export function watchItemAll() {
  return db.prepare('SELECT * FROM watch_items ORDER BY trade_date DESC, id').all();
}

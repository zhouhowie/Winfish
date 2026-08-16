// 补齐 2026 年 daily_stats 的 turnover（量能）字段
import * as tdx from '../datasources/tdx.js';
import { db } from '../db.js';

const rows = db.prepare("SELECT trade_date, payload FROM daily_stats WHERE trade_date >= '20260101'").all();
const [sh, sz] = await Promise.all([
  tdx.kline('000001', { setcode: '1', period: '4', wantNum: '230' }),
  tdx.kline('399001', { setcode: '0', period: '4', wantNum: '230' }),
]);
const map = {};
for (const k of [sh, sz]) {
  for (const it of k.items) {
    const d = String(it.Data);
    map[d] = (map[d] || 0) + (Number(it.Amount) || 0);
  }
}
let updated = 0, missing = 0;
for (const r of rows) {
  const amt = map[r.trade_date];
  if (amt == null) { missing++; continue; }
  const p = JSON.parse(r.payload);
  if (p.turnover !== amt) {
    p.turnover = amt;
    db.prepare("UPDATE daily_stats SET payload = ? WHERE trade_date = ?").run(JSON.stringify(p), r.trade_date);
    updated++;
  }
}
console.log(`量能补齐: 更新 ${updated} 天, 缺失 ${missing} 天`);
// 抽样验证
const sample = db.prepare("SELECT trade_date, payload FROM daily_stats WHERE trade_date >= '20260101' ORDER BY trade_date LIMIT 3").all();
for (const s of sample) {
  const p = JSON.parse(s.payload);
  console.log(s.trade_date, '量能', p.turnover ? (p.turnover / 1e12).toFixed(2) + '万亿' : 'null');
}

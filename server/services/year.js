/**
 * 年度走势数据聚合（今年 1/1 起）
 * 指数/量能：tdxhub 日K；活跃市值：0AMV 本地文件；涨跌家数/涨跌停：daily_stats
 */
import fs from 'fs';
import * as tdx from '../datasources/tdx.js';
import { db } from '../db.js';

const AMV_CSV = process.env.AMV_CSV || 'F:/Compass/WavMain/ANALYSE/Data/ChinaStk/Z_SK/0AMV_base.csv';
const YEAR_START = '20260101';

export async function yearData() {
  const [sh, sz, cyb, kc50] = await Promise.all([
    tdx.kline('000001', { setcode: '1', period: '4', wantNum: '220' }),
    tdx.kline('399001', { setcode: '0', period: '4', wantNum: '220' }),
    tdx.kline('399006', { setcode: '0', period: '4', wantNum: '220' }),
    tdx.kline('000688', { setcode: '1', period: '4', wantNum: '220' }),
  ]);

  // 三指数 K 线（上证/创业板/科创50，完整 OHLC）
  const kline = { sh: [], cyb: [], kc50: [] };
  const byDate = {};
  const convert = (k, arr, key) => {
    for (const it of k.items) {
      const d = String(it.Data);
      if (d < YEAR_START) continue;
      const bar = { date: d, o: Number(it.Open), h: Number(it.High), l: Number(it.Low), c: Number(it.Close) };
      arr.push(bar);
      if (!byDate[d]) byDate[d] = { date: d };
      byDate[d][key] = Number(it.Close);
    }
  };
  convert(sh, kline.sh, 'sh');
  convert(cyb, kline.cyb, 'cyb');
  convert(kc50, kline.kc50, 'kc50');

  // 两市量能（上证+深证 Amount 合计）
  for (const k of [sh, sz]) {
    for (const it of k.items) {
      const d = String(it.Data);
      if (d < YEAR_START) continue;
      if (!byDate[d]) byDate[d] = { date: d };
      byDate[d].amount = (byDate[d].amount || 0) + (Number(it.Amount) || 0);
    }
  }
  const indices = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

  // 活跃市值（本地文件今年起）
  const amv = [];
  if (fs.existsSync(AMV_CSV)) {
    const lines = fs.readFileSync(AMV_CSV, 'utf-8').split(/\r?\n/).filter(Boolean);
    const header = lines[0].split(',');
    const idx = {};
    header.forEach((h, i) => idx[h.trim()] = i);
    const dateCol = idx.date ?? 0;
    const closeCol = idx.close ?? 1;
    const chgCol = idx.change;
    for (const line of lines.slice(1)) {
      const p = line.split(',');
      const d = p[dateCol]?.trim();
      if (!d || d.replace(/-/g, '') < YEAR_START) continue;
      amv.push({
        date: d.replace(/-/g, ''),
        close: Number(p[closeCol]) || 0,
        change: chgCol != null ? Number(p[chgCol]) || 0 : null,
      });
    }
  }

  // 涨跌家数/涨跌停：daily_stats 今年
  const stats = db.prepare("SELECT trade_date, payload FROM daily_stats WHERE trade_date >= ? ORDER BY trade_date").all(YEAR_START)
    .map(r => ({ date: r.trade_date, ...JSON.parse(r.payload || '{}') }));

  return {
    indices,
    kline,
    amv,
    stats,
    ts: Date.now(),
  };
}

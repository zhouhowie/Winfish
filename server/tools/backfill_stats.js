/**
 * 历史数据回填：将最近 N 个交易日的市场快照补入 daily_stats
 * 数据源：tdxhub（涨跌停历史）+ tushare（涨跌家数全市场）+ tdxhub kline（量能）
 * 用法：node server/tools/backfill_stats.js [天数]
 */
import { config } from '../config.js';
import * as tushare from '../datasources/tushare.js';
import * as tdx from '../datasources/tdx.js';
import { statsSave } from '../db.js';

const days = Number(process.argv[2] || 20);
const fromDateArg = process.argv[3]; // 可选：起始日期 YYYYMMDD，例如 20260101（回填今年）

async function wendaCount(message) {
  const url = `${config.tdxhub.url}?Entry=JNLPSE:wendaQuery`;
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ message, rang: 'AG', pageNo: '1', pageSize: '3' }]),
  });
  const arr = await res.json();
  return Number(arr[0]?.[2]) || 0;
}

async function breadthFromDaily(date) {
  try {
    const rows = await tushare.call('daily', { trade_date: date, fields: 'ts_code,pct_chg' });
    let up = 0, down = 0, flat = 0;
    for (const r of rows) {
      const p = Number(r.pct_chg);
      if (p > 0) up++; else if (p < 0) down++; else flat++;
    }
    return { up, down, flat };
  } catch (e) {
    console.warn(`  [breadth] ${date} 失败:`, e.message);
    return null;
  }
}

async function buildTurnoverMap() {
  const map = {};
  try {
    const [sh, sz] = await Promise.all([
      tdx.kline('000001', { setcode: '1', period: '4', wantNum: '70' }),
      tdx.kline('399001', { setcode: '0', period: '4', wantNum: '70' }),
    ]);
    for (const k of [sh, sz]) {
      for (const it of k.items) {
        const d = String(it.Data);
        map[d] = (map[d] || 0) + (Number(it.Amount) || 0);
      }
    }
  } catch (e) {
    console.warn('[turnover] 失败:', e.message);
  }
  return map;
}

// 最近交易日历
const end = new Date();
const start = new Date(end);
start.setDate(start.getDate() - days * 2);
const fmt = d => d.toISOString().slice(0, 10).replace(/-/g, '');
const cal = await tushare.call('trade_cal', { exchange: 'SSE', start_date: fmt(start), end_date: fmt(end) });
let dates = cal.filter(r => r.is_open === 1).map(r => r.cal_date).slice(-days);
// 指定起始日期时：从该日期到今天的所有交易日（忽略 days 参数）
if (fromDateArg) {
  const calAll = await tushare.call('trade_cal', { exchange: 'SSE', start_date: fromDateArg, end_date: fmt(end) });
  dates = calAll.filter(r => r.is_open === 1).map(r => r.cal_date);
  console.log(`指定起始 ${fromDateArg}，共 ${dates.length} 个交易日`);
}
console.log(`待回填 ${dates.length} 个交易日: ${dates[0]} ~ ${dates[dates.length - 1]}`);
const turnoverMap = await buildTurnoverMap();

for (const date of dates) {
  const dash = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  try {
    const [lu, ld, br] = await Promise.all([
      wendaCount(`${dash} 涨停`),
      wendaCount(`${dash} 跌停`),
      wendaCount(`${dash} 炸板`),
    ]);
    const breadth = await breadthFromDaily(date);
    const amt = turnoverMap[date] || null;
    const payload = {
      limit_up: lu, limit_down: ld, broken: br,
      seal_rate: lu + br > 0 ? +((lu / (lu + br)) * 100).toFixed(1) : null,
      up_count: breadth?.up ?? null,
      down_count: breadth?.down ?? null,
      flat_count: breadth?.flat ?? null,
      turnover: amt,
    };
    statsSave(date, payload);
    console.log(`✅ ${date} 涨停${lu} 跌停${ld} 炸板${br} 涨${breadth?.up} 跌${breadth?.down} 量${amt ? (amt / 1e12).toFixed(2) + '万亿' : '--'}`);
  } catch (e) {
    console.error(`❌ ${date}:`, e.message);
  }
  await new Promise(r => setTimeout(r, 300)); // 限频保护
}

console.log('回填完成');

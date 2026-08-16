/**
 * Tushare 数据源封装（主源）
 * 纯 HTTP API（api.tushare.pro），云端可直连。
 * 120积分免费档白名单：stock_basic / daily / daily_basic / index_daily /
 * trade_cal / monthly / weekly / 宏观利率等
 */
import { config } from '../config.js';
import { resolve } from '../settings.js';

const API_URL = config.tushare.apiUrl;

/** 通用调用：把 tushare 返回的 fields+items 转成对象数组 */
export async function call(apiName, params = {}) {
  const TOKEN = resolve('tushareToken');
  if (!TOKEN) throw new Error('tushare token 未配置（设置页填写或 .env 配置）');
  const body = JSON.stringify({ api_name: apiName, token: TOKEN, params, fields: '' });
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) throw new Error(`tushare HTTP ${res.status}: ${apiName}`);
  const r = await res.json();
  if (r.code !== 0) throw new Error(`tushare ${apiName} 错误: ${r.msg || r.code}`);
  const d = r.data || {};
  const fields = d.fields || [];
  return (d.items || []).map(row => Object.fromEntries(fields.map((f, i) => [f, row[i]])));
}

/** 交易日历 */
export async function tradeCal({ start, end }) {
  return call('trade_cal', { exchange: 'SSE', start_date: start, end_date: end });
}

/** 指数日线（ts_code 如 000001.SH） */
export async function indexDaily(tsCode, { start, end }) {
  return call('index_daily', { ts_code: tsCode, start_date: start, end_date: end });
}

/** 个股日线 */
export async function daily(tsCode, { start, end, limit = 2000 }) {
  const p = { ts_code: tsCode, limit };
  if (start) p.start_date = start;
  if (end) p.end_date = end;
  return call('daily', p);
}

/** 每日指标（PE/PB/换手/市值） */
export async function dailyBasic(tsCode, { tradeDate, start, end }) {
  const p = { ts_code: tsCode };
  if (tradeDate) p.trade_date = tradeDate;
  if (start) p.start_date = start;
  if (end) p.end_date = end;
  return call('daily_basic', p);
}

/** 个股资金流（2000积分，日频） */
export async function moneyflow(tsCode, { tradeDate, start, end }) {
  const p = { ts_code: tsCode };
  if (tradeDate) p.trade_date = tradeDate;
  if (start) p.start_date = start;
  if (end) p.end_date = end;
  return call('moneyflow', p);
}

/** 股票列表 */
export async function stockBasic() {
  return call('stock_basic', { list_status: 'L' });
}

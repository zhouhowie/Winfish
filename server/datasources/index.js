/**
 * 数据源统一入口：优先级 + 自动降级
 * 主源: tdx (tdxhub) → tushare → 备用: wudao
 * 每个接口方法都返回 { source, data, ts }，data 为标准化结构。
 */
import * as tdx from './tdx.js';
import * as tushare from './tushare.js';
import * as wudao from './wudao.js';

/** 指数行情标准化：输入 tdx quote，输出统一结构 */
function normIndexQuote(raw) {
  const h = raw?.HQInfo || {};
  const e = raw?.ExtInfo || {};
  return {
    code: raw?.BaseInfo?.Code ?? '',
    name: raw?.BaseInfo?.Name ?? '',
    now: h.Now ?? null,
    open: h.Open ?? null,
    high: h.MaxP ?? null,
    low: h.MinP ?? null,
    preClose: h.Close ?? h.Yield ?? null, // 昨收（个股/指数通用）
    pctChg: h.Now != null && (h.Close || h.Yield) ? +(((h.Now - (h.Close || h.Yield)) / (h.Close || h.Yield)) * 100).toFixed(2) : null, // 涨跌幅(%)
    amount: h.Amount ?? null,  // 成交额(元)
    volume: h.Volume ?? null,
    time: h.HQTime ? `${h.HQDate} ${h.HQTime}` : '',
  };
}

const INDEX_MAP = [
  { key: 'sh', name: '上证指数', code: '000001', setcode: '1' },
  { key: 'sz', name: '深证成指', code: '399001', setcode: '0' },
  { key: 'cyb', name: '创业板指', code: '399006', setcode: '0' },
  { key: 'kc50', name: '科创50', code: '000688', setcode: '1' },
  { key: 'hs300', name: '沪深300', code: '000300', setcode: '1' },
];

/** 大盘指数总览（优先 tdx，失败降级 tushare index_daily） */
export async function marketSummary() {
  const results = {};
  let source = 'tdx';
  try {
    const raw = await tdx.quotes(INDEX_MAP.map(x => `${x.code}.${x.setcode}`), { hasExtInfo: '1' });
    INDEX_MAP.forEach((m, i) => {
      results[m.key] = { ...m, ...normIndexQuote(raw[i]?.data) };
    });
  } catch (e) {
    source = 'tdx-kline';
    console.warn('[marketSummary] tdx quotes 失败，降级 tdx kline:', e.message);
    for (const m of INDEX_MAP) {
      try {
        const k = await tdx.kline(m.code, { setcode: m.setcode, period: '4', wantNum: '3' });
        const row = k.items[k.items.length - 1];
        const prev = k.items[k.items.length - 2];
        if (row) {
          results[m.key] = {
            ...m, now: Number(row.Close), open: Number(row.Open), high: Number(row.High), low: Number(row.Low),
            preClose: prev ? Number(prev.Close) : null,
            pctChg: prev && Number(prev.Close) ? +(((Number(row.Close) - Number(prev.Close)) / Number(prev.Close)) * 100).toFixed(2) : null,
            amount: Number(row.Amount) || null, time: String(row.Data),
          };
        }
      } catch (e2) {
        console.warn(`[marketSummary] ${m.key} kline 降级失败:`, e2.message);
      }
    }
  }
  const sh = results.sh || {};
  const sz = results.sz || {};
  const turnover = sh.amount && sz.amount ? sh.amount + sz.amount : null; // 两市成交额(元)
  return { indices: results, turnover, source, ts: Date.now() };
}

export const datasources = { tdx, tushare, wudao };

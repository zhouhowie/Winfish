/**
 * KG 板块资金流数据源（本地 radar_data_latest.js）
 * OneChart 同源数据：波段流入率(Swing_Ratio_Val) / 加权评分(Swing_Score) / 净额(Amount_Raw_BN,十亿)
 */
import fs from 'fs';
import path from 'path';

const KG_DIR = 'F:/Hanako Workplace/KG资金流';
const KG_FILE = path.join(KG_DIR, 'radar_data_latest.js');

let cache = { latestDate: null, rows: [], loadedAt: 0 };

function load() {
  if (cache.loadedAt && Date.now() - cache.loadedAt < 60_000) return cache;
  try {
    const text = fs.readFileSync(KG_FILE, 'utf-8');
    const m = text.match(/const LATEST_DATE\s*=\s*'([^']+)'/);
    const dataMatch = text.match(/const RADAR_DATA\s*=\s*(\[[\s\S]*\]);?\s*$/);
    if (!dataMatch) throw new Error('RADAR_DATA 解析失败');
    const rows = JSON.parse(dataMatch[1]);
    cache = { latestDate: m?.[1] || null, rows, loadedAt: Date.now() };
  } catch (e) {
    console.warn('[kg] 读取失败:', e.message);
    cache = { latestDate: null, rows: [], loadedAt: Date.now() };
  }
  return cache;
}

/** 当日板块列表（默认 LATEST_DATE） */
export function kgSectors({ type = 'concept', date = null, sort = 'score', limit = 40 } = {}) {
  const { latestDate, rows } = load();
  const target = date || latestDate;
  const typeKw = type === 'industry' ? '行业板块' : '概念板块';
  let list = rows.filter(r => r.trade_date === target && r.type === typeKw);

  const sortKey = sort === 'ratio' ? 'Swing_Ratio_Val' : sort === 'net' ? 'Amount_Raw_BN' : 'Swing_Score';
  list.sort((a, b) => (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0));

  return {
    date: target,
    type,
    total: list.length,
    list: list.slice(0, limit).map((r, i) => ({
      rank: i + 1,
      name: r.index_name.replace(/ \((概念|行业)\)$/, ''),
      pctChg: Number(r.pct_change) ?? null,
      score: Number(r.Swing_Score) ?? null,           // 加权评分
      ratio: Number(r.Swing_Ratio_Val) ?? null,       // 波段流入率(%)
      net: Number(r.Amount_Raw_BN) ?? null,           // 净流入(十亿)
      swingAmt: Number(r.Swing_Amount_Val) ?? null,   // 波段净流入(十亿)
      leadStock: r.lead_stock || r.Lead_Stock || '',  // 龙头
    })),
  };
}

export function kgDates() {
  const { latestDate, rows } = load();
  const dates = [...new Set(rows.map(r => r.trade_date))].sort();
  return { latest: latestDate, dates: dates.slice(-10) };
}

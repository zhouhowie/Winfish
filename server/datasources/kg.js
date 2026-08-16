/**
 * KG 板块资金流数据源（仓库内 data/kg_radar.js）
 * OneChart 同源数据：波段流入率(Swing_Ratio_Val) / 加权评分(Swing_Score) / 净额(Amount_Raw_BN,十亿)
 * 随仓库同步，服务器 clone 即得，无需本地路径
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KG_FILE = path.join(__dirname, '../../data/kg_radar.js');

let cache = { latestDate: null, rows: [], loadedAt: 0 };

function load() {
  if (cache.loadedAt && Date.now() - cache.loadedAt < 60_000) return cache;
  try {
    const text = fs.readFileSync(KG_FILE, 'utf-8');
    const m = text.match(/const KG_RADAR_DATA\s*=\s*(\{[\s\S]*\});?\s*$/);
    if (!m) throw new Error('KG_RADAR_DATA 解析失败');
    const payload = JSON.parse(m[1]);
    cache = { latestDate: payload.latest || null, rows: payload.rows || [], loadedAt: Date.now() };
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
  let list = rows.filter(r => r.d === target && r.t === typeKw);

  const sortKey = sort === 'ratio' ? 'ratio' : sort === 'net' ? 'net' : 'score';
  list.sort((a, b) => (Number(b[sortKey]) || 0) - (Number(a[sortKey]) || 0));

  return {
    date: target,
    type,
    total: list.length,
    list: list.slice(0, limit).map((r, i) => ({
      rank: i + 1,
      name: r.n.replace(/ \((概念|行业)\)$/, ''),
      pctChg: Number(r.pct) ?? null,
      score: Number(r.score) ?? null,           // 加权评分
      ratio: Number(r.ratio) ?? null,           // 波段流入率(%)
      net: Number(r.net) ?? null,               // 净流入(十亿)
      swingAmt: Number(r.swing) ?? null,        // 波段净流入(十亿)
      leadStock: r.lead || '',                  // 龙头
    })),
  };
}

export function kgDates() {
  const { latestDate, rows } = load();
  const dates = [...new Set(rows.map(r => r.d))].sort();
  return { latest: latestDate, dates: dates.slice(-10) };
}

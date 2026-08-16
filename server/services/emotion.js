/**
 * 情绪面板服务：涨停 / 跌停 / 炸板 + 连板梯队 + 涨停主类分布
 * 数据源：tdxhub JNLPSE:wendaQuery（自然语言选股）
 */
import { config } from '../config.js';
import { call as tushareCall } from '../datasources/tushare.js';

const ENDPOINT = config.tdxhub.url;

async function wenda(message, pageSize = 100) {
  const url = `${ENDPOINT}?Entry=JNLPSE:wendaQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([{ message, rang: 'AG', pageNo: '1', pageSize: String(pageSize) }]),
  });
  if (!res.ok) throw new Error(`wenda HTTP ${res.status}`);
  // 注意：此接口返回裸数组（arr[0]=计数行，arr[1]=字段名，arr[2]=统计行，arr[3+]=明细行）
  // 必须用 text()+JSON.parse，直接 res.json() 会解析失败
  const text = await res.text();
  const arr = JSON.parse(text);
  const header = (arr[1] || []).map(s => String(s).replace('#', ''));
  const statRow = arr[2] || [];
  const rows = arr.slice(3);
  return { header, statRow, rows };
}

const NUM_KEYS = new Set(['chg', '封单金额', '涨停成交额(万)', '涨停最大封单额(万)', '封成比', '封单量']);

function toObjects({ header, rows }) {
  return rows.map(r => {
    const o = {};
    header.forEach((k, i) => {
      const v = r[i];
      o[k] = (v !== undefined && v !== null && v !== '') ? v : null;
    });
    return o;
  }).map(r => {
    const out = {};
    for (const [k, v] of Object.entries(r)) {
      out[k] = NUM_KEYS.has(k) && v !== null ? Number(v) : v;
    }
    return out;
  });
}

/** 主类：涨停原因第一个概念标签 */
function primaryTheme(reason) {
  if (!reason) return '其他';
  const first = String(reason).split(/[.·、]/)[0].trim();
  return first || '其他';
}

/** 涨停面板：统计 + 连板梯队 + 主类分布 + 明细 */
export async function emotionPanel() {  const [lu, ld, br] = await Promise.all([
    wenda('涨停', 200),
    wenda('跌停', 100),
    wenda('炸板', 100),
  ]);

  const limitUps = toObjects(lu);
  const limitDowns = toObjects(ld);
  const brokens = toObjects(br);

  const limitUpCount = Number(lu.statRow[2] ?? limitUps.length) || limitUps.length;
  const limitDownCount = Number(ld.statRow[2] ?? limitDowns.length) || limitDowns.length;
  const brokenCount = Number(br.statRow[2] ?? brokens.length) || brokens.length;

  // 连板梯队（按 连续涨停天数 分组）
  const ladder = {};
  for (const s of limitUps) {
    const streak = Number(s['连续涨停天数'] || 1);
    if (!ladder[streak]) ladder[streak] = [];
    ladder[streak].push(s);
  }
  const ladderArr = Object.entries(ladder)
    .map(([k, v]) => ({ streak: Number(k), count: v.length, stocks: v.map(s => ({ code: s.sec_code, name: s.sec_name, pattern: s['板型'], seal: s['封单金额'] })) }))
    .sort((a, b) => b.streak - a.streak);
  const maxStreak = ladderArr.length ? ladderArr[0].streak : 0;

  // 涨停主类分布
  const themeMap = {};
  for (const s of limitUps) {
    const t = primaryTheme(s['涨停原因']);
    themeMap[t] = (themeMap[t] || 0) + 1;
  }
  const themeRank = Object.entries(themeMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // 炸板率 = 炸板 / (涨停 + 炸板)
  const sealRate = limitUpCount + brokenCount > 0
    ? +(limitUpCount / (limitUpCount + brokenCount) * 100).toFixed(1) : 0;

  return {
    date: limitUps[0]?.['发生日期'] || null,
    stats: {
      limitUpCount, limitDownCount, brokenCount,
      sealRate, maxStreak,
      ladderLevels: ladderArr.length,
    },
    ladder: ladderArr,
    themeRank,
    limitUps: limitUps.slice(0, 30),
    limitDowns: limitDowns.slice(0, 15),
    brokens: brokens.slice(0, 15),
    source: 'tdx',
    ts: Date.now(),
  };
}

/**
 * 历史连板数据：从起始日期至今逐日涨停（含连板高度），用于龙头轨迹/晋级率
 * @param {string} from 起始日期 YYYYMMDD（如 20260408）；不传则默认最近 days 天
 */
export async function emotionHistory(days = 14, from = null) {
  const end = new Date();
  const f = d => d.toISOString().slice(0, 10).replace(/-/g, '');
  let startDate = '';
  if (from) {
    startDate = from;
  } else {
    const start = new Date(end);
    start.setDate(start.getDate() - days * 2);
    startDate = f(start);
  }
  const calRows = await tushareCall('trade_cal', { exchange: 'SSE', start_date: startDate, end_date: f(end) });
  const dates = calRows.filter(r => r.is_open === 1).map(r => r.cal_date).slice(0, 200).sort();
  if (from && dates.length > 200) console.warn('[emotionHistory] 超过200个交易日，截断');

  const daily = [];
  for (const date of dates) {
    const dash = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
    try {
      const lu = await wenda(`${dash} 涨停`, 200);
      const ups = toObjects(lu).map(s => ({
        code: s.sec_code, name: s.sec_name,
        streak: Number(s['连续涨停天数'] || 1) || 1,
        reason: String(s['涨停原因'] || ''),
        pattern: String(s['板型'] || ''),
        seal: s['封单金额'] || null,
      }));
      daily.push({ date, count: Number(lu.statRow[2] ?? ups.length) || ups.length, ups });
    } catch (e) {
      console.warn(`[emotionHistory] ${date} 失败:`, e.message);
      daily.push({ date, count: 0, ups: [] });
    }
  }

  // 晋级率：昨日涨停中今日继续连板（streak>=2）的比例
  const rally = daily.map((d, i) => {
    if (i === 0) return { date: d.date, rate: null, promoted: null, prevCount: null };
    const prev = daily[i - 1];
    const prevCodes = new Set(prev.ups.map(u => u.code));
    const promoted = d.ups.filter(u => u.streak >= 2 && prevCodes.has(u.code)).length;
    const rate = prev.count > 0 ? +((promoted / prev.count) * 100).toFixed(1) : null;
    return { date: d.date, rate, promoted, prevCount: prev.count };
  });

  return { dates, daily, rally, ts: Date.now() };
}

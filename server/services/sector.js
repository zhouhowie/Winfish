/**
 * 板块资金流（东财 push2delay）
 * 行业板块 m:90+t:2 / 概念板块 m:90+t:3，按主力净流入排序
 */
const UA = { 'User-Agent': 'Mozilla/5.0', Referer: 'https://quote.eastmoney.com/' };

const FIELDS = 'f12,f14,f2,f3,f62,f184,f66,f69,f72,f75'; // 代码,名称,最新,涨幅,主力净流入,主力净占比,超大单,大单,中单,小单

export async function sectorFlow({ type = 'industry', pz = 30, sortBy = 'f62' } = {}) {
  const fs = type === 'concept' ? 'm:90+t:3' : 'm:90+t:2';
  const url = `https://push2delay.eastmoney.com/api/qt/clist/get?pn=1&pz=${pz}&po=1&np=1&fltt=2&invt=2&fid=${sortBy}&fs=${fs}&fields=${FIELDS}`;
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000) });
  const j = await r.json();
  const list = (j?.data?.diff || []).map(d => ({
    code: d.f12, name: d.f14,
    price: d.f2, pctChg: d.f3,
    mainNet: d.f62,          // 主力净流入(元)
    mainPct: d.f184,         // 主力净占比(%)
    superNet: d.f66,         // 超大单净流入
    bigNet: d.f69,           // 大单净流入
    midNet: d.f72,
    smallNet: d.f75,
  }));
  return { type, total: j?.data?.total || 0, list, ts: Date.now() };
}

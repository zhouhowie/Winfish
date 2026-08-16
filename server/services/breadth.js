/**
 * 市场宽度：涨跌家数（东财 ulist f104/f105/f106）
 * 上证 + 深证 合计
 */
const UA = { 'User-Agent': 'Mozilla/5.0', Referer: 'https://quote.eastmoney.com/' };

export async function marketBreadth() {
  const url = 'https://push2delay.eastmoney.com/api/qt/ulist.np/get?secids=1.000001,0.399001&fields=f1,f2,f3,f12,f14,f104,f105,f106';
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000) });
  const j = await r.json();
  const list = j?.data?.diff || [];
  let up = 0, down = 0, flat = 0;
  for (const d of list) {
    up += Number(d.f104) || 0;
    down += Number(d.f105) || 0;
    flat += Number(d.f106) || 0;
  }
  return { up, down, flat, total: up + down + flat, ts: Date.now() };
}

/**
 * 外盘数据（东财 push2delay）
 * 1) 全球指数：道指/纳指/日经/KOSPI/恒生（日K，最近两根算涨跌）
 * 2) 美股：七姐妹 + 费城半导体(SOXX) + MU + LITE（实时快照）
 * 3) COMEX 黄金期货
 */
const UA = { 'User-Agent': 'Mozilla/5.0', Referer: 'https://quote.eastmoney.com/' };

const INDICES = [
  { key: 'dji', name: '道琼斯', secid: '100.DJIA' },
  { key: 'ndx', name: '纳斯达克', secid: '100.NDX' },
  { key: 'n225', name: '日经225', secid: '100.N225' },
  { key: 'ks11', name: '韩国KOSPI', secid: '100.KS11' },
  { key: 'hsi', name: '恒生指数', secid: '100.HSI' },
];

// 美股：七姐妹 + 费半(SOXX) + MU + LITE
const US_STOCKS = [
  { key: 'aapl', name: '苹果', secid: '105.AAPL' },
  { key: 'msft', name: '微软', secid: '105.MSFT' },
  { key: 'googl', name: '谷歌', secid: '105.GOOGL' },
  { key: 'amzn', name: '亚马逊', secid: '105.AMZN' },
  { key: 'nvda', name: '英伟达', secid: '105.NVDA' },
  { key: 'meta', name: 'Meta', secid: '105.META' },
  { key: 'tsla', name: '特斯拉', secid: '105.TSLA' },
  { key: 'soxx', name: '费城半导体', secid: '105.SOXX' },
  { key: 'mu', name: '美光', secid: '105.MU' },
  { key: 'lite', name: 'Lumentum', secid: '105.LITE' },
];

const GOLD = { key: 'gold', name: 'COMEX黄金', secid: '101.GC00Y' };

/** 美股/黄金快照：f43价格(×10^f59) f170涨跌幅(×100) */
async function snapshot(secid) {
  const url = `https://push2delay.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f57,f58,f59,f170`;
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000) });
  const j = await r.json();
  const d = j?.data;
  if (!d) return null;
  const prec = Number(d.f59) || 0;
  return {
    code: d.f57,
    name: d.f58,
    price: Number(d.f43) / Math.pow(10, prec),
    pctChg: Number(d.f170) / 100,
  };
}

/** 全球指数（快照方式：最新价+涨跌幅，与美股同一接口） */
export async function globalIndices() {
  const out = {};
  for (const idx of INDICES) {
    try {
      const d = await snapshot(idx.secid);
      if (d) out[idx.key] = { ...idx, close: d.price, pctChg: d.pctChg, date: '' };
    } catch (e) {
      console.warn(`[global] 指数 ${idx.key} 失败:`, e.message);
    }
  }
  return out;
}

/** 美股 + 黄金（七姐妹/费半/MU/LITE/COMEX金） */
export async function usSnapshot() {
  const us = {};
  for (const s of US_STOCKS) {
    try {
      const d = await snapshot(s.secid);
      if (d) us[s.key] = { ...s, ...d };
    } catch (e) {
      console.warn(`[global] 美股 ${s.key} 失败:`, e.message);
    }
  }
  let gold = null;
  try {
    const d = await snapshot(GOLD.secid);
    if (d) gold = { ...GOLD, ...d };
  } catch (e) {
    console.warn('[global] 黄金失败:', e.message);
  }
  return { us, gold };
}

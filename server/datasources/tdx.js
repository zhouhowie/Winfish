/**
 * TDX tdxhub 数据源封装（主源）
 * 纯 HTTP 远程 API，云端可直连，不需要本地通达信客户端。
 * 覆盖：实时行情 / 指数 / K线 / F10 / 板块 / 选股
 */
import { config } from '../config.js';

const ENDPOINT = config.tdxhub.url;

async function post(entry, body, timeoutMs = 20000) {
  const url = `${ENDPOINT}?Entry=${encodeURIComponent(entry)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`tdxhub HTTP ${res.status}: ${entry}`);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`tdxhub 非JSON响应: ${entry} → ${text.slice(0, 120)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

/** 实时行情（股票/指数/板块通用） */
export async function quotes(codes, { hasExtInfo = '1' } = {}) {
  if (!Array.isArray(codes)) codes = [codes];
  const results = [];
  for (const c of codes) {
    const [code, setcode = code.startsWith('6') ? '1' : code.startsWith('8') || code.startsWith('4') ? '2' : '0'] = String(c).split('.');
    const body = {
      Head: { Target: '0', CharSet: 'UTF8' },
      Code: code, Setcode: String(setcode),
      HasHQInfo: '1', HasExtInfo: hasExtInfo, BspNum: '0',
      HasProInfo: '0', HasCalcInfo: '0', HasCwInfo: '0', HasStatInfo: '0',
    };
    const r = await post('TdxShare.PBHQInfo', body);
    results.push({ code, setcode, data: r });
  }
  return results;
}

/** K线（period: 0=5分 1=15分 2=30分 3=60分 4=日线 5=周线 6=月线 7=1分） */
export async function kline(code, { setcode, period = '4', wantNum = '120', tqFlag = '11' } = {}) {
  const sc = setcode || (code.startsWith('6') ? '1' : code.startsWith('8') || code.startsWith('4') ? '2' : '0');
  const body = {
    Head: { Target: 0, CharSet: 'UTF8' },
    Code: String(code), Setcode: Number(sc), Period: Number(period),
    StartXH: 0, WantNum: Number(wantNum), TQFlag: Number(tqFlag),
    MPData: 0, HasAttachInfo: 1, HasLtgb: 0, ForRefresh: 0, HasIpoPrice: 0,
  };
  const r = await post('TdxShare.PBFXT', body);
  // 标准化：ItemHead + ListItem → 对象数组
  const head = r?.ListHead?.ItemHead || [];
  const items = (r?.ListItem || []).map(it => {
    const o = {};
    head.forEach((k, i) => { o[k] = it.Item[i]; });
    return o;
  });
  return { code, period, items, raw: r };
}

/** 指数行情（上证/深证/创业板等，走 quotes） */
export async function indexQuotes(codes) {
  return quotes(codes);
}

/** F10 / 题材 / 财务通用接口（entry + Params 数组） */
export async function apiData(entry, paramsArray, timeoutMs = 30000) {
  return post(entry, { Params: paramsArray }, timeoutMs);
}

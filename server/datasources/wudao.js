/**
 * 悟道 A股 MCP 数据源（备用）
 * Streamable HTTP 协议（JSON-RPC over POST），云端可直连。
 * 免费档能力有限，仅在 TDX/Tushare 缺数据时兜底。
 */
import { config } from '../config.js';

const URL = config.wudao.url;
const TOKEN = config.wudao.token;

let _sessionId = null;

async function rpc(method, params) {
  const body = { jsonrpc: '2.0', id: Date.now(), method, params };
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  if (_sessionId) headers['Mcp-Session-Id'] = _sessionId;

  const res = await fetch(URL, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`wudao HTTP ${res.status}`);
  _sessionId = res.headers.get('mcp-session-id') || _sessionId;
  const r = await res.json();
  if (r.error) throw new Error(`wudao rpc error: ${JSON.stringify(r.error)}`);
  return r.result;
}

export async function initialize() {
  await rpc('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'trading-desk', version: '0.1.0' },
  });
}

/** 调用悟道工具 */
export async function callTool(name, args = {}) {
  const result = await rpc('tools/call', { name, arguments: args });
  const content = result?.content || [];
  const text = content.map(c => c.text || '').join('\n');
  try { return JSON.parse(text); } catch { return text; }
}

export async function listTools() {
  const r = await rpc('tools/list', {});
  return r.tools || [];
}

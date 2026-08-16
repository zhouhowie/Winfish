/**
 * 运行时配置持久化（data/config.json）
 * 优先级：环境变量 > config.json > 默认值
 * 用途：换电脑部署时在设置页自助填写 token，无需改 .env
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '..', 'data');

const FILE = path.join(DATA_DIR, 'config.json');

let cache = null;

function load() {
  if (cache) return cache;
  try {
    if (fs.existsSync(FILE)) {
      cache = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
    } else {
      cache = {};
    }
  } catch (e) {
    console.warn('[settings] config.json 读取失败:', e.message);
    cache = {};
  }
  return cache;
}

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[settings] config.json 写入失败:', e.message);
  }
}

/** 合并后的完整配置（仅返回可展示字段，不含敏感值） */
export function getSettings() {
  const s = load();
  return {
    tushare_token_set: !!s.tushareToken,
    wudao_url: s.wudaoUrl || '',
    wudao_token_set: !!s.wudaoToken,
    tdxhub_url: s.tdxhubUrl || '',
    port: s.port || '',
  };
}

/** 更新配置（只更新传入的字段，返回掩码后的状态） */
export function updateSettings(patch) {
  const s = load();
  if (patch.tushareToken !== undefined) s.tushareToken = String(patch.tushareToken).trim();
  if (patch.wudaoUrl !== undefined) s.wudaoUrl = String(patch.wudaoUrl).trim();
  if (patch.wudaoToken !== undefined) s.wudaoToken = String(patch.wudaoToken).trim();
  if (patch.tdxhubUrl !== undefined) s.tdxhubUrl = String(patch.tdxhubUrl).trim();
  if (patch.port !== undefined) s.port = String(patch.port).trim();
  save();
  return getSettings();
}

/** 供数据源动态读取：环境变量优先，其次 config.json */
export function resolve(key) {
  const s = load();
  switch (key) {
    case 'tushareToken': return process.env.TUSHARE_TOKEN || s.tushareToken || '';
    case 'wudaoUrl':     return process.env.WUDAO_MCP_URL || s.wudaoUrl || '';
    case 'wudaoToken':   return process.env.WUDAO_TOKEN || s.wudaoToken || '';
    case 'tdxhubUrl':    return process.env.TDXHUB_URL || s.tdxhubUrl || 'http://tdxhub.icfqs.com:7615/TQLEX';
    default: return '';
  }
}

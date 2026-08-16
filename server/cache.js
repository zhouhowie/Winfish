/**
 * 统一缓存 helper：所有上游数据（tdxhub/tushare/东财/KG）入库缓存，避免重复捞取
 * 底层用 snapshot_cache 表（SQLite 持久化，重启不丢）
 */
import { cacheGet, cacheSet } from './db.js';

/**
 * @param {string} key      缓存键（含参数，如 kline:600519:day:90）
 * @param {number} maxAgeMs 有效期毫秒
 * @param {() => Promise<{data: any, source?: string}>} fetcher 上游拉取函数
 * @returns {Promise<{data: any, cached: boolean, source: string, updatedAt?: string}>}
 */
export async function withCache(key, maxAgeMs, fetcher) {
  const cached = cacheGet(key);
  if (cached && Date.now() - new Date(cached.updatedAt).getTime() < maxAgeMs) {
    return { data: cached.payload, cached: true, source: cached.source, updatedAt: cached.updatedAt };
  }
  const { data, source = '' } = await fetcher();
  cacheSet(key, data, source);
  return { data, cached: false, source, updatedAt: new Date().toISOString() };
}

/** 手动读缓存（不触发上游） */
export function peekCache(key) {
  return cacheGet(key);
}

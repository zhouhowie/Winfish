<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { api, fmtAmount, fmtPct, cls } from '../api.js';

const summary = ref(null);
const status = ref(null);
const error = ref('');
let timer = null;

async function refresh() {
  try {
    summary.value = await api.marketSummary(45);
    error.value = '';
  } catch (e) {
    error.value = e.message;
  }
  try { status.value = await api.status(); } catch {}
}

onMounted(() => {
  refresh();
  timer = setInterval(refresh, 30000); // 30s 轮询
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div class="index-bar">
    <!-- 指数卡片 -->
    <div v-for="idx in (summary?.indices ? Object.values(summary.indices) : [])" :key="idx.key" class="idx card">
      <div class="idx-name">{{ idx.name }}</div>
      <div class="idx-now mono" :class="cls(idx.pctChg)">{{ idx.now != null ? idx.now.toFixed(2) : '--' }}</div>
      <div class="idx-pct mono" :class="cls(idx.pctChg)">{{ fmtPct(idx.pctChg) }}</div>
      <div class="idx-sub muted mono">额 {{ fmtAmount(idx.amount) }}</div>
    </div>

    <!-- 两市成交额 -->
    <div class="idx card turnover">
      <div class="idx-name">两市成交额</div>
      <div class="idx-now mono">{{ fmtAmount(summary?.turnover) }}</div>
      <div class="idx-sub muted">自动刷新</div>
    </div>

    <!-- 刷新状态 -->
    <div class="idx card status-card">
      <div class="idx-name">状态</div>
      <div class="idx-sub">
        <template v-if="status">
          <span :class="status.lastStatus?.ok ? 'up' : 'down'">{{ status.lastStatus?.ok ? '● 数据正常' : '● 数据异常' }}</span>
          <div class="muted">{{ status.inSession ? '盘中 · 自动刷新中' : '非交易时段' }}</div>
          <div class="muted mono" v-if="summary?.ts">更新 {{ new Date(summary.ts).toLocaleTimeString('zh-CN', { hour12: false }) }}</div>
        </template>
        <span v-else class="muted">连接中…</span>
      </div>
      <div class="idx-error muted" v-if="error">⚠ {{ error }}</div>
    </div>
  </div>
</template>

<style scoped>
.index-bar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 12px;
  margin-bottom: 18px;
}
@media (max-width: 1200px) { .index-bar { grid-template-columns: repeat(4, 1fr); } }
@media (max-width: 800px) { .index-bar { grid-template-columns: repeat(2, 1fr); } }

.idx { padding: 12px 14px; }
.idx-name { font-size: 12px; color: var(--ink-2); letter-spacing: 1px; }
.idx-now { font-size: 20px; font-weight: 700; margin: 2px 0; }
.idx-pct { font-size: 14px; font-weight: 600; }
.idx-sub { font-size: 11px; color: var(--ink-2); }
.idx-error { font-size: 11px; color: var(--red); margin-top: 4px; }
.turnover .idx-now { color: var(--accent); }
.status-card .idx-sub { line-height: 1.6; }
</style>

<script setup>
/**
 * 发现 · 市场总览：外盘映射 + 指数与量能 + 活跃市值
 */
import { ref, onMounted, onUnmounted } from 'vue';
import IndexBar from './IndexBar.vue';
import VolumePanel from './VolumePanel.vue';
import { api, fmtPct, cls } from '../api.js';

const globalIdx = ref({});
const amv = ref(null);
const error = ref('');
let timer = null;

async function load() {
  try {
    const g = await api.globalIndices();
    globalIdx.value = g.data || {};
  } catch (e) { error.value = e.message; }
  try {
    const a = await api.amv(10);
    amv.value = a;
  } catch {}
}

onMounted(() => {
  load();
  timer = setInterval(load, 120000);
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div class="ov">
    <!-- 外盘映射 -->
    <div class="card sec">
      <h3>外盘映射 <span class="hint muted">道指/纳指/日经/KOSPI/恒生（昨日收盘）</span></h3>
      <div class="globals">
        <div v-for="g in Object.values(globalIdx)" :key="g.key" class="g card-alt">
          <div class="g-name">{{ g.name }}</div>
          <div class="g-now mono" :class="cls(g.pctChg)">{{ g.close?.toLocaleString() }}</div>
          <div class="g-pct mono" :class="cls(g.pctChg)">{{ fmtPct(g.pctChg) }}</div>
          <div class="g-date muted">{{ g.date }}</div>
        </div>
      </div>
    </div>

    <!-- 指数与量能 -->
    <IndexBar />

    <!-- 活跃市值 -->
    <div class="card sec">
      <h3>活跃市值 <span class="hint muted">0AMV · {{ amv?.source === 'local' ? '本地数据' : '未同步' }}</span></h3>
      <div class="amv-row" v-if="amv?.series?.length">
        <div v-for="a in [...amv.series].reverse().slice(0, 6)" :key="a.date" class="amv card-alt">
          <div class="amv-date muted">{{ a.date.slice(5) }}</div>
          <div class="amv-val mono" :class="cls(a.change)">{{ (a.close / 10000).toFixed(2) }}万点</div>
          <div class="amv-chg mono" :class="cls(a.change)">{{ a.change != null ? fmtPct(a.change) : '--' }}</div>
        </div>
      </div>
      <div class="empty muted" v-else>活跃市值需本地 0AMV 数据（extract_amv.py 更新后推送）</div>
    </div>

    <!-- 量能 -->
    <VolumePanel />
  </div>
</template>

<style scoped>
.ov { display: flex; flex-direction: column; gap: 18px; }
.sec h3 { margin-bottom: 12px; }
.hint { font-size: 11px; font-weight: 400; margin-left: 6px; }

.globals { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.g { border-radius: 10px; padding: 12px 14px; }
.g-name { font-size: 12px; color: var(--ink-2); }
.g-now { font-size: 18px; font-weight: 700; margin: 2px 0; }
.g-pct { font-size: 13px; font-weight: 600; }
.g-date { font-size: 10px; }

.amv-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.amv { border-radius: 10px; padding: 10px 12px; text-align: center; }
.amv-date { font-size: 11px; }
.amv-val { font-size: 16px; font-weight: 700; margin: 2px 0; }
.amv-chg { font-size: 12px; }
.empty { padding: 18px 0; text-align: center; font-size: 13px; }
</style>

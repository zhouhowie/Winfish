<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts/core';
import { CandlestickChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { api } from '../api.js';

echarts.use([CandlestickChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const INDICES = [
  { key: 'sh', name: '上证指数', code: '000001', setcode: '1' },
  { key: 'sz', name: '深证成指', code: '399001', setcode: '0' },
  { key: 'cyb', name: '创业板指', code: '399006', setcode: '0' },
  { key: 'kc50', name: '科创50', code: '000688', setcode: '1' },
  { key: 'hs300', name: '沪深300', code: '000300', setcode: '1' },
];

const activeIdx = ref(0);
const chartEl = ref(null);
const klines = ref([]);
const loading = ref(false);
const error = ref('');
let chart = null;

async function loadKline() {
  const idx = INDICES[activeIdx.value];
  loading.value = true;
  try {
    const r = await api.kline(idx.code, idx.setcode === '1' ? '1' : '0', '4', '90');
    const items = (r.data?.items || []).map(it => ({
      date: it.Data,
      o: Number(it.Open), h: Number(it.High), l: Number(it.Low), c: Number(it.Close),
      vol: Number(it.VolInStock || 0),
    }));
    klines.value = items;
    render();
  } catch (e) { error.value = e.message; }
  loading.value = false;
}

function render() {
  if (!chartEl.value || !klines.value.length) return;
  if (!chart) chart = echarts.init(chartEl.value);
  const idx = INDICES[activeIdx.value];
  const dates = klines.value.map(k => k.date.slice(4));
  const ohlc = klines.value.map(k => [k.o, k.c, k.l, k.h]);
  chart.setOption({
    legend: { top: 0, textStyle: { color: '#5a616c', fontSize: 11 } },
    grid: { left: 60, right: 16, top: 30, bottom: 20 },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'cross' },
      formatter: (ps) => {
        const i = ps[0].dataIndex;
        const k = klines.value[i];
        return `<b>${k.date}</b><br/>开 ${k.o}  收 ${k.c}<br/>高 ${k.h}  低 ${k.l}`;
      },
    },
    xAxis: { type: 'category', data: dates, axisLabel: { color: '#5a616c', fontSize: 10 } },
    yAxis: {
      scale: true,
      axisLabel: { color: '#5a616c', fontSize: 11 },
      splitLine: { lineStyle: { color: '#eceff2' } },
    },
    dataZoom: [{ type: 'inside', start: 40, end: 100 }],
    series: [{
      type: 'candlestick',
      data: ohlc,
      itemStyle: {
        color: '#dc143c', color0: '#228b22',
        borderColor: '#dc143c', borderColor0: '#228b22',
      },
    }],
  });
}

function onResize() { chart && chart.resize(); }
watch(activeIdx, loadKline);

onMounted(() => {
  loadKline();
  const t = setInterval(() => { if (!loading.value) loadKline(); }, 60000);
  window.addEventListener('resize', onResize);
  onUnmounted(() => { clearInterval(t); window.removeEventListener('resize', onResize); chart && chart.dispose(); });
});
</script>

<template>
  <div class="card ikc">
    <div class="head">
      <h3>指数K线</h3>
      <div class="tabs">
        <button v-for="(idx, i) in INDICES" :key="idx.key" class="mini" :class="{ on: activeIdx === i }" @click="activeIdx = i">
          {{ idx.name }}
        </button>
      </div>
    </div>
    <div class="err muted" v-if="error">⚠ {{ error }}</div>
    <div ref="chartEl" class="chart" :class="{ loading }"></div>
  </div>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px; }
.tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.mini { padding: 2px 10px; font-size: 12px; }
.mini.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.err { font-size: 12px; }
.chart { height: 340px; width: 100%; }
.chart.loading { opacity: 0.5; }
</style>

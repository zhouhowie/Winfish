<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { api } from '../api.js';

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const chartEl = ref(null);
const series = ref([]);
const error = ref('');
const days = ref(10);
let chart = null;
let timer = null;

async function load() {
  try {
    const r = await api.volume(days.value);
    series.value = r.series || [];
    error.value = '';
    render();
  } catch (e) { error.value = e.message; }
}

function render() {
  if (!chartEl.value) return;
  if (!chart) chart = echarts.init(chartEl.value);
  const dates = series.value.map(s => s.date.slice(4));
  const amounts = series.value.map(s => +(s.amount / 1e12).toFixed(2)); // 万亿
  chart.setOption({
    grid: { left: 48, right: 16, top: 28, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      formatter: (ps) => {
        const p = ps[0];
        return `${p.axisValue}<br/>两市成交 <b>${p.value} 万亿</b>`;
      },
    },
    xAxis: {
      type: 'category', data: dates,
      axisLine: { lineStyle: { color: '#c9cdd4' } },
      axisLabel: { color: '#5a616c', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      name: '万亿',
      nameTextStyle: { color: '#9aa1ab', fontSize: 10 },
      axisLabel: { color: '#5a616c', fontSize: 11 },
      splitLine: { lineStyle: { color: '#eceff2' } },
    },
    series: [{
      type: 'bar',
      data: amounts,
      barWidth: '55%',
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: (p) => {
          const prev = p.dataIndex > 0 ? amounts[p.dataIndex - 1] : null;
          if (prev == null) return '#1d4ed8';
          return p.value >= prev ? '#dc143c' : '#228b22';
        },
      },
      label: { show: true, position: 'top', color: '#5a616c', fontSize: 10 },
    }],
  });
}

function onResize() { chart && chart.resize(); }

watch(days, load);

onMounted(() => {
  load();
  timer = setInterval(load, 120000);
  window.addEventListener('resize', onResize);
});
onUnmounted(() => {
  clearInterval(timer);
  window.removeEventListener('resize', onResize);
  chart && chart.dispose();
});
</script>

<template>
  <div class="card volume">
    <div class="head">
      <h3>量能 · 两市成交额</h3>
      <div class="controls">
        <button :class="{ on: days === 5 }" @click="days = 5">5日</button>
        <button :class="{ on: days === 10 }" @click="days = 10">10日</button>
        <button :class="{ on: days === 20 }" @click="days = 20">20日</button>
        <span class="sub muted">红=放量 绿=缩量</span>
      </div>
    </div>
    <div class="err muted" v-if="error">⚠ {{ error }}</div>
    <div ref="chartEl" class="chart"></div>
  </div>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.controls { display: flex; align-items: center; gap: 6px; }
.controls button { padding: 2px 10px; font-size: 12px; }
.controls button.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.sub { font-size: 11px; margin-left: 6px; }
.err { font-size: 12px; }
.chart { height: 220px; width: 100%; }
</style>

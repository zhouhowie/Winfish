<script setup>
/**
 * 重点监测：自动同步盘前预案的标的/持仓 + 操盘模式 + 点位
 * 点击股票加载个股日K线
 */
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts/core';
import { CandlestickChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { api, fmtPct, cls } from '../api.js';

echarts.use([CandlestickChart, GridComponent, TooltipComponent, CanvasRenderer]);

const date = ref(new Date().toISOString().slice(0, 10));
const plan = ref(null);   // { strategy, targets, holdings }
const quotes = ref({});
const selected = ref(null); // 当前查看K线的股票
const klineData = ref([]);
const chartEl = ref(null);
const error = ref('');
let chart = null;
let timer = null;

async function load() {
  try {
    const r = await api.premarket(date.value);
    const items = r.items || [];
    const targets = items.filter(i => i.section === 'target').map(i => i.payload);
    const holdings = items.filter(i => i.section === 'holding').map(i => i.payload);
    const strategy = items.find(i => i.section === 'strategy')?.payload || {};
    plan.value = { targets, holdings, strategy };
    await refreshQuotes();
  } catch (e) { error.value = e.message; }
}

async function refreshQuotes() {
  const codes = new Set();
  for (const t of plan.value?.targets || []) if (t.code) codes.add(t.code);
  for (const h of plan.value?.holdings || []) if (h.code) codes.add(h.code);
  if (!codes.size) { quotes.value = {}; return; }
  try {
    const r = await api.quotes([...codes]);
    const map = {};
    for (const q of r.data || []) {
      const h = q.data?.HQInfo || {};
      const b = q.data?.BaseInfo || {};
      map[q.code] = {
        now: h.Now,
        pctChg: h.Now != null && (h.Close || h.Yield) ? +(((h.Now - (h.Close || h.Yield)) / (h.Close || h.Yield)) * 100).toFixed(2) : null,
        name: b.Name || '',
      };
    }
    quotes.value = map;
  } catch {}
}

async function openKline(item) {
  selected.value = item;
  try {
    const setcode = item.code.startsWith('6') ? '1' : '0';
    const r = await api.kline(item.code, setcode, '4', '90');
    klineData.value = (r.data?.items || []).map(it => ({
      date: it.Data, o: Number(it.Open), h: Number(it.High), l: Number(it.Low), c: Number(it.Close),
    }));
    setTimeout(renderKline, 50);
  } catch (e) { error.value = e.message; }
}

function renderKline() {
  if (!chartEl.value || !klineData.value.length) return;
  if (!chart) chart = echarts.init(chartEl.value);
  const dates = klineData.value.map(k => k.date.slice(4));
  const ohlc = klineData.value.map(k => [k.o, k.c, k.l, k.h]);
  chart.setOption({
    grid: { left: 56, right: 12, top: 16, bottom: 18 },
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'cross' },
      formatter: (ps) => {
        const k = klineData.value[ps[0].dataIndex];
        return `<b>${k.date}</b><br/>开 ${k.o} 收 ${k.c}<br/>高 ${k.h} 低 ${k.l}`;
      },
    },
    xAxis: { type: 'category', data: dates, axisLabel: { color: '#5a616c', fontSize: 10 } },
    yAxis: { scale: true, axisLabel: { color: '#5a616c', fontSize: 11 }, splitLine: { lineStyle: { color: '#eceff2' } } },
    dataZoom: [{ type: 'inside', start: 40, end: 100 }],
    series: [{
      type: 'candlestick', data: ohlc,
      itemStyle: { color: '#dc143c', color0: '#228b22', borderColor: '#dc143c', borderColor0: '#228b22' },
      markLine: {
        silent: true,
        symbol: 'none',
        data: [
          ...(selected.value?.buyPrice ? [{ yAxis: Number(selected.value.buyPrice), label: { formatter: `买价 ${selected.value.buyPrice}`, color: '#1d4ed8' }, lineStyle: { color: '#1d4ed8', type: 'dashed' } }] : []),
          ...(selected.value?.stopLoss ? [{ yAxis: Number(selected.value.stopLoss), label: { formatter: `止损 ${selected.value.stopLoss}`, color: '#dc143c' }, lineStyle: { color: '#dc143c', type: 'dashed' } }] : []),
        ],
      },
    }],
  });
}

function onResize() { chart && chart.resize(); }
watch(selected, () => { if (selected.value) openKline(selected.value); });

onMounted(() => {
  load();
  timer = setInterval(() => { refreshQuotes(); }, 30000);
  window.addEventListener('resize', onResize);
});
onUnmounted(() => { clearInterval(timer); window.removeEventListener('resize', onResize); chart && chart.dispose(); });
</script>

<template>
  <div class="card wmc">
    <div class="head">
      <h3>重点监测 <span class="hint muted">（盘前预案自动同步 · {{ date }}）</span></h3>
      <div class="sub muted" v-if="plan?.strategy?.tradeMode">今日模式：<b class="mode-tag">{{ plan.strategy.tradeMode === 'limitup' ? '连板模式' : plan.strategy.tradeMode === 'tail' ? '尾盘2点半' : plan.strategy.tradeMode === 'trend' ? '趋势段' : plan.strategy.tradeMode }}</b></div>
    </div>
    <div class="err muted" v-if="error">⚠ {{ error }}</div>
    <div class="empty muted" v-if="!plan?.targets?.length && !plan?.holdings?.length">盘前预案未添加标的/持仓，先去「盘前预案」添加，这里自动同步监测</div>

    <template v-if="plan?.targets?.length || plan?.holdings?.length">
      <!-- 标的 -->
      <div class="grp" v-if="plan.targets.length">
        <div class="grp-title">预案标的</div>
        <table>
          <thead><tr><th>股票</th><th>方向</th><th>买价</th><th>止损</th><th>现价</th><th>距买价</th><th>状态</th><th></th></tr></thead>
          <tbody>
            <tr v-for="t in plan.targets" :key="t.code">
              <td class="name">{{ quotes[t.code]?.name || t.name }} <span class="muted mono">{{ t.code }}</span></td>
              <td>{{ t.direction }}</td>
              <td class="mono">{{ t.buyPrice ?? '--' }}</td>
              <td class="mono">{{ t.stopLoss ?? '--' }}</td>
              <td class="mono" :class="cls(quotes[t.code]?.pctChg)">{{ quotes[t.code]?.now?.toFixed(2) ?? '--' }}</td>
              <td class="mono" :class="cls(quotes[t.code]?.now && t.buyPrice ? +(((quotes[t.code].now - t.buyPrice) / t.buyPrice) * 100).toFixed(2) : null)">
                {{ quotes[t.code]?.now && t.buyPrice ? fmtPct(+(((quotes[t.code].now - t.buyPrice) / t.buyPrice) * 100).toFixed(2)) : '--' }}
              </td>
              <td>
                <span v-if="t.stopLoss && quotes[t.code]?.now != null && quotes[t.code].now < t.stopLoss" class="badge danger">破位</span>
                <span v-else class="muted">--</span>
              </td>
              <td><button class="mini" @click="openKline(t)">K线</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 持仓 -->
      <div class="grp" v-if="plan.holdings.length">
        <div class="grp-title">持仓监测</div>
        <table>
          <thead><tr><th>股票</th><th>成本</th><th>现价</th><th>盈亏</th><th></th></tr></thead>
          <tbody>
            <tr v-for="h in plan.holdings" :key="h.code">
              <td class="name">{{ quotes[h.code]?.name || h.name }} <span class="muted mono">{{ h.code }}</span></td>
              <td class="mono">{{ h.cost ?? '--' }}</td>
              <td class="mono" :class="cls(quotes[h.code]?.pctChg)">{{ quotes[h.code]?.now?.toFixed(2) ?? '--' }}</td>
              <td class="mono" :class="cls(h.cost && quotes[h.code]?.now ? +(((quotes[h.code].now - h.cost) / h.cost) * 100).toFixed(2) : null)">
                {{ h.cost && quotes[h.code]?.now ? fmtPct(+(((quotes[h.code].now - h.cost) / h.cost) * 100).toFixed(2)) : '--' }}
              </td>
              <td><button class="mini" @click="openKline(h)">K线</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 个股K线 -->
      <div class="kline-box" v-if="selected">
        <div class="kl-head">
          <span class="kl-title">{{ quotes[selected.code]?.name || selected.name }} {{ selected.code }}
            <span v-if="selected.buyPrice" class="muted">买价 {{ selected.buyPrice }}</span>
            <span v-if="selected.stopLoss" class="muted">止损 {{ selected.stopLoss }}</span>
          </span>
          <button class="mini" @click="selected = null">关闭</button>
        </div>
        <div ref="chartEl" class="chart"></div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px; }
.hint { font-size: 11px; font-weight: 400; margin-left: 6px; }
.mode-tag { color: var(--accent); }
.err { font-size: 12px; }
.empty { padding: 18px 0; text-align: center; font-size: 13px; }
.grp { margin-top: 10px; }
.grp-title { font-size: 12px; font-weight: 600; color: var(--accent); letter-spacing: 1.5px; margin-bottom: 4px; }
.name { font-weight: 600; }
.badge.danger { font-size: 11px; background: rgba(220, 20, 60, 0.12); color: var(--red); padding: 1px 8px; border-radius: 4px; }
.mini { padding: 2px 9px; font-size: 12px; }
.kline-box { margin-top: 14px; border-top: 1px solid var(--line); padding-top: 12px; }
.kl-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.kl-title { font-weight: 600; font-size: 13px; }
.kl-title .muted { font-weight: 400; margin-left: 10px; font-size: 12px; }
.chart { height: 300px; width: 100%; }
</style>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api.js';

const date = ref(new Date().toISOString().slice(0, 10));
const mode = ref('');
const error = ref('');

const MODES = [
  { id: 'limitup', name: '连板模式', desc: '打板/晋级，封板强度优先', color: '#dc143c' },
  { id: 'tail', name: '尾盘2点半模式', desc: '尾盘确认，次日溢价', color: '#1d4ed8' },
  { id: 'trend', name: '趋势段模式', desc: '趋势健康回调低吸', color: '#228b22' },
];

async function load() {
  try {
    const r = await api.premarket(date.value);
    const strategy = (r.items || []).find(i => i.section === 'strategy');
    mode.value = strategy?.payload?.tradeMode || '';
  } catch (e) { error.value = e.message; }
}

async function pick(m) {
  mode.value = m;
  try {
    await api.premarketSave({
      trade_date: date.value,
      section: 'strategy',
      item_key: '_',
      payload: { tradeMode: m },
    });
    error.value = '';
  } catch (e) { error.value = e.message; }
}

onMounted(load);
</script>

<template>
  <div class="card modebar">
    <div class="mb-head">
      <h3>今日下手模式</h3>
      <span class="muted date">{{ date }}</span>
    </div>
    <div class="modes">
      <button v-for="m in MODES" :key="m.id" class="mode" :class="{ on: mode === m.id }"
        :style="mode === m.id ? { borderColor: m.color, background: m.color } : {}"
        @click="pick(m.id)">
        <span class="m-name">{{ m.name }}</span>
        <span class="m-desc">{{ m.desc }}</span>
      </button>
      <span class="muted none" v-if="!mode">盘前未选定，点击选择</span>
    </div>
    <div class="err muted" v-if="error">⚠ {{ error }}</div>
  </div>
</template>

<style scoped>
.modebar { margin-top: 18px; }
.mb-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px; }
.mb-head h3 { margin-bottom: 0; }
.date { font-size: 12px; }
.modes { display: flex; gap: 10px; flex-wrap: wrap; }
.mode {
  flex: 1; min-width: 200px;
  display: flex; flex-direction: column; gap: 2px;
  padding: 12px 16px; border-radius: 10px; text-align: left;
  border: 1.5px solid var(--line); background: var(--card-alt);
}
.mode.on { color: #fff; }
.m-name { font-size: 14px; font-weight: 700; }
.m-desc { font-size: 11px; opacity: 0.85; }
.none { font-size: 12px; align-self: center; }
.err { font-size: 12px; margin-top: 8px; }
</style>

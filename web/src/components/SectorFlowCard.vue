<script setup>
import { ref, onMounted } from 'vue';
import { api, fmtAmount, fmtPct, cls } from '../api.js';

const type = ref('industry'); // industry / concept
const list = ref([]);
const error = ref('');
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const r = await api.sectorFlow(type.value, 30);
    list.value = r.list || [];
    error.value = '';
  } catch (e) { error.value = e.message; }
  loading.value = false;
}

function switchType(t) { type.value = t; load(); }
onMounted(load);
</script>

<template>
  <div class="card sfc">
    <div class="head">
      <h3>板块资金流</h3>
      <div class="tabs">
        <button class="mini" :class="{ on: type === 'industry' }" @click="switchType('industry')">行业</button>
        <button class="mini" :class="{ on: type === 'concept' }" @click="switchType('concept')">概念</button>
      </div>
    </div>
    <div class="err muted" v-if="error">⚠ {{ error }}</div>
    <div class="tbl-wrap" v-if="list.length">
      <table>
        <thead>
          <tr><th>板块</th><th>涨幅</th><th>主力净流入</th><th>净占比</th></tr>
        </thead>
        <tbody>
          <tr v-for="s in list" :key="s.code">
            <td class="name">{{ s.name }}</td>
            <td class="mono" :class="cls(s.pctChg)">{{ fmtPct(s.pctChg) }}</td>
            <td class="mono" :class="cls(s.mainNet)">{{ s.mainNet != null ? (s.mainNet > 0 ? '+' : '') + (s.mainNet / 1e8).toFixed(1) + '亿' : '--' }}</td>
            <td class="mono muted">{{ s.mainPct != null ? s.mainPct.toFixed(1) + '%' : '--' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="empty muted" v-else>{{ loading ? '加载中…' : '暂无数据' }}</div>
  </div>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.tabs { display: flex; gap: 4px; }
.mini { padding: 2px 10px; font-size: 12px; }
.mini.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.err { font-size: 12px; }
.tbl-wrap { max-height: 380px; overflow-y: auto; }
.name { font-weight: 600; }
.empty { padding: 20px 0; text-align: center; font-size: 13px; }
</style>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { api, fmtPct, cls, fmtAmount } from '../api.js';

const props = defineProps({ trigger: Number }); // 观察池变更时 ++ 触发刷新

const items = ref([]);   // 观察池（含实时行情）
const quotes = ref({});
const loading = ref(false);
const error = ref('');
const newCode = ref('');
const newName = ref('');
const newGroup = ref('默认');
const groups = ['默认', '核心', '题材', '防御', '游资'];

async function load() {
  try {
    const r = await api.watchlist();
    items.value = r.data || [];
    await refreshQuotes();
  } catch (e) { error.value = e.message; }
}

async function refreshQuotes() {
  const codes = items.value.map(i => i.code);
  if (!codes.length) { quotes.value = {}; return; }
  loading.value = true;
  try {
    const r = await api.quotes(codes);
    const map = {};
    for (const q of r.data || []) {
      const h = q.data?.HQInfo || {};
      const b = q.data?.BaseInfo || {};
      map[q.code] = {
        now: h.Now, pctChg: h.Now != null && (h.Close || h.Yield) ? +(((h.Now - (h.Close || h.Yield)) / (h.Close || h.Yield)) * 100).toFixed(2) : null,
        amount: h.Amount, name: b.Name || '',
      };
    }
    quotes.value = map;
  } catch (e) { error.value = e.message; }
  loading.value = false;
}

async function add() {
  if (!newCode.value.trim()) return;
  try {
    await api.watchAdd({
      code: newCode.value.trim(),
      name: newName.value.trim() || undefined,
      group_name: newGroup.value,
    });
    newCode.value = ''; newName.value = '';
    await load();
  } catch (e) { error.value = e.message; }
}

async function remove(code) {
  await api.watchRemove(code);
  await load();
}

onMounted(load);
watch(() => props.trigger, () => load());
defineExpose({ refresh: load });
</script>

<template>
  <div class="card watchlist">
    <div class="head">
      <h3>观察池</h3>
      <button class="mini" @click="refreshQuotes" :disabled="loading">{{ loading ? '刷新中…' : '刷新行情' }}</button>
    </div>

    <div class="add-row">
      <input v-model="newCode" placeholder="代码，如 600519" class="code-input" />
      <input v-model="newName" placeholder="名称（可空）" class="name-input" />
      <select v-model="newGroup">
        <option v-for="g in groups" :key="g" :value="g">{{ g }}</option>
      </select>
      <button class="primary" @click="add">添加</button>
    </div>

    <div class="err muted" v-if="error">⚠ {{ error }}</div>

    <div class="list" v-if="items.length">
      <div v-for="g in groups" :key="g">
        <div v-if="items.filter(i => i.group_name === g).length" class="group-title">{{ g }}</div>
        <table v-if="items.filter(i => i.group_name === g).length">
          <thead>
            <tr><th>代码</th><th>名称</th><th>现价</th><th>涨跌幅</th><th>成交额</th><th>备注</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="it in items.filter(i => i.group_name === g)" :key="it.code">
              <td class="mono">{{ it.code }}</td>
              <td>{{ quotes[it.code]?.name || it.name || '--' }}</td>
              <td class="mono" :class="cls(quotes[it.code]?.pctChg)">{{ quotes[it.code]?.now?.toFixed(2) ?? '--' }}</td>
              <td class="mono" :class="cls(quotes[it.code]?.pctChg)">{{ fmtPct(quotes[it.code]?.pctChg) }}</td>
              <td class="mono muted">{{ fmtAmount(quotes[it.code]?.amount) }}</td>
              <td class="muted">{{ it.note }}</td>
              <td><button class="mini danger" @click="remove(it.code)">删</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="empty muted" v-else>观察池为空，上方添加股票后自动加载实时行情</div>
  </div>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; }
.head h3 { margin-bottom: 6px; }
.mini { padding: 3px 10px; font-size: 12px; }
.add-row { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.code-input { width: 110px; }
.name-input { width: 130px; }
.err { font-size: 12px; margin-bottom: 8px; }
.group-title {
  font-size: 12px; font-weight: 600; color: var(--accent);
  letter-spacing: 2px; margin: 12px 0 4px; padding-left: 2px;
}
.list { max-height: 480px; overflow-y: auto; }
.empty { padding: 24px 0; text-align: center; font-size: 13px; }
</style>

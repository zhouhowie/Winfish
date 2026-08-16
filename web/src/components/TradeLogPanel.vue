<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api.js';

const rows = ref([]);
const error = ref('');
const form = ref({
  trade_date: new Date().toISOString().slice(0, 10),
  code: '', name: '', side: 'buy', price: null, shares: null, amount: null, note: '',
});

async function load() {
  try {
    const r = await api.trades({ trade_date: form.value.trade_date });
    rows.value = r.data || [];
  } catch (e) { error.value = e.message; }
}

async function submit() {
  if (!form.value.code.trim()) { error.value = '需要代码'; return; }
  try {
    await api.tradeAdd({
      ...form.value,
      code: form.value.code.trim(),
      price: form.value.price ? Number(form.value.price) : null,
      shares: form.value.shares ? Number(form.value.shares) : null,
      amount: form.value.amount ? Number(form.value.amount) : null,
    });
    form.value.code = ''; form.value.price = null; form.value.shares = null; form.value.amount = null; form.value.note = '';
    await load();
    error.value = '';
  } catch (e) { error.value = e.message; }
}

onMounted(load);
</script>

<template>
  <div class="card trade-log">
    <h3>操作记录</h3>

    <div class="form">
      <input type="date" v-model="form.trade_date" @change="load" />
      <select v-model="form.side">
        <option value="buy">买入</option>
        <option value="sell">卖出</option>
      </select>
      <input v-model="form.code" placeholder="代码" class="w80" />
      <input v-model="form.name" placeholder="名称" class="w90" />
      <input v-model.number="form.price" type="number" step="0.01" placeholder="价格" class="w80" />
      <input v-model.number="form.shares" type="number" placeholder="股数" class="w80" />
      <input v-model="form.note" placeholder="备注（可选）" class="w120" />
      <button class="primary" @click="submit">记录</button>
    </div>

    <div class="err muted" v-if="error">⚠ {{ error }}</div>

    <div class="list" v-if="rows.length">
      <table>
        <thead>
          <tr><th>时间</th><th>方向</th><th>代码</th><th>名称</th><th>价格</th><th>股数</th><th>备注</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.id">
            <td class="muted mono">{{ r.created_at?.slice(5, 16) }}</td>
            <td><span class="tag" :class="r.side">{{ r.side === 'buy' ? '买入' : '卖出' }}</span></td>
            <td class="mono">{{ r.code }}</td>
            <td>{{ r.name }}</td>
            <td class="mono">{{ r.price ?? '--' }}</td>
            <td class="mono">{{ r.shares ?? '--' }}</td>
            <td class="muted">{{ r.note }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="empty muted" v-else>当天暂无操作记录</div>
  </div>
</template>

<style scoped>
.form { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.w80 { width: 80px; } .w90 { width: 90px; } .w120 { width: 120px; }
.err { font-size: 12px; margin-bottom: 8px; }
.tag { font-size: 11px; padding: 1px 8px; border-radius: 4px; }
.tag.buy { background: rgba(220, 20, 60, 0.1); color: var(--red); }
.tag.sell { background: rgba(34, 139, 34, 0.1); color: var(--green); }
.list { max-height: 320px; overflow-y: auto; }
.empty { padding: 20px 0; text-align: center; font-size: 13px; }
</style>

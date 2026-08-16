<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api.js';

const list = ref([]);
const error = ref('');
const selected = ref(null);
const editing = ref(false);
const form = ref({ trade_date: '', summary: '', plan: '' });

async function load() {
  try {
    const r = await api.reviews();
    list.value = r.data || [];
  } catch (e) { error.value = e.message; }
}

async function open(d) {
  try {
    const r = await api.reviewGet(d);
    selected.value = r.data;
  } catch (e) { error.value = e.message; }
}

function startNew() {
  editing.value = true;
  selected.value = null;
  form.value = { trade_date: new Date().toISOString().slice(0, 10), summary: '', plan: '' };
}

async function save() {
  if (!form.value.trade_date) return;
  try {
    await api.reviewSave({ trade_date: form.value.trade_date, summary: form.value.summary, plan: form.value.plan });
    editing.value = false; selected.value = null;
    await load();
  } catch (e) { error.value = e.message; }
}

onMounted(load);
</script>

<template>
  <div class="review-grid">
    <!-- 归档列表 -->
    <div class="card">
      <div class="head">
        <h3>复盘归档</h3>
        <button class="primary" @click="startNew">新建复盘</button>
      </div>
      <div class="err muted" v-if="error">⚠ {{ error }}</div>
      <div class="list" v-if="list.length">
        <div v-for="r in list" :key="r.id" class="row" @click="open(r.trade_date)">
          <div class="date mono">{{ r.trade_date }}</div>
          <div class="summary">{{ r.summary || '（无摘要）' }}</div>
        </div>
      </div>
      <div class="empty muted" v-else>暂无归档，点右上角新建</div>
    </div>

    <!-- 详情 / 编辑 -->
    <div class="card detail">
      <template v-if="editing">
        <h3>新建复盘 · {{ form.trade_date }}</h3>
        <div class="form">
          <label>日期</label>
          <input type="date" v-model="form.trade_date" />
          <label>当日要点（情绪/主线/风险）</label>
          <textarea v-model="form.summary" rows="6" placeholder="涨停数、主线、晋级、风险信号…"></textarea>
          <label>次日预案</label>
          <textarea v-model="form.plan" rows="5" placeholder="情形A / 情形B、关注方向、触发与停损…"></textarea>
          <div class="btns">
            <button class="primary" @click="save">保存归档</button>
            <button @click="editing = false">取消</button>
          </div>
        </div>
      </template>
      <template v-else-if="selected">
        <h3>复盘 · {{ selected.trade_date }}</h3>
        <div class="block">
          <div class="label">当日要点</div>
          <pre>{{ selected.summary || '（无）' }}</pre>
        </div>
        <div class="block">
          <div class="label">次日预案</div>
          <pre>{{ selected.plan || '（无）' }}</pre>
        </div>
        <button @click="startNew">新建复盘</button>
      </template>
      <template v-else>
        <div class="placeholder muted">点左侧任意归档查看详情，或新建今日复盘</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.review-grid { display: grid; grid-template-columns: 1fr 1.4fr; gap: 18px; }
@media (max-width: 1000px) { .review-grid { grid-template-columns: 1fr; } }
.head { display: flex; justify-content: space-between; align-items: center; }
.head h3 { margin-bottom: 6px; }
.err { font-size: 12px; margin-bottom: 8px; }
.list { max-height: 560px; overflow-y: auto; }
.row { padding: 10px 4px; border-bottom: 1px solid var(--line); cursor: pointer; }
.row:hover { background: var(--card-alt); }
.date { font-size: 13px; font-weight: 600; }
.summary { font-size: 12px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty, .placeholder { padding: 32px 0; text-align: center; font-size: 13px; }
.form { display: flex; flex-direction: column; gap: 8px; }
.form label { font-size: 12px; color: var(--ink-2); margin-top: 8px; }
.form textarea { resize: vertical; min-height: 80px; line-height: 1.7; }
.btns { display: flex; gap: 10px; margin-top: 12px; }
.block { margin-bottom: 16px; }
.label { font-size: 12px; font-weight: 600; color: var(--accent); letter-spacing: 1px; margin-bottom: 6px; }
pre { white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: 13px; line-height: 1.8; background: var(--card-alt); border-radius: 8px; padding: 12px; }
</style>

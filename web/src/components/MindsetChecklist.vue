<script setup>
/**
 * 核心心法 & 每日检查清单
 * 心法为固定框架（来自交易操作系统），检查清单逐日勾选存档
 */
import { ref, onMounted } from 'vue';
import { api } from '../api.js';

const date = ref(new Date().toISOString().slice(0, 10));
const checked = ref({});
const error = ref('');

// 每日检查清单（可自定义增删，勾选状态按日期存档）
const DEFAULT_CHECKS = [
  '今日情绪周期定位清楚了吗（混沌/主升/盘顶/退潮）？',
  '下手模式是否与周期匹配（连板/尾盘/趋势）？',
  '仓位是否符合盘前预案（总仓上限、单笔止损）？',
  '买入是否符合主线逻辑，而非随意追涨？',
  '止损位是否预先设定并严格执行？',
  '是否避免在非主线/弱势方向恋战？',
  '尾盘2点半前是否确认当日情绪无恶化？',
  '是否做了盘后复盘并写下明日预案？',
];

const MINDSETS = [
  { title: '周期定仓位', text: '混沌期轻仓试错，主升期敢于加仓，盘顶预期降低预期，退潮期休息为主' },
  { title: '主线是生命线', text: '只做当日最强主线，逻辑未失效不轻易离场，不因普通波动下车' },
  { title: '先预案后下手', text: '买价、止损、仓位盘中前写清楚，盘中只执行不临时起意' },
  { title: '让判断冷静', text: '情绪化交易是最大的亏损来源，逆势时先停手，复盘后再动手' },
];

const checks = ref([...DEFAULT_CHECKS]);

async function load() {
  try {
    let data = {};
    try { data = (await api.reviewGet(date.value))?.data?.data || {}; } catch {}
    if (data.checklist) {
      checks.value = data.checklist.items || DEFAULT_CHECKS;
      checked.value = data.checklist.checked || {};
    } else {
      checks.value = [...DEFAULT_CHECKS];
      checked.value = {};
    }
  } catch (e) { error.value = e.message; }
}

async function save() {
  try {
    let existing = null;
    try { existing = (await api.reviewGet(date.value))?.data?.data || {}; } catch {}
    await api.reviewSave({
      trade_date: date.value,
      summary: existing.summary || '',
      plan: existing.plan || '',
      data: { ...existing, checklist: { items: checks.value, checked: checked.value } },
    });
    error.value = '';
  } catch (e) { error.value = e.message; }
}

const newCheck = ref('');
function addCheck() {
  const t = newCheck.value.trim();
  if (!t) return;
  checks.value.push(t);
  newCheck.value = '';
  save();
}
function removeCheck(i) {
  const key = checks.value[i];
  checks.value.splice(i, 1);
  delete checked.value[key];
  save();
}
function toggle(i) {
  const key = checks.value[i];
  checked.value[key] = !checked.value[key];
  save();
}

onMounted(load);
</script>

<template>
  <div class="mindset">
    <div class="card datebar">
      <input type="date" v-model="date" @change="load" />
      <button class="primary" @click="save">保存清单</button>
      <span class="muted">勾选状态按日期独立存档</span>
    </div>
    <div class="err muted" v-if="error">⚠ {{ error }}</div>

    <!-- 核心心法 -->
    <div class="card sec">
      <h3>核心心法</h3>
      <div class="mind-grid">
        <div v-for="m in MINDSETS" :key="m.title" class="mind card-alt">
          <div class="m-title">{{ m.title }}</div>
          <div class="m-text">{{ m.text }}</div>
        </div>
      </div>
    </div>

    <!-- 每日检查清单 -->
    <div class="card sec">
      <h3>每日检查清单</h3>
      <div class="add-row">
        <input v-model="newCheck" placeholder="新增检查项…" @keyup.enter="addCheck" />
        <button class="primary" @click="addCheck">添加</button>
      </div>
      <div class="list">
        <div v-for="(c, i) in checks" :key="c" class="check" :class="{ done: checked[c] }" @click="toggle(i)">
          <span class="box">{{ checked[c] ? '✓' : '' }}</span>
          <span class="text">{{ c }}</span>
          <button class="mini danger" @click.stop="removeCheck(i)">×</button>
        </div>
      </div>
      <div class="progress muted" v-if="checks.length">
        已完成 {{ Object.values(checked).filter(Boolean).length }} / {{ checks.length }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.mindset { display: flex; flex-direction: column; gap: 18px; }
.datebar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.err { font-size: 12px; }
.sec h3 { margin-bottom: 12px; }

.mind-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.mind { border-radius: 10px; padding: 14px; }
.m-title { font-size: 14px; font-weight: 700; color: var(--accent); margin-bottom: 6px; }
.m-text { font-size: 12.5px; color: var(--ink-2); line-height: 1.7; }

.add-row { display: flex; gap: 8px; margin-bottom: 12px; }
.add-row input { flex: 1; max-width: 420px; }

.list { display: flex; flex-direction: column; gap: 6px; }
.check {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; border-radius: 9px; cursor: pointer;
  background: var(--card-alt); border: 1px solid transparent;
  transition: all 0.15s;
}
.check:hover { border-color: var(--line); }
.check.done { opacity: 0.55; }
.check.done .text { text-decoration: line-through; }
.box {
  width: 18px; height: 18px; flex: none; border-radius: 5px;
  border: 1.5px solid #c9cdd4; display: grid; place-items: center;
  font-size: 12px; font-weight: 700; color: #fff; background: transparent;
}
.check.done .box { background: var(--accent); border-color: var(--accent); }
.text { flex: 1; font-size: 13px; }
.mini { padding: 1px 8px; font-size: 11px; }
.progress { font-size: 12px; margin-top: 10px; }
</style>

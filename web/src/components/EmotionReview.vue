<script setup>
/**
 * 盘后情绪复盘 · 矩阵（对应「每日市场情绪复盘」框架）
 * 每日数据（感知温度）→ 所处周期（定位）→ 操作逻辑（决策）
 * 数据自动带入 emotion 面板，周期/逻辑/明日方向人工确认，存入复盘归档
 */
import { ref, onMounted, watch } from 'vue';
import { api, fmtAmount } from '../api.js';

const date = ref(new Date().toISOString().slice(0, 10));
const emotion = ref(null);
const volume = ref(null);
const error = ref('');

const PERIODS = ['混沌期', '确认主升', '盘顶预期', '退潮叠加混沌'];
const LOGICS = ['连板模式', '尾盘2点半模式', '趋势段模式'];

const form = ref({
  period: '',          // 所处周期（定位）
  logic: '',           // 操作逻辑（决策）
  nextDirection: '',   // 明日方向
  note: '',            // 备注
});
const saved = ref(false);

async function loadData() {
  try {
    emotion.value = await api.emotion(600);
    volume.value = await api.volume(5);
  } catch (e) { error.value = e.message; }
}

async function loadSaved() {
  try {
    const r = await api.reviewGet(date.value);
    const d = r?.data?.data;
    if (d?.emotionReview) {
      form.value = { period: '', logic: '', nextDirection: '', note: '', ...d.emotionReview };
      saved.value = true;
    }
  } catch { /* 未归档则跳过 */ }
}

async function save() {
  try {
    let existing = null;
    try { existing = (await api.reviewGet(date.value))?.data?.data || {}; } catch {}
    await api.reviewSave({
      trade_date: date.value,
      summary: existing.summary || '',
      plan: existing.plan || '',
      data: { ...existing, emotionReview: { ...form.value } },
    });
    saved.value = true;
    error.value = '';
  } catch (e) { error.value = e.message; }
}

watch(date, () => { loadData(); loadSaved(); });
onMounted(() => { loadData(); loadSaved(); });
</script>

<template>
  <div class="ev">
    <!-- 日期 -->
    <div class="card datebar">
      <input type="date" v-model="date" />
      <button class="primary" @click="save">{{ saved ? '已保存 ✓' : '保存复盘' }}</button>
      <span class="muted">（数据自动带入当日收盘，人工确认周期与逻辑）</span>
    </div>
    <div class="err muted" v-if="error">⚠ {{ error }}</div>

    <!-- 每日数据 · 感知温度（自动带入） -->
    <div class="card sec">
      <h3>每日数据 <span class="hint muted">感知温度 · 自动带入</span></h3>
      <div class="kpis">
        <div class="kpi"><div class="v up mono">{{ emotion?.stats?.limitUpCount ?? '--' }}</div><div class="k muted">涨停</div></div>
        <div class="kpi"><div class="v down mono">{{ emotion?.stats?.limitDownCount ?? '--' }}</div><div class="k muted">跌停</div></div>
        <div class="kpi"><div class="v flat mono">{{ emotion?.stats?.brokenCount ?? '--' }}</div><div class="k muted">炸板</div></div>
        <div class="kpi"><div class="v mono" :class="(emotion?.stats?.sealRate ?? 0) >= 70 ? 'up' : 'down'">{{ emotion?.stats?.sealRate ?? '--' }}%</div><div class="k muted">封板率</div></div>
        <div class="kpi"><div class="v mono">{{ emotion?.stats?.maxStreak ?? '--' }}板</div><div class="k muted">最高连板</div></div>
        <div class="kpi"><div class="v mono">{{ fmtAmount(volume?.series?.[volume.series.length - 1]?.amount) }}</div><div class="k muted">两市成交</div></div>
      </div>
    </div>

    <!-- 所处周期 · 定位 -->
    <div class="card sec">
      <h3>所处周期 <span class="hint muted">定位 · 龙头的一生</span></h3>
      <div class="cycle">
        <button v-for="p in PERIODS" :key="p" class="cycle-btn" :class="{ on: form.period === p }" @click="form.period = p; saved = false">
          {{ p }}
        </button>
      </div>
      <div class="cycle-flow muted">
        混沌期 → 确认主升 → 盘顶预期 → 退潮叠加混沌 →（循环）
      </div>
    </div>

    <!-- 操作逻辑 · 决策 -->
    <div class="card sec">
      <h3>操作逻辑 <span class="hint muted">决策 · 下手顺序</span></h3>
      <div class="logics">
        <button v-for="l in LOGICS" :key="l" class="logic-btn" :class="{ on: form.logic === l }" @click="form.logic = l; saved = false">{{ l }}</button>
      </div>
      <div class="form-row">
        <label>明日方向</label>
        <input v-model="form.nextDirection" placeholder="如 CPO 光通信 / AI算力，可多个" @input="saved = false" />
      </div>
      <div class="form-row">
        <label>备注</label>
        <textarea v-model="form.note" rows="3" placeholder="今日复盘要点、明日关注、风险提示…" @input="saved = false"></textarea>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ev { display: flex; flex-direction: column; gap: 18px; }
.datebar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.err { font-size: 12px; }
.sec h3 { margin-bottom: 12px; }
.hint { font-size: 11px; font-weight: 400; margin-left: 6px; }

.kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
@media (max-width: 1100px) { .kpis { grid-template-columns: repeat(3, 1fr); } }
.kpi { background: var(--card-alt); border-radius: 10px; padding: 10px 12px; text-align: center; }
.v { font-size: 22px; font-weight: 700; }
.k { font-size: 11px; margin-top: 2px; }

.cycle { display: flex; gap: 10px; flex-wrap: wrap; }
.cycle-btn {
  padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 600;
  background: var(--card-alt); border: 1.5px solid var(--line);
}
.cycle-btn.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.cycle-flow { margin-top: 10px; font-size: 12px; letter-spacing: 1px; }

.logics { display: flex; gap: 10px; flex-wrap: wrap; }
.logic-btn {
  padding: 10px 18px; border-radius: 10px; font-size: 13px; font-weight: 600;
  background: var(--card-alt); border: 1.5px solid var(--line);
}
.logic-btn.on { background: var(--ink); border-color: var(--ink); color: #fff; }

.form-row { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
.form-row label { font-size: 12px; color: var(--ink-2); width: 64px; flex: none; }
.form-row input { flex: 1; }
.form-row textarea { flex: 1; resize: vertical; line-height: 1.7; }
</style>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { api, fmtPct, cls } from '../api.js';


const date = ref(new Date().toISOString().slice(0, 10));
const dates = ref([]);
const items = ref([]);
const quotes = ref({});
const emotion = ref(null);
const error = ref('');
let timer = null;

const DIR_STATUS = ['观察', '验证', '失败'];
const STRATEGY_MODES = ['进攻', '正常', '防守', '不做'];
const MARKET_DIMS = ['市场周期', '市场趋势', '行情结构', '资金信号', '情绪阶段', '资金状态', '择时信号'];
const DIM_OPTIONS = {
  市场周期: ['混沌期', '确认主升', '盘顶预期', '退潮叠加混沌'],
  市场趋势: ['上涨', '震荡', '下跌'],
  行情结构: ['扩散', '收敛', '分化'],
  资金信号: ['流入', '流出', '未判断'],
  情绪阶段: ['冰点', '修复', '发酵', '主升', '退潮'],
  资金状态: ['流入', '流出', '平衡'],
  择时信号: ['进攻', '震荡', '防守'],
};

// ── 按 section 分组 ──
const bySection = computed(() => {
  const g = { market: null, strategy: null, directions: [], targets: [], holdings: [] };
  for (const it of items.value) {
    const p = it.payload;
    if (it.section === 'market') g.market = p;
    else if (it.section === 'strategy') g.strategy = p;
    else if (it.section === 'direction') g.directions.push(p);
    else if (it.section === 'target') g.targets.push(p);
    else if (it.section === 'holding') g.holdings.push(p);
  }
  return g;
});

// 盘中对比：标的 + 持仓的所有代码批量拉实时价
const compareCodes = computed(() => {
  const codes = new Set();
  for (const t of bySection.value.targets) if (t.code) codes.add(t.code);
  for (const h of bySection.value.holdings) if (h.code) codes.add(h.code);
  return [...codes];
});

// 方向今日涨停匹配（涨停原因包含方向关键字）
const directionStats = computed(() => {
  const stats = {};
  const ups = emotion.value?.limitUps || [];
  for (const d of bySection.value.directions) {
    const kw = (d.name || '').toLowerCase();
    if (!kw) continue;
    let n = 0;
    for (const s of ups) {
      const reason = String(s['涨停原因'] || '').toLowerCase();
      const name = String(s.sec_name || '').toLowerCase();
      if (reason.includes(kw) || name.includes(kw)) n++;
    }
    stats[d.name] = n;
  }
  return stats;
});

async function load() {
  try {
    const r = await api.premarket(date.value);
    items.value = r.items || [];
    const d = await api.premarketDates();
    dates.value = d.dates || [];
    error.value = '';
    await Promise.all([refreshQuotes(), loadEmotion()]);
  } catch (e) { error.value = e.message; }
}

async function loadEmotion() {
  try { emotion.value = await api.emotion(600); } catch {}
}

async function refreshQuotes() {
  if (!compareCodes.value.length) { quotes.value = {}; return; }
  try {
    const r = await api.quotes(compareCodes.value);
    const map = {};
    for (const q of r.data || []) {
      const h = q.data?.HQInfo || {};
      const b = q.data?.BaseInfo || {};
      map[q.code] = {
        now: h.Now,
        pre: h.Close || h.Yield,
        pctChg: h.Now != null && (h.Close || h.Yield) ? +(((h.Now - (h.Close || h.Yield)) / (h.Close || h.Yield)) * 100).toFixed(2) : null,
        name: b.Name || '',
      };
    }
    quotes.value = map;
  } catch {}
}

function save(section, itemKey, payload) {
  return api.premarketSave({ trade_date: date.value, section, item_key: itemKey, payload })
    .then(r => { items.value = r.items; })
    .catch(e => { error.value = e.message; });
}

function del(id) {
  api.premarketDelete(id).then(r => { if (r.date === date.value) load(); }).catch(e => { error.value = e.message; });
}

function copyFrom(day) {
  api.premarketCopy(day, date.value)
    .then(() => load())
    .catch(e => { error.value = e.message; });
}

function gotoToday() { date.value = new Date().toISOString().slice(0, 10); load(); }
function gotoPrev() {
  const d = new Date(date.value); d.setDate(d.getDate() - 1);
  date.value = d.toISOString().slice(0, 10); load();
}
function gotoNext() {
  const d = new Date(date.value); d.setDate(d.getDate() + 1);
  date.value = d.toISOString().slice(0, 10); load();
}

// ── 市场观察 ──
function setDim(dim, val) {
  const p = { ...(bySection.value.market || {}), dimensions: { ...(bySection.value.market?.dimensions || {}), [dim]: val } };
  save('market', '_', p);
}

// ── 策略 ──
function setStrategy(patch) {
  save('strategy', '_', { ...(bySection.value.strategy || {}), ...patch });
}

// ── 方向 ──
const newDirName = ref('');
function addDirection() {
  const name = newDirName.value.trim();
  if (!name) return;
  save('direction', name, { name, states: [{ status: '观察', text: '' }] });
  newDirName.value = '';
}
function setDirState(d, i, field, val) {
  const states = d.states.map((s, idx) => idx === i ? { ...s, [field]: val } : s);
  save('direction', d.name, { ...d, states });
}
function addDirState(d) {
  save('direction', d.name, { ...d, states: [...d.states, { status: '验证', text: '' }] });
}
function removeDirState(d, i) {
  const states = d.states.filter((_, idx) => idx !== i);
  save('direction', d.name, { ...d, states });
}
function dirItemId(name) {
  const it = items.value.find(i => i.section === 'direction' && i.item_key === name);
  return it?.id;
}

// ── 标的预案 ──
const newTarget = ref({ code: '', name: '', direction: '', plan: '趋势健康回调', buyPrice: null, stopLoss: null, focus: '' });
function addTarget() {
  const code = newTarget.value.code.trim();
  if (!code) return;
  save('target', code, { ...newTarget.value, code, buyPrice: newTarget.value.buyPrice ? Number(newTarget.value.buyPrice) : null, stopLoss: newTarget.value.stopLoss ? Number(newTarget.value.stopLoss) : null });
  newTarget.value = { code: '', name: '', direction: '', plan: '趋势健康回调', buyPrice: null, stopLoss: null, focus: '' };
}
function tQuote(t) { return quotes.value[t.code]; }
function tDistBuy(t) {
  const q = tQuote(t);
  if (!q || !q.now || !t.buyPrice) return null;
  return +((q.now - t.buyPrice) / t.buyPrice * 100).toFixed(2);
}
function tBreakStop(t) {
  const q = tQuote(t);
  return q && t.stopLoss && q.now != null && q.now < t.stopLoss;
}

// ── 持仓计划 ──
const newHolding = ref({ code: '', name: '', cost: null, pos: null, action: '持有', condition: '' });
function addHolding() {
  const code = newHolding.value.code.trim();
  if (!code) return;
  save('holding', code, { ...newHolding.value, code, cost: newHolding.value.cost ? Number(newHolding.value.cost) : null, pos: newHolding.value.pos ? Number(newHolding.value.pos) : null });
  newHolding.value = { code: '', name: '', cost: null, pos: null, action: '持有', condition: '' };
}
function hQuote(h) { return quotes.value[h.code]; }
function hPnl(h) {
  const q = hQuote(h);
  if (!q || !q.now || !h.cost) return null;
  return +((q.now - h.cost) / h.cost * 100).toFixed(2);
}

// 股票代码集合变化时自动拉行情（标的/持仓新增后立即生效）
watch(compareCodes, (codes) => {
  if (codes.length) refreshQuotes();
});

onMounted(() => {
  load();
  timer = setInterval(() => { refreshQuotes(); loadEmotion(); }, 30000);
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div class="premarket">
    <!-- 日期管理条 -->
    <div class="datebar card">
      <div class="date-nav">
        <button @click="gotoPrev">‹</button>
        <input type="date" v-model="date" @change="load" />
        <button @click="gotoNext">›</button>
        <button class="primary" @click="gotoToday">今日</button>
      </div>
      <div class="copy-row">
        <span class="muted">复制昨日预案：</span>
        <button v-for="d in dates.filter(x => x !== date).slice(0, 5)" :key="d" @click="copyFrom(d)" class="mini">{{ d.slice(5) }}</button>
      </div>
      <div class="err muted" v-if="error">⚠ {{ error }}</div>
    </div>

    <!-- ① 盘前观察市场 -->
    <div class="card sec">
      <h3>盘前观察市场 <span class="hint muted">（市场周期定位 · 龙头的一生）</span></h3>
      <div class="dims">
        <div v-for="dim in MARKET_DIMS" :key="dim" class="dim">
          <div class="dim-name">{{ dim }}</div>
          <div class="chips">
            <button v-for="opt in DIM_OPTIONS[dim]" :key="opt" class="chip"
              :class="{ on: bySection.market?.dimensions?.[dim] === opt }"
              @click="setDim(dim, opt)">{{ opt }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ② 参与策略 -->
    <div class="card sec">
      <h3>盘前参与策略</h3>
      <div class="strategy">
        <div class="str-item">
          <div class="dim-name">参与模式</div>
          <div class="chips">
            <button v-for="m in STRATEGY_MODES" :key="m" class="chip"
              :class="['mode-' + m, { on: bySection.strategy?.mode === m }]"
              @click="setStrategy({ mode: m })">{{ m }}</button>
          </div>
        </div>
        <div class="str-item nums">
          <label>总仓</label>
          <input type="number" step="1" :value="bySection.strategy?.totalPos" @change="e => setStrategy({ totalPos: Number(e.target.value) })" />
          <span class="unit">%</span>
          <label>单笔止损</label>
          <input type="number" step="0.01" :value="bySection.strategy?.stopLoss" @change="e => setStrategy({ stopLoss: Number(e.target.value) })" />
          <span class="unit">%</span>
        </div>
      </div>
    </div>

    <!-- ③ 关注方向 -->
    <div class="card sec">
      <h3>盘前关注方向 <span class="hint muted">（盘中自动统计各方向今日涨停数）</span></h3>
      <div class="dir-add">
        <input v-model="newDirName" placeholder="方向名，如 CPO / AIGC" @keyup.enter="addDirection" />
        <button class="primary" @click="addDirection">添加方向</button>
      </div>
      <div class="dirs" v-if="bySection.directions.length">
        <div v-for="d in bySection.directions" :key="d.name" class="dir card-alt">
          <div class="dir-head">
            <span class="dir-name">{{ d.name }}</span>
            <span class="dir-live mono" :class="directionStats[d.name] ? 'up' : 'muted'">今日涨停 {{ directionStats[d.name] ?? 0 }}</span>
            <button class="mini danger" @click="del(dirItemId(d.name))">删</button>
          </div>
          <div class="states">
            <div v-for="(s, i) in d.states" :key="i" class="state">
              <select :value="s.status" @change="e => setDirState(d, i, 'status', e.target.value)">
                <option v-for="st in DIR_STATUS" :key="st" :value="st">{{ st }}</option>
              </select>
              <input :value="s.text" placeholder="条件，如 放量 / 跌破低点" @change="e => setDirState(d, i, 'text', e.target.value)" />
              <button class="mini danger" @click="removeDirState(d, i)">×</button>
            </div>
            <button class="mini" @click="addDirState(d)">+ 状态</button>
          </div>
        </div>
      </div>
      <div class="empty muted" v-else>暂无关注方向，添加后盘中自动统计涨停数</div>
    </div>

    <!-- ④ 标的预案 + 盘中对比 -->
    <div class="card sec">
      <h3>盘前标的预案 <span class="hint muted">（盘中实时对比买价/止损）</span></h3>
      <div class="t-add">
        <input v-model="newTarget.code" placeholder="代码" class="w90" />
        <input v-model="newTarget.name" placeholder="名称" class="w110" />
        <input v-model="newTarget.direction" placeholder="方向" class="w90" />
        <select v-model="newTarget.plan">
          <option>趋势健康回调</option><option>突破回踩</option><option>弱转强</option><option>低吸</option><option>打板</option>
        </select>
        <input v-model.number="newTarget.buyPrice" type="number" step="0.01" placeholder="买价" class="w80" />
        <input v-model.number="newTarget.stopLoss" type="number" step="0.01" placeholder="止损" class="w80" />
        <button class="primary" @click="addTarget">添加</button>
      </div>
      <div class="tbl-wrap" v-if="bySection.targets.length">
        <table>
          <thead>
            <tr><th>股票</th><th>方向</th><th>预案</th><th>买价</th><th>止损</th><th>盘中现价</th><th>距买价</th><th>止损状态</th><th>关注理由</th></tr>
          </thead>
          <tbody>
            <tr v-for="t in bySection.targets" :key="t.code">
              <td><b>{{ t.name || quotes[t.code]?.name || '--' }}</b> <span class="muted mono">{{ t.code }}</span></td>
              <td>{{ t.direction }}</td>
              <td>{{ t.plan }}</td>
              <td class="mono">{{ t.buyPrice ?? '--' }}</td>
              <td class="mono">{{ t.stopLoss ?? '--' }}</td>
              <td class="mono" :class="cls(tQuote(t)?.pctChg)">{{ tQuote(t)?.now?.toFixed(2) ?? '--' }}</td>
              <td class="mono" :class="cls(tDistBuy(t))">{{ tDistBuy(t) != null ? fmtPct(tDistBuy(t)) : '--' }}</td>
              <td>
                <span v-if="tBreakStop(t)" class="badge danger">跌破止损</span>
                <span v-else-if="tQuote(t)?.now != null && t.stopLoss" class="badge ok">未破位</span>
                <span v-else class="muted">--</span>
              </td>
              <td class="focus">{{ t.focus }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="empty muted" v-else>暂无标的预案</div>
    </div>

    <!-- ⑤ 持仓计划 + 盘中对比 -->
    <div class="card sec">
      <h3>盘前持仓计划 <span class="hint muted">（盘中实时盈亏）</span></h3>
      <div class="t-add">
        <input v-model="newHolding.code" placeholder="代码" class="w90" />
        <input v-model="newHolding.name" placeholder="名称" class="w110" />
        <input v-model.number="newHolding.cost" type="number" step="0.01" placeholder="成本" class="w80" />
        <input v-model.number="newHolding.pos" type="number" placeholder="仓位%" class="w80" />
        <select v-model="newHolding.action">
          <option>持有</option><option>加仓</option><option>减仓</option><option>卖出</option><option>观望</option>
        </select>
        <input v-model="newHolding.condition" placeholder="持有/离场条件" class="w220" />
        <button class="primary" @click="addHolding">添加</button>
      </div>
      <div class="tbl-wrap" v-if="bySection.holdings.length">
        <table>
          <thead>
            <tr><th>股票</th><th>成本</th><th>仓位</th><th>动作</th><th>盘中现价</th><th>盈亏</th><th>持有/离场条件</th></tr>
          </thead>
          <tbody>
            <tr v-for="h in bySection.holdings" :key="h.code">
              <td><b>{{ h.name || quotes[h.code]?.name || '--' }}</b> <span class="muted mono">{{ h.code }}</span></td>
              <td class="mono">{{ h.cost ?? '--' }}</td>
              <td class="mono">{{ h.pos ?? '--' }}%</td>
              <td><span class="badge action">{{ h.action }}</span></td>
              <td class="mono" :class="cls(hQuote(h)?.pctChg)">{{ hQuote(h)?.now?.toFixed(2) ?? '--' }}</td>
              <td class="mono" :class="cls(hPnl(h))">{{ hPnl(h) != null ? fmtPct(hPnl(h)) : '--' }}</td>
              <td class="focus">{{ h.condition }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="empty muted" v-else>暂无持仓计划</div>
    </div>
  </div>
</template>

<style scoped>
.premarket { display: flex; flex-direction: column; gap: 18px; }

.datebar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.date-nav { display: flex; align-items: center; gap: 6px; }
.date-nav input[type="date"] { padding: 5px 8px; }
.copy-row { display: flex; align-items: center; gap: 6px; font-size: 12px; flex-wrap: wrap; }
.mini { padding: 2px 9px; font-size: 12px; }
.err { font-size: 12px; }

.sec h3 { margin-bottom: 12px; }
.hint { font-size: 11px; font-weight: 400; margin-left: 6px; }

/* 维度 chips */
.dims { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 20px; }
@media (max-width: 1000px) { .dims { grid-template-columns: repeat(2, 1fr); } }
.dim { display: flex; align-items: center; gap: 10px; }
.dim-name { font-size: 12px; color: var(--ink-2); width: 64px; flex: none; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { padding: 3px 12px; font-size: 12px; border-radius: 999px; background: var(--card); }
.chip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.chip.mode-进攻.on { background: var(--red); border-color: var(--red); }
.chip.mode-防守.on { background: var(--green); border-color: var(--green); }
.chip.mode-不做.on { background: var(--ink-2); border-color: var(--ink-2); }

/* 策略 */
.strategy { display: flex; flex-direction: column; gap: 12px; }
.str-item { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.nums label { font-size: 12px; color: var(--ink-2); margin-left: 8px; }
.nums input { width: 70px; text-align: right; }
.unit { font-size: 12px; color: var(--ink-2); margin-left: 2px; }

/* 方向 */
.dir-add, .t-add { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
.dirs { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
.dir { border: 1px solid var(--line); border-radius: 10px; padding: 12px; }
.dir-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.dir-name { font-weight: 700; font-size: 14px; }
.dir-live { font-size: 12px; margin-left: auto; }
.states { display: flex; flex-direction: column; gap: 6px; }
.state { display: flex; gap: 6px; }
.state select { width: 72px; }
.state input { flex: 1; }

/* 表格 */
.tbl-wrap { max-height: 460px; overflow-y: auto; }
.w90 { width: 90px; } .w110 { width: 110px; } .w80 { width: 80px; } .w220 { width: 220px; }
.focus { font-size: 12px; color: var(--ink-2); max-width: 280px; white-space: normal; line-height: 1.5; }
.badge { font-size: 11px; padding: 1px 8px; border-radius: 4px; }
.badge.danger { background: rgba(220, 20, 60, 0.12); color: var(--red); }
.badge.ok { background: rgba(34, 139, 34, 0.12); color: var(--green); }
.badge.action { background: var(--card-alt); color: var(--ink-2); }
.empty { padding: 18px 0; text-align: center; font-size: 13px; }
</style>

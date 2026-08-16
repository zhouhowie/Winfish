<script setup>
/**
 * 持仓分析：从操作记录汇总持仓 + 操作记录 + 交割单CSV导入
 */
import { ref, computed, onMounted } from 'vue';
import { api } from '../api.js';

const trades = ref([]);
const date = ref(new Date().toISOString().slice(0, 10));
const error = ref('');
const importMsg = ref('');
const fileInput = ref(null);

// 从全部操作记录汇总持仓（成本加权平均）
const positions = computed(() => {
  const map = {};
  for (const t of trades.value) {
    if (!map[t.code]) map[t.code] = { code: t.code, name: t.name || '', shares: 0, costSum: 0, sellAmt: 0, realized: 0, lastSide: t.side };
    const p = map[t.code];
    if (t.side === 'buy') {
      const cost = (t.price != null ? t.price : (t.amount && t.shares ? t.amount / t.shares : 0));
      const sh = t.shares || 0;
      const amt = cost * sh;
      p.shares += sh;
      p.costSum += amt;
    } else {
      const sh = t.shares || 0;
      const amt = t.amount != null ? t.amount : (t.price != null ? t.price * sh : 0);
      if (p.costSum > 0 && p.shares > 0) {
        const avgCost = p.costSum / p.shares;
        const sellQty = Math.min(sh, p.shares);
        p.realized += (t.price != null ? t.price - avgCost : 0) * sellQty;
      }
      p.shares -= sh;
      p.sellAmt += amt;
      if (p.shares < 0) p.shares = 0;
    }
  }
  return Object.values(map)
    .filter(p => p.shares > 0)
    .map(p => ({ ...p, avgCost: p.shares > 0 ? +(p.costSum / p.shares).toFixed(3) : 0 }))
    .sort((a, b) => b.shares - a.shares);
});

const stats = computed(() => {
  const totalCost = positions.value.reduce((s, p) => s + p.avgCost * p.shares, 0);
  const realized = trades.value.reduce((s, t) => s + (t.side === 'sell' ? (t.amount || 0) : 0), 0);
  return { totalCost, positions: positions.value.length, realized };
});

async function load() {
  try {
    const r = await api.trades();
    trades.value = (r.data || []).sort((a, b) => a.trade_date.localeCompare(b.trade_date));
  } catch (e) { error.value = e.message; }
}

// ── 交割单导入 ──
function onFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => parseCsv(reader.result);
  reader.readAsText(file, 'utf-8');
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) { importMsg.value = '文件为空或格式不对'; return; }
  const header = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const col = (names) => header.findIndex(h => names.some(n => h.includes(n)));
  const idx = {
    date: col(['日期', '成交日期', '发生日期']),
    code: col(['代码', '证券代码', '股票代码']),
    name: col(['名称', '证券名称', '股票名称']),
    side: col(['操作', '方向', '买卖', '业务']),
    price: col(['价格', '成交价格', '成交均价']),
    shares: col(['数量', '成交数量', '股数']),
    amount: col(['金额', '成交金额', '发生金额']),
  };
  if (idx.code < 0 || idx.side < 0) { importMsg.value = '无法识别列：需要 日期/代码/方向(买卖)/价格/数量'; return; }

  const rows = [];
  for (const line of lines.slice(1)) {
    const p = line.split(',').map(x => x.trim().replace(/^["']|["']$/g, ''));
    const sideStr = String(p[idx.side] || '').toLowerCase();
    const side = sideStr.includes('买') || sideStr.includes('buy') ? 'buy' : sideStr.includes('卖') || sideStr.includes('sell') ? 'sell' : null;
    if (!side) continue;
    rows.push({
      date: idx.date >= 0 ? (p[idx.date] || '').replace(/[-\/]/g, '') : '',
      code: p[idx.code] || '',
      name: idx.name >= 0 ? p[idx.name] || '' : '',
      side,
      price: idx.price >= 0 && p[idx.price] ? Number(p[idx.price]) : null,
      shares: idx.shares >= 0 && p[idx.shares] ? Number(p[idx.shares]) : null,
      amount: idx.amount >= 0 && p[idx.amount] ? Number(p[idx.amount]) : null,
      note: '交割单导入',
    });
  }
  if (!rows.length) { importMsg.value = '解析到 0 条有效记录（检查方向列是否为 买入/卖出）'; return; }
  api.importTrades(rows).then(r => {
    importMsg.value = `✅ 导入 ${r.ok} 条，跳过 ${r.skip} 条`;
    load();
  }).catch(e => { importMsg.value = `导入失败: ${e.message}`; });
}

onMounted(load);
</script>

<template>
  <div class="pos">
    <!-- 汇总 -->
    <div class="cards">
      <div class="card sum">
        <div class="sum-v mono">{{ positions.length }}</div>
        <div class="sum-k muted">持仓股票</div>
      </div>
      <div class="card sum">
        <div class="sum-v mono">{{ (stats.totalCost / 1e4).toFixed(0) }}万</div>
        <div class="sum-k muted">持仓成本</div>
      </div>
      <div class="card sum">
        <div class="sum-v mono">{{ (stats.realized / 1e4).toFixed(0) }}万</div>
        <div class="sum-k muted">累计卖出额</div>
      </div>
      <div class="card sum imp">
        <div class="sum-v" style="font-size:16px">📄 导入交割单</div>
        <input ref="fileInput" type="file" accept=".csv,.txt" style="display:none" @change="onFile" />
        <button class="primary" @click="fileInput.click()">选择 CSV 文件</button>
        <div class="imp-msg muted">{{ importMsg }}</div>
      </div>
    </div>

    <!-- 持仓表 -->
    <div class="card">
      <h3>当前持仓</h3>
      <div class="err muted" v-if="error">⚠ {{ error }}</div>
      <div class="tbl-wrap" v-if="positions.length">
        <table>
          <thead><tr><th>代码</th><th>名称</th><th>持仓股数</th><th>平均成本</th><th>持仓市值</th></tr></thead>
          <tbody>
            <tr v-for="p in positions" :key="p.code">
              <td class="mono">{{ p.code }}</td>
              <td>{{ p.name }}</td>
              <td class="mono">{{ p.shares }}</td>
              <td class="mono">{{ p.avgCost }}</td>
              <td class="mono">{{ (p.avgCost * p.shares / 1e4).toFixed(1) }}万</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="empty muted" v-else>暂无持仓。导入交割单或到「操作记录」录入买卖</div>
    </div>

    <!-- 操作记录 -->
    <div class="card">
      <h3>操作记录</h3>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>日期</th><th>方向</th><th>代码</th><th>名称</th><th>价格</th><th>股数</th><th>金额</th><th>备注</th></tr></thead>
          <tbody>
            <tr v-for="r in [...trades].reverse().slice(0, 60)" :key="r.id">
              <td class="muted mono">{{ r.trade_date }}</td>
              <td><span class="tag" :class="r.side">{{ r.side === 'buy' ? '买' : '卖' }}</span></td>
              <td class="mono">{{ r.code }}</td>
              <td>{{ r.name }}</td>
              <td class="mono">{{ r.price ?? '--' }}</td>
              <td class="mono">{{ r.shares ?? '--' }}</td>
              <td class="mono">{{ r.amount ? (r.amount / 1e4).toFixed(1) + '万' : '--' }}</td>
              <td class="muted">{{ r.note }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="empty muted" v-if="!trades.length">暂无操作记录</div>
    </div>
  </div>
</template>

<style scoped>
.pos { display: flex; flex-direction: column; gap: 18px; }
.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
@media (max-width: 1100px) { .cards { grid-template-columns: repeat(2, 1fr); } }
.sum { text-align: center; padding: 16px; }
.sum-v { font-size: 26px; font-weight: 700; color: var(--accent); }
.sum-k { font-size: 12px; margin-top: 4px; }
.imp { display: flex; flex-direction: column; gap: 8px; align-items: center; }
.imp-msg { font-size: 11px; }
.err { font-size: 12px; }
.tbl-wrap { max-height: 420px; overflow-y: auto; }
.tag { font-size: 11px; padding: 1px 8px; border-radius: 4px; }
.tag.buy { background: rgba(220, 20, 60, 0.1); color: var(--red); }
.tag.sell { background: rgba(34, 139, 34, 0.1); color: var(--green); }
.empty { padding: 20px 0; text-align: center; font-size: 13px; }
</style>

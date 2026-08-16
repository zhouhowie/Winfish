<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { api, fmtAmount } from '../api.js';

const panel = ref(null);
const error = ref('');
const showDetail = ref(true);
let timer = null;

async function load() {
  try {
    panel.value = await api.emotion();
    error.value = '';
  } catch (e) { error.value = e.message; }
}

onMounted(() => {
  load();
  timer = setInterval(load, 60000); // 60s 轮询
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <div class="card emotion">
    <div class="head">
      <h3>情绪温度 · {{ panel?.date || '' }}</h3>
      <div class="sub">涨停/跌停/炸板/封板率/连板高度</div>
    </div>

    <div class="err muted" v-if="error">⚠ {{ error }}（情绪数据暂不可用）</div>

    <template v-if="panel">
      <!-- KPI 行 -->
      <div class="kpis">
        <div class="kpi">
          <div class="v up mono">{{ panel.stats.limitUpCount }}</div>
          <div class="k muted">涨停</div>
        </div>
        <div class="kpi">
          <div class="v down mono">{{ panel.stats.limitDownCount }}</div>
          <div class="k muted">跌停</div>
        </div>
        <div class="kpi">
          <div class="v flat mono">{{ panel.stats.brokenCount }}</div>
          <div class="k muted">炸板</div>
        </div>
        <div class="kpi">
          <div class="v mono" :class="panel.stats.sealRate >= 70 ? 'up' : panel.stats.sealRate < 50 ? 'down' : 'flat'">
            {{ panel.stats.sealRate }}%
          </div>
          <div class="k muted">封板率</div>
        </div>
        <div class="kpi">
          <div class="v mono">{{ panel.stats.maxStreak }}板</div>
          <div class="k muted">最高连板</div>
        </div>
      </div>

      <div class="two-col">
        <!-- 连板梯队 -->
        <div class="block">
          <div class="label">连板梯队</div>
          <div class="ladder" v-if="panel.ladder.length">
            <div v-for="l in panel.ladder" :key="l.streak" class="ladder-row">
              <div class="l-st" :class="l.streak >= 4 ? 'up' : l.streak >= 2 ? 'flat' : 'muted'">{{ l.streak }}板</div>
              <div class="l-names">
                <span v-for="s in l.stocks" :key="s.code" class="chip mono">{{ s.name }}</span>
              </div>
              <div class="l-cnt muted">{{ l.count }}家</div>
            </div>
          </div>
          <div class="empty muted" v-else>无连板</div>
        </div>

        <!-- 涨停主类 -->
        <div class="block">
          <div class="label">涨停主类 TOP</div>
          <div class="themes" v-if="panel.themeRank.length">
            <div v-for="t in panel.themeRank" :key="t.name" class="theme-row">
              <div class="t-name">{{ t.name }}</div>
              <div class="t-bar"><div class="t-fill" :style="{ width: (t.count / panel.themeRank[0].count * 100) + '%' }"></div></div>
              <div class="t-cnt mono">{{ t.count }}</div>
            </div>
          </div>
          <div class="empty muted" v-else>暂无</div>
        </div>
      </div>

      <!-- 涨停明细 -->
      <div class="detail-head">
        <span class="label">涨停明细</span>
        <button class="mini" @click="showDetail = !showDetail">{{ showDetail ? '收起' : '展开' }}</button>
      </div>
      <div class="detail" v-if="showDetail">
        <table>
          <thead>
            <tr><th>名称</th><th>代码</th><th>涨跌幅</th><th>连板</th><th>板型</th><th>封单</th><th>首次封板</th><th>题材</th></tr>
          </thead>
          <tbody>
            <tr v-for="s in panel.limitUps.slice(0, 20)" :key="s.sec_code">
              <td class="name">{{ s.sec_name }}</td>
              <td class="mono muted">{{ s.sec_code }}</td>
              <td class="mono up">{{ s.chg }}</td>
              <td class="mono">{{ s['连续涨停天数'] }}{{ s['几天几板'] ? ' · ' + s['几天几板'] : '' }}</td>
              <td>{{ s['板型'] || '--' }}</td>
              <td class="mono">{{ fmtAmount(s['封单金额']) }}</td>
              <td class="mono">{{ s['首次涨停时间'] }}</td>
              <td class="reason">{{ s['涨停原因'] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
.err { font-size: 12px; margin-bottom: 8px; }

.kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
.kpi { background: var(--card-alt); border-radius: 10px; padding: 10px 12px; text-align: center; }
.v { font-size: 24px; font-weight: 700; }
.k { font-size: 11px; margin-top: 2px; }

.two-col { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; margin-bottom: 14px; }
@media (max-width: 1100px) { .two-col { grid-template-columns: 1fr; } }
.label { font-size: 12px; font-weight: 600; color: var(--accent); letter-spacing: 1.5px; margin-bottom: 8px; display: block; }

.ladder-row { display: flex; align-items: center; gap: 10px; padding: 5px 0; border-bottom: 1px dashed var(--line); }
.l-st { font-weight: 700; font-size: 14px; width: 42px; font-family: var(--mono); }
.l-names { flex: 1; display: flex; flex-wrap: wrap; gap: 4px; }
.chip { font-size: 11px; background: var(--card-alt); padding: 1px 7px; border-radius: 10px; }
.l-cnt { font-size: 11px; }

.theme-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
.t-name { width: 110px; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.t-bar { flex: 1; height: 8px; background: var(--card-alt); border-radius: 4px; overflow: hidden; }
.t-fill { height: 100%; background: linear-gradient(90deg, #1d4ed8, #60a5fa); border-radius: 4px; }
.t-cnt { width: 24px; font-size: 12px; text-align: right; }

.detail-head { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }
.mini { padding: 2px 10px; font-size: 12px; }
.detail { max-height: 420px; overflow-y: auto; margin-top: 6px; }
.name { font-weight: 600; }
.reason { font-size: 12px; color: var(--ink-2); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>

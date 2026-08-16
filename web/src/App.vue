<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import PreMarketPanel from './components/PreMarketPanel.vue';
import DeskMain from './components/DeskMain.vue';
import WatchlistPanel from './components/WatchlistPanel.vue';
import TradeLogPanel from './components/TradeLogPanel.vue';
import PositionPanel from './components/PositionPanel.vue';
import MarketOverview from './components/MarketOverview.vue';
import EmotionReview from './components/EmotionReview.vue';
import ReviewPanel from './components/ReviewPanel.vue';
import MindsetChecklist from './components/MindsetChecklist.vue';

// 侧边栏：五大模块
const NAV = [
  {
    id: 'pre', name: '盘前预案', icon: '📋',
    views: [{ id: 'pre', name: '盘前预案', comp: 'pre' }],
  },
  {
    id: 'desk', name: '盘中操盘', icon: '⚡',
    views: [
      { id: 'desk', name: '操盘台', comp: 'desk' },
      { id: 'watch', name: '观察池', comp: 'watch' },
      { id: 'trades', name: '操作记录', comp: 'trades' },
    ],
  },
  {
    id: 'pos', name: '持仓分析', icon: '💼',
    views: [{ id: 'pos', name: '持仓分析', comp: 'pos' }],
  },
  {
    id: 'discover', name: '发现', icon: '🔭',
    views: [{ id: 'discover', name: '市场总览', comp: 'discover' }],
  },
  {
    id: 'review', name: '盘后复盘', icon: '📝',
    views: [
      { id: 'rev', name: '情绪复盘', comp: 'rev' },
      { id: 'archive', name: '复盘归档', comp: 'archive' },
      { id: 'mindset', name: '心法·检查清单', comp: 'mindset' },
    ],
  },
];

const active = ref('desk');
const activeModule = ref('desk');
const watchTrigger = ref(0);
const clock = ref('');
let clockTimer = null;

function onSub(viewId, moduleId) {
  active.value = viewId;
  activeModule.value = moduleId;
  window.scrollTo({ top: 0 });
}
function onWatchlistChange() { watchTrigger.value++; }

onMounted(() => {
  clockTimer = setInterval(() => {
    const d = new Date();
    clock.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  }, 1000);
});
onUnmounted(() => clearInterval(clockTimer));
</script>

<template>
  <div class="shell">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="brand">
        <span class="logo">公明</span>
        <span class="brand-sub muted">盘中 · 盘前 · 盘后</span>
      </div>

      <nav class="nav">
        <div v-for="mod in NAV" :key="mod.id" class="mod">
          <div class="mod-head" :class="{ active: activeModule === mod.id }" @click="onSub(mod.views[0].id, mod.id)">
            <span class="mod-icon">{{ mod.icon }}</span>
            <span class="mod-name">{{ mod.name }}</span>
          </div>
          <div class="mod-children" v-show="activeModule === mod.id">
            <button v-for="v in mod.views" :key="v.id" class="sub" :class="{ on: active === v.id }" @click="onSub(v.id, mod.id)">
              {{ v.name }}
            </button>
          </div>
        </div>
      </nav>

      <div class="sidebar-foot">
        <div class="clock mono muted">{{ clock }}</div>
      </div>
    </aside>

    <!-- 内容区 -->
    <main class="content">
      <PreMarketPanel v-if="active === 'pre'" />
      <DeskMain v-else-if="active === 'desk'" @watchChange="onWatchlistChange" />
      <WatchlistPanel v-else-if="active === 'watch'" :trigger="watchTrigger" />
      <TradeLogPanel v-else-if="active === 'trades'" />
      <PositionPanel v-else-if="active === 'pos'" />
      <MarketOverview v-else-if="active === 'discover'" />
      <EmotionReview v-else-if="active === 'rev'" />
      <ReviewPanel v-else-if="active === 'archive'" />
      <MindsetChecklist v-else-if="active === 'mindset'" />
    </main>
  </div>
</template>

<style scoped>
.shell { display: flex; min-height: 100vh; }

/* 侧边栏 */
.sidebar {
  width: 168px; flex: none;
  background: #f1efe7;
  border-right: 1px solid var(--line);
  display: flex; flex-direction: column;
  position: sticky; top: 0; height: 100vh;
  padding: 16px 10px;
}
.brand { padding: 4px 8px 16px; display: flex; flex-direction: column; gap: 4px; }
.logo {
  font-size: 16px; font-weight: 700; color: #fff;
  background: var(--accent); border-radius: 8px; padding: 2px 10px;
  letter-spacing: 2px; display: inline-block; width: fit-content;
}
.brand-sub { font-size: 10px; letter-spacing: 1px; }

.nav { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.mod-head {
  display: flex; align-items: center; gap: 7px;
  padding: 8px 10px; border-radius: 9px; cursor: pointer;
  font-size: 13px; font-weight: 600; color: var(--ink-2);
  transition: all 0.15s;
}
.mod-head:hover { background: #e7e5dc; }
.mod-head.active { background: var(--card); color: var(--ink); box-shadow: var(--shadow); }
.mod-icon { font-size: 14px; }
.mod-children { display: flex; flex-direction: column; gap: 1px; padding: 3px 0 6px 26px; }
.sub {
  border: none; background: transparent; text-align: left;
  font-size: 12.5px; padding: 6px 10px; border-radius: 7px;
  color: var(--ink-2); letter-spacing: 0.5px;
}
.sub:hover { background: #e7e5dc; color: var(--ink); }
.sub.on { background: var(--accent); color: #fff; font-weight: 600; }

.sidebar-foot { padding: 10px 8px 0; border-top: 1px solid var(--line); }
.clock { font-size: 11px; }

/* 内容区 */
.content { flex: 1; min-width: 0; padding: 18px 24px 40px; max-width: 1500px; }

@media (max-width: 860px) {
  .shell { flex-direction: column; }
  .sidebar { width: 100%; height: auto; position: static; flex-direction: row; align-items: center; gap: 8px; padding: 10px; }
  .nav { flex-direction: row; overflow-x: auto; }
  .mod-children { position: absolute; display: none; }
}
</style>

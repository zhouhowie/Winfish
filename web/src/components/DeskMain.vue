<script setup>
/**
 * 盘中操盘台：指数K线 + 板块资金流 + 重点监测 + 情绪温度 + 量能
 */
import IndexBar from './IndexBar.vue';
import IndexKlineCard from './IndexKlineCard.vue';
import SectorFlowCard from './SectorFlowCard.vue';
import WatchMonitorCard from './WatchMonitorCard.vue';
import EmotionPanel from './EmotionPanel.vue';
import VolumePanel from './VolumePanel.vue';
</script>

<template>
  <div class="desk">
    <IndexBar />
    <div class="kline-grid">
      <IndexKlineCard />
      <SectorFlowCard />
    </div>
    <WatchMonitorCard />
    <div class="mid-grid">
      <EmotionPanel />
      <VolumePanel />
    </div>
  </div>
</template>

<style scoped>
.desk { display: flex; flex-direction: column; gap: 18px; }
.kline-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 18px; align-items: start; }
.mid-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 18px; align-items: start; }
@media (max-width: 1100px) { .kline-grid, .mid-grid { grid-template-columns: 1fr; } }
</style>

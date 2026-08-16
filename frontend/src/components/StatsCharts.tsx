// 市场图表组：量能 / 涨跌家数 / 涨跌停 / 活跃市值 + 10/20/30 天切换
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { StatsDay } from '@/lib/api';

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

function useChart(option: Record<string, unknown> | null, deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !option) return;
    const chart = echarts.init(ref.current);
    chart.setOption(option);
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.dispose(); };
  }, deps);
  return ref;
}

const AXIS_LABEL = { color: '#8e8e96', fontSize: 10 };
const SPLIT_LINE = { lineStyle: { color: 'rgba(128,128,140,0.12)' } };

/** 量能柱状图（红放量绿缩量） */
export function TurnoverChart({ series, height = 180 }: { series: { date: string; amount: number }[]; height?: number }) {
  const dates = series.map(s => s.date.slice(4));
  const amounts = series.map(s => +(s.amount / 1e12).toFixed(2));
  const option = {
    grid: { left: 46, right: 12, top: 18, bottom: 24 },
    tooltip: { trigger: 'axis', formatter: (ps: any) => `${ps[0].axisValue}<br/>两市成交 <b>${ps[0].value} 万亿</b>` },
    xAxis: { type: 'category', data: dates, axisLabel: AXIS_LABEL },
    yAxis: { type: 'value', name: '万亿', nameTextStyle: { color: '#8e8e96', fontSize: 9 }, axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
    series: [{
      type: 'bar', data: amounts, barWidth: '52%',
      itemStyle: {
        borderRadius: [3, 3, 0, 0],
        color: (p: any) => {
          const prev = p.dataIndex > 0 ? amounts[p.dataIndex - 1] : null;
          if (prev == null) return '#1d4ed8';
          return p.value >= prev ? '#dc143c' : '#228b22';
        },
      },
      label: { show: true, position: 'top', color: '#8e8e96', fontSize: 9 },
    }],
  };
  const ref = useChart(option, [series]);
  return <div ref={ref} style={{ height, width: '100%' }} />;
}

/** 涨跌家数堆叠柱状图 */
export function BreadthChart({ data, height = 180 }: { data: StatsDay[]; height?: number }) {
  const dates = data.map(d => d.date.slice(4));
  const up = data.map(d => d.up_count ?? 0);
  const down = data.map(d => d.down_count ?? 0);
  const option = {
    grid: { left: 46, right: 12, top: 18, bottom: 24 },
    tooltip: {
      trigger: 'axis',
      formatter: (ps: any) => {
        const i = ps[0].dataIndex;
        const d = data[i];
        return `${d.date}<br/>上涨 <b class="text-red-500">${d.up_count ?? '--'}</b><br/>下跌 <b class="text-green-500">${d.down_count ?? '--'}</b><br/>平盘 ${d.flat_count ?? '--'}`;
      },
    },
    legend: { top: 0, textStyle: { color: '#8e8e96', fontSize: 10 }, data: ['上涨', '下跌'] },
    xAxis: { type: 'category', data: dates, axisLabel: AXIS_LABEL },
    yAxis: { type: 'value', axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
    series: [
      { name: '上涨', type: 'bar', stack: 'b', data: up, itemStyle: { color: '#dc143c' }, barWidth: '52%' },
      { name: '下跌', type: 'bar', stack: 'b', data: down, itemStyle: { color: '#228b22' }, barWidth: '52%' },
    ],
  };
  const ref = useChart(option, [data]);
  return <div ref={ref} style={{ height, width: '100%' }} />;
}

/** 涨跌停家数柱状图 */
export function LimitChart({ data, height = 180 }: { data: StatsDay[]; height?: number }) {
  const dates = data.map(d => d.date.slice(4));
  const lu = data.map(d => d.limit_up ?? 0);
  const ld = data.map(d => d.limit_down ?? 0);
  const option = {
    grid: { left: 40, right: 12, top: 18, bottom: 24 },
    tooltip: {
      trigger: 'axis',
      formatter: (ps: any) => {
        const i = ps[0].dataIndex;
        const d = data[i];
        return `${d.date}<br/>涨停 <b>${d.limit_up ?? '--'}</b> / 跌停 <b>${d.limit_down ?? '--'}</b><br/>封板率 ${d.seal_rate ?? '--'}% · 最高 ${d.max_streak ?? '--'}板`;
      },
    },
    legend: { top: 0, textStyle: { color: '#8e8e96', fontSize: 10 }, data: ['涨停', '跌停'] },
    xAxis: { type: 'category', data: dates, axisLabel: AXIS_LABEL },
    yAxis: { type: 'value', axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
    series: [
      { name: '涨停', type: 'bar', data: lu, itemStyle: { color: '#dc143c' }, barWidth: '30%' },
      { name: '跌停', type: 'bar', data: ld, itemStyle: { color: '#228b22' }, barWidth: '30%' },
    ],
  };
  const ref = useChart(option, [data]);
  return <div ref={ref} style={{ height, width: '100%' }} />;
}

/** 活跃市值折线图 */
export function AmvChart({ series, height = 180 }: { series: { date: string; close: number; change: number | null }[]; height?: number }) {
  const dates = series.map(s => s.date.slice(4));
  const vals = series.map(s => +(s.close / 10000).toFixed(2));
  const option = {
    grid: { left: 52, right: 12, top: 18, bottom: 24 },
    tooltip: {
      trigger: 'axis',
      formatter: (ps: any) => {
        const i = ps[0].dataIndex;
        const s = series[i];
        const chg = s.change != null ? `${s.change > 0 ? '+' : ''}${s.change.toFixed(2)}%` : '--';
        return `${s.date}<br/>活跃市值 <b>${(s.close / 10000).toFixed(2)}万点</b> (${chg})`;
      },
    },
    xAxis: { type: 'category', data: dates, axisLabel: AXIS_LABEL },
    yAxis: { type: 'value', scale: true, axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
    series: [{
      type: 'line', data: vals, smooth: true, symbolSize: 5,
      lineStyle: { color: '#1d4ed8', width: 2 },
      itemStyle: { color: '#1d4ed8' },
      areaStyle: { color: 'rgba(29,78,216,0.08)' },
      label: { show: true, position: 'top', color: '#8e8e96', fontSize: 9 },
    }],
  };
  const ref = useChart(option, [series]);
  return <div ref={ref} style={{ height, width: '100%' }} />;
}

// 年度走势 — 独立块，时间范围滑块 + 纵向图表（指数K线tab/量能/活跃市值/涨跌家数/涨跌停曲线）
import { useEffect, useMemo, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { KChart } from '@/components/KChart';

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const AXIS_LABEL = { color: '#8e8e96', fontSize: 10 };
const SPLIT_LINE = { lineStyle: { color: 'rgba(128,128,140,0.12)' } };

const IDX_TABS = [
  { key: 'sh', name: '上证指数' },
  { key: 'cyb', name: '创业板指' },
  { key: 'kc50', name: '科创50' },
] as const;

function ChartBox({ title, option, height = 190 }: { title: string; option: Record<string, unknown> | null; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !option) return;
    const chart = echarts.init(ref.current);
    chart.setOption(option);
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.dispose(); };
  }, [option]);
  return (
    <div className="border-b border-border/40 py-3 last:border-b-0">
      <div className="mb-1 text-[11px] font-semibold text-secondary">{title}</div>
      <div ref={ref} style={{ height, width: '100%' }} />
    </div>
  );
}

export default function YearView() {
  const { data } = useQuery({ queryKey: ['year'], queryFn: api.year, refetchInterval: 1800000 });
  const indices = data?.indices || [];
  const [idxTab, setIdxTab] = useState<'sh' | 'cyb' | 'kc50'>('sh');
  const [range, setRange] = useState<[number, number]>([0, Math.max(indices.length - 1, 0)]);

  useEffect(() => {
    if (indices.length > 0) setRange([0, indices.length - 1]);
  }, [indices.length]);

  const [lo, hi] = range;
  const dates = useMemo(() => indices.slice(lo, hi + 1), [indices, lo, hi]);
  const rangeStart = dates[0]?.date || '';
  const rangeEnd = dates[dates.length - 1]?.date || '';

  // 区间内 K 线（按日期过滤，与滑块区间对齐）
  const klineSlice = useMemo(() => {
    const arr = (data?.kline?.[idxTab] || []) as { date: string; o: number; h: number; l: number; c: number }[];
    return arr.filter(k => k.date >= rangeStart && k.date <= rangeEnd);
  }, [data, idxTab, rangeStart, rangeEnd]);

  // 量能柱
  const volOption = useMemo(() => {
    if (!dates.length) return null;
    const amounts = dates.map(d => +(d.amount / 1e12).toFixed(2));
    return {
      grid: { left: 52, right: 14, top: 14, bottom: 22 },
      tooltip: { trigger: 'axis', formatter: (ps: any) => `${ps[0].axisValue}<br/>两市成交 <b>${ps[0].value} 万亿</b>` },
      xAxis: { type: 'category', data: dates.map(d => d.date.slice(4)), axisLabel: AXIS_LABEL },
      yAxis: { type: 'value', axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
      series: [{
        type: 'bar', data: amounts, barWidth: '55%',
        itemStyle: {
          borderRadius: [2, 2, 0, 0],
          color: (p: any) => {
            const prev = p.dataIndex > 0 ? amounts[p.dataIndex - 1] : null;
            if (prev == null) return '#1d4ed8';
            return p.value >= prev ? '#dc143c' : '#228b22';
          },
        },
      }],
    };
  }, [dates]);

  // 活跃市值（涨跌比例：红涨绿跌柱）
  const amvMap = useMemo(() => new Map((data?.amv || []).map(a => [a.date, a])), [data]);
  const amvOption = useMemo(() => {
    const rows = dates.map(d => amvMap.get(d.date)).filter(Boolean) as { date: string; close: number; change: number | null }[];
    if (!rows.length) return null;
    return {
      grid: { left: 62, right: 14, top: 14, bottom: 22 },
      tooltip: {
        trigger: 'axis',
        formatter: (ps: any) => {
          const r = rows[ps[0].dataIndex];
          return `${r.date}<br/>活跃市值 <b>${(r.close / 10000).toFixed(2)}万点</b><br/>${r.change != null ? `${r.change > 0 ? '+' : ''}${r.change.toFixed(2)}%` : '--'}`;
        },
      },
      xAxis: { type: 'category', data: rows.map(r => r.date.slice(4)), axisLabel: AXIS_LABEL },
      yAxis: { type: 'value', axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
      series: [{
        type: 'bar', data: rows.map(r => r.change), barWidth: '55%',
        itemStyle: { borderRadius: [2, 2, 0, 0], color: (p: any) => (p.value >= 0 ? '#dc143c' : '#228b22') },
      }],
    };
  }, [dates, amvMap]);

  // 涨跌家数曲线（上涨/下跌双线）
  const statsMap = useMemo(() => new Map((data?.stats || []).map(s => [s.date, s])), [data]);
  const breadthOption = useMemo(() => {
    const rows = dates.map(d => statsMap.get(d.date)).filter(Boolean) as any[];
    if (!rows.length) return null;
    return {
      grid: { left: 46, right: 14, top: 22, bottom: 22 },
      tooltip: {
        trigger: 'axis',
        formatter: (ps: any) => {
          const r = rows[ps[0].dataIndex];
          return `${r.date}<br/>上涨 <b>${r.up_count ?? '--'}</b> / 下跌 <b>${r.down_count ?? '--'}</b>`;
        },
      },
      legend: { top: 0, textStyle: { color: '#8e8e96', fontSize: 10 }, data: ['上涨', '下跌'] },
      xAxis: { type: 'category', data: rows.map((r: any) => r.date.slice(4)), axisLabel: AXIS_LABEL },
      yAxis: { type: 'value', axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
      series: [
        { name: '上涨', type: 'line', data: rows.map((r: any) => r.up_count ?? 0), smooth: true, symbol: 'none', lineStyle: { width: 1.6, color: '#dc143c' } },
        { name: '下跌', type: 'line', data: rows.map((r: any) => r.down_count ?? 0), smooth: true, symbol: 'none', lineStyle: { width: 1.6, color: '#228b22' } },
      ],
    };
  }, [dates, statsMap]);

  // 涨跌停曲线（涨停/跌停双线）
  const limitOption = useMemo(() => {
    const rows = dates.map(d => statsMap.get(d.date)).filter(Boolean) as any[];
    if (!rows.length) return null;
    return {
      grid: { left: 40, right: 14, top: 22, bottom: 22 },
      tooltip: {
        trigger: 'axis',
        formatter: (ps: any) => {
          const r = rows[ps[0].dataIndex];
          return `${r.date}<br/>涨停 <b>${r.limit_up ?? '--'}</b> / 跌停 <b>${r.limit_down ?? '--'}</b><br/>封板率 ${r.seal_rate ?? '--'}%`;
        },
      },
      legend: { top: 0, textStyle: { color: '#8e8e96', fontSize: 10 }, data: ['涨停', '跌停'] },
      xAxis: { type: 'category', data: rows.map((r: any) => r.date.slice(4)), axisLabel: AXIS_LABEL },
      yAxis: { type: 'value', axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
      series: [
        { name: '涨停', type: 'line', data: rows.map((r: any) => r.limit_up ?? 0), smooth: true, symbol: 'none', lineStyle: { width: 1.6, color: '#dc143c' } },
        { name: '跌停', type: 'line', data: rows.map((r: any) => r.limit_down ?? 0), smooth: true, symbol: 'none', lineStyle: { width: 1.6, color: '#228b22' } },
      ],
    };
  }, [dates, statsMap]);

  const total = indices.length;
  const maxIdx = Math.max(total - 1, 0);
  const fmtRange = (i: number) => indices[i] ? `${indices[i].date.slice(0, 4)}-${indices[i].date.slice(4, 6)}-${indices[i].date.slice(6)}` : '';

  return (
    <div className="rounded-xl border border-border bg-surface p-4" onDoubleClick={() => setRange([0, maxIdx])}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-0.5 rounded-full bg-gradient-to-b from-accent to-accent/30" />
          <h2 className="text-xs font-semibold text-foreground">年度走势</h2>
          <span className="num text-[10px] text-muted">2026 年至今 · 拖动手柄选择时间范围 · 双击恢复</span>
        </div>
        <span className="num text-[11px] text-secondary">
          {fmtRange(lo)} ~ {fmtRange(hi)} · {hi - lo + 1} 个交易日
        </span>
      </div>

      {/* 双滑块 */}
      <div className="relative mb-4 h-6 select-none">
        <input
          type="range" min={0} max={maxIdx} value={lo}
          onChange={e => setRange([Math.min(Number(e.target.value), hi - 5), hi])}
          className="pointer-events-none absolute inset-0 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <input
          type="range" min={0} max={maxIdx} value={hi}
          onChange={e => setRange([lo, Math.max(Number(e.target.value), lo + 5)])}
          className="pointer-events-none absolute inset-0 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <div className="absolute top-1/2 h-0.5 w-full -translate-y-1/2 rounded bg-elevated">
          <div className="absolute h-full bg-accent/25" style={{ left: `${(lo / maxIdx) * 100}%`, width: `${((hi - lo) / maxIdx) * 100}%` }} />
        </div>
      </div>

      {/* 指数 K 线（tab 切换 + MA5/10/20/47/131） */}
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[11px] font-semibold text-secondary">指数K线</div>
        <div className="flex gap-1">
          {IDX_TABS.map(t => (
            <button key={t.key} className={`rounded px-2 py-0.5 text-[11px] ${idxTab === t.key ? 'bg-accent text-white' : 'bg-elevated text-secondary hover:text-foreground'}`} onClick={() => setIdxTab(t.key)}>
              {t.name}
            </button>
          ))}
        </div>
      </div>
      <div className="border-b border-border/40 pb-3">
        <KChart bars={klineSlice} height={240} />
      </div>

      {/* 纵向图表 */}
      <ChartBox title="两市成交额" option={volOption} />
      <ChartBox title="活跃市值 涨跌幅（红涨绿跌）" option={amvOption} />
      <ChartBox title="涨跌家数曲线（红=上涨 绿=下跌）" option={breadthOption} />
      <ChartBox title="涨跌停家数曲线" option={limitOption} />

      {!total && <div className="py-10 text-center text-xs text-muted">数据加载中…</div>}
    </div>
  );
}

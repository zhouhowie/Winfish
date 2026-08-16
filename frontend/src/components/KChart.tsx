// ECharts K线图组件（React 封装）
// 支持：日K/分时蜡烛 + MA 均线（5/10/20/47/131）+ 标记线
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { CandlestickChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, DataZoomComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([CandlestickChart, LineChart, GridComponent, TooltipComponent, DataZoomComponent, CanvasRenderer]);

export interface KBar {
  date: string;       // YYYYMMDD
  o: number; h: number; l: number; c: number;
  time?: string;      // 分时用：HH:mm
}
export interface MarkLine { y: number; label: string; color?: string }

const MA_COLORS: Record<number, string> = {
  5: '#f59e0b',
  10: '#3b82f6',
  20: '#8b5cf6',
  47: '#06b6d4',
  131: '#ec4899',
};

function calcMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = 0; j < period; j++) sum += closes[i - j];
    return +(sum / period).toFixed(2);
  });
}

export function KChart({ bars, height = 300, markLines = [], zoom = 40, showMA = true, maPeriods = [5, 10, 20, 47, 131] }: {
  bars: KBar[]; height?: number; markLines?: MarkLine[]; zoom?: number;
  showMA?: boolean; maPeriods?: number[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const labels = bars.map(b => b.time || b.date.slice(4));
    const ohlc = bars.map(b => [b.o, b.c, b.l, b.h]);
    const closes = bars.map(b => b.c);
    const legend = showMA ? maPeriods.map(p => `MA${p}`) : [];
    const maSeries = showMA ? maPeriods.map(p => ({
      name: `MA${p}`,
      type: 'line' as const,
      data: calcMA(closes, p),
      smooth: true,
      symbol: 'none',
      lineStyle: { width: 1, color: MA_COLORS[p] || '#999' },
      itemStyle: { color: MA_COLORS[p] || '#999' },
      emphasis: { disabled: true },
      z: 5,
    })) : [];

    chart.setOption({
      legend: {
        top: 0, textStyle: { color: '#8e8e96', fontSize: 10 },
        data: legend,
      },
      grid: { left: 56, right: 14, top: 22, bottom: 20 },
      tooltip: {
        trigger: 'axis', axisPointer: { type: 'cross' },
        formatter: (ps: any) => {
          const i = ps[0].dataIndex;
          const k = bars[i];
          if (!k) return '';
          let s = `<b>${k.time ? `${k.date.slice(4)} ${k.time}` : k.date}</b><br/>开 ${k.o}  收 ${k.c}<br/>高 ${k.h}  低 ${k.l}`;
          for (const p of ps) {
            if (p.seriesName?.startsWith('MA') && p.value != null) s += `<br/>${p.seriesName} ${p.value}`;
          }
          return s;
        },
      },
      xAxis: {
        type: 'category', data: labels,
        axisLabel: { color: '#8e8e96', fontSize: 10 },
      },
      yAxis: {
        scale: true,
        axisLabel: { color: '#8e8e96', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(128,128,140,0.12)' } },
      },
      dataZoom: [{ type: 'inside', start: zoom, end: 100 }],
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          data: ohlc,
          itemStyle: {
            color: '#dc143c', color0: '#228b22',
            borderColor: '#dc143c', borderColor0: '#228b22',
          },
          markLine: markLines.length ? {
            silent: true, symbol: 'none',
            data: markLines.map(m => ({
              yAxis: m.y,
              lineStyle: { color: m.color || '#1d4ed8', type: 'dashed', width: 1 },
              label: { formatter: m.label, color: m.color || '#1d4ed8', fontSize: 10 },
            })),
          } : undefined,
        },
        ...maSeries,
      ],
    });
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.dispose(); };
  }, [bars, markLines, zoom, showMA, maPeriods]);

  return <div ref={ref} style={{ height, width: '100%' }} />;
}

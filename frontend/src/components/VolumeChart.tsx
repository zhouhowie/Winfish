// 量能柱状图（ECharts Bar）
import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

export function VolumeChart({ series, height = 220 }: { series: { date: string; amount: number }[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const dates = series.map(s => s.date.slice(4));
    const amounts = series.map(s => +(s.amount / 1e12).toFixed(2));
    chart.setOption({
      grid: { left: 52, right: 14, top: 24, bottom: 26 },
      tooltip: {
        trigger: 'axis',
        formatter: (ps: any) => {
          const p = ps[0];
          return `${p.axisValue}<br/>两市成交 <b>${p.value} 万亿</b>`;
        },
      },
      xAxis: { type: 'category', data: dates, axisLabel: { color: '#8e8e96', fontSize: 10 } },
      yAxis: {
        type: 'value', name: '万亿', nameTextStyle: { color: '#8e8e96', fontSize: 10 },
        axisLabel: { color: '#8e8e96', fontSize: 10 },
        splitLine: { lineStyle: { color: 'rgba(128,128,140,0.12)' } },
      },
      series: [{
        type: 'bar', data: amounts, barWidth: '55%',
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: (p: any) => {
            const prev = p.dataIndex > 0 ? amounts[p.dataIndex - 1] : null;
            if (prev == null) return '#1d4ed8';
            return p.value >= prev ? '#dc143c' : '#228b22';
          },
        },
        label: { show: true, position: 'top', color: '#8e8e96', fontSize: 10 },
      }],
    });
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.dispose(); };
  }, [series]);

  return <div ref={ref} style={{ height, width: '100%' }} />;
}

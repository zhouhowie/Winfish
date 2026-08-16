// 连板梯队 — ①龙头轨迹(历史高度板) ②时间选择(涨跌家数/涨跌停/炸板率/晋级率/连板高度) ③梯队层级 ④概念联动+明细
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useEmotion, useStats } from '@/lib/useQueries';
import { Card } from '@/components/ui';
import { api, type KlineRes } from '@/lib/api';
import { fmtAmount } from '@/lib/format';
import StockModal from '@/components/StockModal';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, CanvasRenderer]);

const AXIS_LABEL = { color: '#8e8e96', fontSize: 10 };
const SPLIT_LINE = { lineStyle: { color: 'rgba(128,128,140,0.12)' } };
const COLORS = ['#dc143c', '#1d4ed8', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#228b22', '#f97316'];

export default function LimitLadder() {
  const { data } = useEmotion();
  const statsQ = useStats(60);
  const [modal, setModal] = useState<{ code: string; name: string } | null>(null);
  const [selDate, setSelDate] = useState<string>('');       // 时间选择
  const [selTheme, setSelTheme] = useState<string>('');     // 概念联动，默认 top1
  const [minBoard, setMinBoard] = useState(3);              // 龙头高度筛选：3板+/4板+/5板+
  const [zoomPct, setZoomPct] = useState<[number, number]>([0, 100]); // 时间轴缩放区间
  const [dateFrom, setDateFrom] = useState('');            // 时间区间（参考悟道 dragon）
  const [dateTo, setDateTo] = useState('');
  const st = data?.stats;

  // 历史连板（4/8 起，龙头轨迹 + 晋级率）
  const histQ = useQuery({
    queryKey: ['emotion-history-408'],
    queryFn: () => api.emotionHistoryFrom('20260408'),
    refetchInterval: 3600000,
    staleTime: 2 * 60 * 60 * 1000,
  });
  const history = histQ.data;
  const statsList = statsQ.data?.data || [];

  // 龙头轨迹数据：窗口内最大连板 >= minBoard 的股票；轨迹含全部连板日（1板→N板爬升），断板日无记录 → 曲线终止
  const dragonData = useMemo(() => {
    const daily = (history?.daily || []).filter(d => d.date >= dateFrom && d.date <= dateTo);
    const dates = daily.map(d => d.date);
    const selected = new Set<string>();
    for (const day of daily) {
      for (const u of day.ups || []) {
        if ((u.streak || 1) >= minBoard) selected.add(u.code);
      }
    }
    const map: Record<string, { code: string; name: string; series: Record<string, number> }> = {};
    for (const day of daily) {
      for (const u of day.ups || []) {
        if (selected.has(u.code) && (u.streak || 1) >= minBoard) {
          // 只记录 3 板及以上（minBoard 起）的高度，1/2 板不画
          if (!map[u.code]) map[u.code] = { code: u.code, name: u.name, series: {} };
          map[u.code].series[day.date] = u.streak || 1;
        }
      }
    }
    return { dates, stocks: Object.values(map) };
  }, [history, minBoard, dateFrom, dateTo]);

  // 时间区间默认 7/21 至今（可拖回 4/8）
  useEffect(() => {
    const ds = history?.dates || [];
    if (ds.length) {
      setDateFrom(prev => prev || (ds.find(d => d >= '20260721') || ds[Math.max(0, ds.length - 14)]));
      setDateTo(prev => prev || ds[ds.length - 1]);
    }
  }, [history]);

  // 区间内全局最高连板（用于接力名字标注）
  const globalMax = useMemo(() => {
    let m = 0;
    for (const s of dragonData.stocks) {
      for (const v of Object.values(s.series)) m = Math.max(m, v);
    }
    return m;
  }, [dragonData]);

  // 按时间轴缩放区间动态过滤图例/轨迹（只在区间内有连板记录的股票）
  const zoomRange = useMemo(() => {
    const n = dragonData.dates.length;
    if (!n) return [0, 0];
    const lo = Math.max(0, Math.floor(n * zoomPct[0] / 100));
    const hi = Math.min(n - 1, Math.ceil(n * zoomPct[1] / 100) - 1);
    return [lo, hi];
  }, [dragonData.dates, zoomPct]);

  const activeDragons = useMemo(() => {
    const [lo, hi] = zoomRange;
    const inRange = new Set(dragonData.dates.slice(lo, hi + 1));
    return dragonData.stocks.filter(s => {
      for (const d of inRange) if (s.series[d] != null) return true;
      return false;
    });
  }, [dragonData, zoomRange]);

  // 时间选择：可用日期（history 日期 ∩ stats 日期）
  const dateOptions = useMemo(() => {
    const histDates = (history?.dates || []).map(d => d);
    const statDates = statsList.map(s => s.date);
    const all = [...new Set([...histDates, ...statDates])].sort();
    return all;
  }, [history, statsList]);

  useEffect(() => {
    if (!selDate && dateOptions.length) setSelDate(dateOptions[dateOptions.length - 1]);
  }, [dateOptions, selDate]);

  // 连板家数梯队：选中日各高度连板家数分布
  const ladderByStreak = useMemo(() => {
    const day = history?.daily.find(d => d.date === selDate);
    const m: Record<number, number> = {};
    for (const u of day?.ups || []) {
      const s = u.streak || 1;
      m[s] = (m[s] || 0) + 1;
    }
    return Object.entries(m).sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [history, selDate]);

  // 情绪节点 + 周期判定（默认坐标：7.20政策底 → 8.4共振开启）
  const nodesQ = useQuery({ queryKey: ['nodes'], queryFn: api.nodes });
  const keyNodes = nodesQ.data?.data?.length ? nodesQ.data.data : [
    { node_date: '20260720', label: '政策底', desc: '政策发力' },
    { node_date: '20260721', label: '市场底', desc: '首日下探' },
    { node_date: '20260727', label: '市场底二次确认', desc: '二次回踩确认' },
    { node_date: '20260731', label: '情绪复苏', desc: '情绪回暖' },
    { node_date: '20260804', label: '指数与情绪共振', desc: '新周期开启' },
  ];

  // 选中日期 + 前两天的情绪数据（连续三天对比）
  const dayRows = useMemo(() => {
    const idx = dateOptions.indexOf(selDate);
    if (idx < 0) return [];
    const ds = dateOptions.slice(Math.max(0, idx - 2), idx + 1); // T-2, T-1, T
    return ds.map(d => {
      const stat = statsList.find(s => s.date === d);
      const hist = history?.daily.find(x => x.date === d);
      const rally = history?.rally.find(x => x.date === d);
      const maxStreak = hist ? Math.max(0, ...(hist.ups || []).map(u => u.streak || 1)) : stat?.max_streak ?? null;
      return {
        date: d,
        up: stat?.up_count ?? null, down: stat?.down_count ?? null,
        limitUp: stat?.limit_up ?? hist?.count ?? null, limitDown: stat?.limit_down ?? null,
        broken: stat?.broken ?? null,
        sealRate: stat?.seal_rate ?? null,
        rallyRate: rally?.rate ?? null,
        maxStreak,
      };
    });
  }, [selDate, dateOptions, statsList, history]);

  // 周期判定：基于近三日指标走势推断当前情绪周期阶段
  const cycleJudge = useMemo(() => {
    const rows = dayRows;
    if (rows.length < 3) return null;
    const [t2, t1, t] = rows;
    const upNow = t?.limitUp ?? 0, upPrev = t1?.limitUp ?? 0, upPrev2 = t2?.limitUp ?? 0;
    const rallyNow = t?.rallyRate ?? null, rallyPrev = t1?.rallyRate ?? null;
    const downNow = t?.down ?? 0;
    const up = upNow >= upPrev && upPrev >= upPrev2;
    const down = upNow <= upPrev && upPrev <= upPrev2;
    if (downNow > upNow) return { phase: '退潮/冰点', tone: '#c8341f', desc: '下跌家数压过上涨，亏钱效应主导，防守为主' };
    if (up) return { phase: '情绪主升', tone: '#DC143C', desc: '涨停家数连续三日放大，赚钱效应扩散，进攻' };
    if (rallyNow != null && rallyPrev != null && rallyNow > rallyPrev) return { phase: '修复/复苏', tone: '#1d4ed8', desc: '晋级率回升，连板资金愿意接力，试探进攻' };
    if (upNow < 40) return { phase: '冰点', tone: '#c8341f', desc: '涨停稀少，情绪冰点，等待转折信号' };
    return { phase: '盘顶/分化', tone: '#b45309', desc: '涨停家数高位徘徊或回落，注意兑现节奏' };
  }, [dayRows]);

  // 指标定义：label + 取值 + 趋势判断（数值增减）
  const METRICS: { key: string; label: string; fmt: (r: any) => string }[] = [
    { key: 'updown', label: '涨跌家数', fmt: r => r.up != null && r.down != null ? `${r.up} / ${r.down}` : '--' },
    { key: 'limit', label: '涨停 / 跌停', fmt: r => r.limitUp != null ? `${r.limitUp} / ${r.limitDown ?? '--'}` : '--' },
    { key: 'broken', label: '炸板率', fmt: r => r.broken != null && r.limitUp ? `${Math.round(r.broken / (r.limitUp + r.broken) * 100)}%` : r.sealRate != null ? `${(100 - r.sealRate).toFixed(0)}%` : '--' },
    { key: 'rally', label: '晋级率', fmt: r => r.rallyRate != null ? `${r.rallyRate}%` : '--' },
    { key: 'seal', label: '封板率', fmt: r => r.sealRate != null ? `${r.sealRate}%` : '--' },
    { key: 'streak', label: '最高连板', fmt: r => r.maxStreak != null ? `${r.maxStreak}板` : '--' },
  ];
  // 数值函数（趋势比较用）：涨跌家数用上涨家数、涨停跌停用涨停数等
  const numOf = (key: string, r: any): number | null => {
    switch (key) {
      case 'updown': return r.up;
      case 'limit': return r.limitUp;
      case 'broken': return r.broken != null && r.limitUp ? Math.round(r.broken / (r.limitUp + r.broken) * 100) : r.sealRate != null ? 100 - r.sealRate : null;
      case 'rally': return r.rallyRate;
      case 'seal': return r.sealRate;
      case 'streak': return r.maxStreak;
      default: return null;
    }
  };

  // 概念联动：默认 Top1
  const themes = data?.themeRank || [];
  useEffect(() => {
    if (!selTheme && themes.length) setSelTheme(themes[0].name);
  }, [themes, selTheme]);

  const themeUps = useMemo(() => {
    if (!selTheme) return data?.limitUps || [];
    return (data?.limitUps || []).filter((s: any) => String(s['涨停原因'] || '').startsWith(selTheme));
  }, [data, selTheme]);

  // 概念过滤后的梯队层级
  const themeLadder = useMemo(() => {
    const g: Record<number, any[]> = {};
    for (const s of themeUps) {
      const k = Number(s['连续涨停天数'] || 1);
      if (!g[k]) g[k] = [];
      g[k].push(s);
    }
    return Object.entries(g).map(([k, v]) => ({ streak: Number(k), stocks: v })).sort((a, b) => b.streak - a.streak);
  }, [themeUps]);

  // 龙头轨迹折线图
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!chartRef.current || !dragonData.dates.length || !activeDragons.length) return;
    const chart = echarts.init(chartRef.current);
    const dates = dragonData.dates.map(d => d.slice(4));
    chart.setOption({
      grid: { left: 40, right: 16, top: 24, bottom: 46 },
      tooltip: {
        trigger: 'axis',
        formatter: (ps: any) => {
          const d = ps[0]?.axisValue;
          let s = `<b>${d}</b>`;
          for (const p of ps) {
            if (p.value > 0) s += `<br/>${p.seriesName}: ${p.value}连板`;
          }
          return s;
        },
      },
      legend: { top: 0, textStyle: { color: '#8e8e96', fontSize: 9 }, type: 'scroll' },
      xAxis: { type: 'category', data: dates, axisLabel: AXIS_LABEL },
      yAxis: { type: 'value', name: '连板高度', min: 0, nameTextStyle: { color: '#8e8e96', fontSize: 9 }, axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
      dataZoom: [
        { type: 'inside', start: zoomPct[0], end: zoomPct[1] },
        { type: 'slider', start: zoomPct[0], end: zoomPct[1], height: 16, bottom: 8, borderColor: 'transparent', backgroundColor: 'rgba(128,128,140,0.08)', fillerColor: 'rgba(29,78,216,0.12)', handleStyle: { color: '#1d4ed8' }, textStyle: { color: '#8e8e96', fontSize: 9 } },
      ],
      series: activeDragons.map((t, i) => ({
        name: t.name,
        type: 'line',
        data: dragonData.dates.map(d => t.series[d] ?? null), // 断板日 null → 曲线断开终止
        smooth: false,
        symbolSize: 4,
        connectNulls: false,
        lineStyle: { width: 1.8, color: COLORS[i % COLORS.length] },
        itemStyle: { color: COLORS[i % COLORS.length] },
        emphasis: { focus: 'series' },
        // 峰值标注（每段连板的最高点）
        markPoint: {
          symbol: 'circle', symbolSize: 14,
          data: (() => {
            const pts: any[] = [];
            let segMax = 0;
            for (let j = 0; j < dragonData.dates.length; j++) {
              const v = t.series[dragonData.dates[j]];
              if (v != null) {
                segMax = Math.max(segMax, v);
              } else if (segMax > 0) {
                const isTop = segMax === globalMax && segMax >= 4;
                pts.push({ coord: [j - 1, segMax], value: segMax, label: { formatter: isTop ? `${t.name} ${segMax}板` : `${segMax}板`, fontSize: isTop ? 10 : 8, fontWeight: isTop ? 'bold' : 'normal', position: 'top', color: isTop ? COLORS[i % COLORS.length] : '#8e8e96' }, itemStyle: { color: COLORS[i % COLORS.length] } });
                segMax = 0;
              }
            }
            if (segMax > 0) {
              const isTop = segMax === globalMax && segMax >= 4;
              pts.push({ coord: [dragonData.dates.length - 1, segMax], value: segMax, label: { formatter: isTop ? `${t.name} ${segMax}板` : `${segMax}板`, fontSize: isTop ? 10 : 8, fontWeight: isTop ? 'bold' : 'normal', position: 'top', color: isTop ? COLORS[i % COLORS.length] : '#8e8e96' }, itemStyle: { color: COLORS[i % COLORS.length] } });
            }
            return pts;
          })(),
        },
      })),
    });
    // 时间轴拖动 → 动态更新图例与轨迹
    chart.on('datazoom', (p: any) => {
      const b = p.batch?.[0] || p;
      const start = Number(b.start ?? zoomPct[0]);
      const end = Number(b.end ?? zoomPct[1]);
      if (!isNaN(start) && !isNaN(end)) setZoomPct([start, end]);
    });
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.dispose(); };
  }, [dragonData, activeDragons, zoomPct, globalMax]);

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold">连板梯队 · 情绪温度 {data?.date ? `(${data.date})` : ''}</h1>

      {/* ① 龙头轨迹：时间区间 + 高度筛选 + 图例动态 + 最高板接力名字 */}
      <Card
        title="龙头轨迹 · 高度板统计"
        hint="断板即止 · 停牌复牌涨停延续 · 图例随时间轴动态 · 峰值标注最高板名字"
        right={
          <div className="flex items-center gap-2">
            {/* 时间区间选择（参考悟道 dragon） */}
            <div className="flex items-center gap-1 text-[11px]">
              <select className="rounded border border-border bg-surface px-1.5 py-1 text-[11px]" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setZoomPct([0, 100]); }}>
                {(history?.dates || []).map(d => <option key={d} value={d}>{d.slice(4)}</option>)}
              </select>
              <span className="text-muted">至</span>
              <select className="rounded border border-border bg-surface px-1.5 py-1 text-[11px]" value={dateTo} onChange={e => { setDateTo(e.target.value); setZoomPct([0, 100]); }}>
                {(history?.dates || []).map(d => <option key={d} value={d}>{d.slice(4)}</option>)}
              </select>
            </div>
            <div className="flex gap-1">
              {[3, 4, 5].map(n => (
                <button key={n} className={`rounded px-2.5 py-1 text-xs ${minBoard === n ? 'bg-accent text-white' : 'bg-elevated text-secondary'}`} onClick={() => { setMinBoard(n); setZoomPct([0, 100]); }}>
                  {n}板以上
                </button>
              ))}
            </div>
          </div>
        }
      >
        {activeDragons.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">当前区间内无 {minBoard} 板以上高度板</div>
        ) : (
          <div ref={chartRef} style={{ height: 300, width: '100%' }} />
        )}
      </Card>

      {/* ② 时间选择 + 连续三天情绪对比 */}
      <Card
        title="历史情绪 · 连续三天对比"
        hint="选择日期显示前两日，红↑上升 绿↓下降"
        right={
          <select className="rounded border border-border bg-surface px-2 py-1 text-xs" value={selDate} onChange={e => setSelDate(e.target.value)}>
            {dateOptions.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th w-24">指标</th>
                {dayRows.map((r, i) => (
                  <th key={r.date} className={`th ${i === dayRows.length - 1 ? 'text-accent' : ''}`}>
                    {r.date.slice(4)} {i === dayRows.length - 1 ? '· 今日' : i === dayRows.length - 2 ? '· 昨日' : '· 前日'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map(m => (
                <tr key={m.key} className="border-b border-border/30">
                  <td className="td font-medium">{m.label}</td>
                  {dayRows.map((r, i) => {
                    const val = numOf(m.key, r);
                    const prev = i > 0 ? numOf(m.key, dayRows[i - 1]) : null;
                    const trend = val != null && prev != null ? val - prev : null;
                    return (
                      <td key={r.date} className={`td num ${i === dayRows.length - 1 ? 'font-bold' : ''}`}>
                        {m.fmt(r)}
                        {trend != null && trend !== 0 && (
                          <span className={`ml-1 text-[10px] ${trend > 0 ? 'text-bull' : 'text-bear'}`}>
                            {trend > 0 ? '↑' : '↓'}
                          </span>
                        )}
                        {trend != null && trend === 0 && <span className="ml-1 text-[10px] text-muted">→</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ②.5 连板家数梯队 + 情绪节点/周期判定 */}
      <div className="grid grid-cols-[1fr_1.6fr] gap-4">
        <Card title={`连板家数梯队 · ${selDate.slice(4)}`} hint="各高度连板家数分布">
          {ladderByStreak.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted">该日无连板</div>
          ) : (
            <div className="space-y-1.5">
              {ladderByStreak.map(([s, c]) => {
                const w = Math.min(100, (c / (ladderByStreak[0]?.[1] || 1)) * 100);
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span className={`num w-9 shrink-0 text-right text-[11px] font-bold ${Number(s) >= 5 ? 'text-bull' : Number(s) >= 3 ? 'text-accent' : 'text-muted'}`}>{s}板</span>
                    <div className="h-4 flex-1 overflow-hidden rounded bg-elevated">
                      <div className="h-full rounded" style={{ width: `${w}%`, background: Number(s) >= 5 ? '#dc143c' : Number(s) >= 3 ? '#1d4ed8' : '#c7c9d4' }} />
                    </div>
                    <span className="num w-6 shrink-0 text-[11px]">{c}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="情绪节点共振 · 周期判定" hint="政策底→市场底→二次确认→复苏→共振">
          <div className="mb-3 flex items-center justify-between overflow-x-auto py-1">
            {keyNodes.map((n, i) => (
              <div key={n.node_date} className="flex min-w-[6.8rem] flex-1 items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: i === keyNodes.length - 1 ? '#c8341f' : '#1d4ed8', boxShadow: `0 0 6px ${i === keyNodes.length - 1 ? '#c8341f55' : '#1d4ed855'}` }} />
                    <span className="num text-[11px] font-bold">{n.node_date.slice(4)}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium" style={{ color: i === keyNodes.length - 1 ? '#c8341f' : undefined }}>{n.label}</div>
                </div>
                {i < keyNodes.length - 1 && <div className="mx-0.5 h-px flex-1 bg-border" />}
              </div>
            ))}
          </div>
          {cycleJudge ? (
            <div className="rounded-lg px-4 py-3" style={{ background: `${cycleJudge.tone}0d`, borderLeft: `3px solid ${cycleJudge.tone}` }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: cycleJudge.tone }}>当前阶段：{cycleJudge.phase}</span>
                <span className="text-[10px] text-muted">（基于 {dayRows[0]?.date.slice(4)}→{dayRows[2]?.date.slice(4)} 三日走势判定）</span>
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-secondary">{cycleJudge.desc}</div>
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-muted">数据不足，无法判定周期</div>
          )}
        </Card>
      </div>

      {/* ③ 概念联动：涨停行业概念（左）+ 梯队/明细（右），默认 Top1 */}
      <div className="grid grid-cols-[220px_1fr] gap-4">
        <Card title="活跃涨停概念">
          <div className="space-y-1">
            {themes.map((t: any) => (
              <button
                key={t.name}
                onClick={() => setSelTheme(t.name)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${selTheme === t.name ? 'bg-accent/10 ring-1 ring-accent/40' : 'hover:bg-elevated'}`}
              >
                <span className="text-xs font-medium">{t.name}</span>
                <span className="num ml-auto text-[11px] font-bold text-bull">{t.count}</span>
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          {/* 当前概念的梯队层级 */}
          <Card title={`连板梯队 · ${selTheme || ''}`} hint="点击个股查看K线">
            {themeLadder.length === 0 && <div className="py-6 text-center text-xs text-muted">该概念今日无涨停</div>}
            <div className="space-y-1">
              {themeLadder.map(l => (
                <div key={l.streak} className="flex items-start gap-2 border-b border-border/30 py-1.5 last:border-b-0">
                  <div className={`num w-12 flex-none pt-0.5 text-sm font-bold ${l.streak >= 4 ? 'text-bull' : l.streak >= 2 ? 'text-foreground' : 'text-muted'}`}>{l.streak}板</div>
                  <div className="flex flex-1 flex-wrap gap-1.5">
                    {l.stocks.slice(0, 10).map((s: any) => (
                      <button key={s.sec_code} onClick={() => setModal({ code: s.sec_code, name: s.sec_name })}
                        className="rounded-lg border border-border/60 bg-elevated/60 px-2 py-1 text-left hover:border-accent/60 hover:bg-accent/5 cursor-pointer"
                        title={`${s.sec_name} ${s.sec_code} · 封单 ${fmtAmount(s['封单金额'])} · ${s['板型'] || ''}`}>
                        <span className="text-xs font-medium">{s.sec_name}</span>
                        <span className="ml-1 num text-[9px] text-muted">{s['板型']?.replace('(涨停)', '') || ''}</span>
                        {s['封单金额'] != null && Number(s['封单金额']) > 0 && <span className="ml-1 num text-[9px] text-accent">{(Number(s['封单金额']) / 1e8).toFixed(1)}亿</span>}
                      </button>
                    ))}
                    {l.stocks.length > 10 && <span className="num self-center text-[10px] text-muted">+{l.stocks.length - 10} 家</span>}
                  </div>
                  <span className="num flex-none pt-0.5 text-[10px] text-muted">{l.stocks.length}家</span>
                </div>
              ))}
            </div>
          </Card>

          {/* 当前概念的涨停明细 */}
          <Card title={`涨停明细 · ${selTheme || ''}`} hint={`${themeUps.length} 只 · 点击查看K线`}>
            <div className="max-h-[360px] overflow-y-auto">
              <table className="w-full">
                <thead><tr><th className="th">名称</th><th className="th">涨跌幅</th><th className="th">连板</th><th className="th">板型</th><th className="th">封单</th><th className="th">首封</th><th className="th">题材</th></tr></thead>
                <tbody>
                  {themeUps.map((s: any) => (
                    <tr key={s.sec_code} className="cursor-pointer hover:bg-elevated/50" onClick={() => setModal({ code: s.sec_code, name: s.sec_name })}>
                      <td className="td font-medium hover:text-accent">{s.sec_name} <span className="num text-[9px] text-muted">{s.sec_code}</span></td>
                      <td className="td num text-bull">{s.chg}</td>
                      <td className="td num">{s['连续涨停天数']}</td>
                      <td className="td">{s['板型'] || '--'}</td>
                      <td className="td num">{fmtAmount(s['封单金额'])}</td>
                      <td className="td num">{s['首次涨停时间']}</td>
                      <td className="td max-w-[200px] truncate text-muted">{s['涨停原因']}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      {/* K线弹窗 */}
      {modal && <StockModal code={modal.code} name={modal.name} onClose={() => setModal(null)} />}
    </div>
  );
}

function Tag({ label, value, tone }: { label: string; value: string; tone?: 'bull' | 'bear' }) {
  const cls = tone === 'bull' ? 'text-bull' : tone === 'bear' ? 'text-bear' : 'text-foreground';
  return (
    <div className="rounded-lg bg-elevated px-3 py-2 text-center">
      <div className={`num text-base font-bold ${cls}`}>{value}</div>
      <div className="mt-0.5 text-[10px] text-muted">{label}</div>
    </div>
  );
}

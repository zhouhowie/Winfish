// 核心个股 — ①三类核心池（反弹/机构/情绪）②按日期自选观察（每日≤10只）③个股对标
import { useMemo, useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { api, type CoreStock } from '@/lib/api';
import { Card, Empty } from '@/components/ui';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

// 三类核心池定义
const POOLS: { type: string; label: string; tone: string }[] = [
  { type: 'rebound', label: '反弹核心', tone: '#1d4ed8' },
  { type: 'inst', label: '机构核心', tone: '#0f766e' },
  { type: 'emotion', label: '情绪核心', tone: '#c8341f' },
];

export default function CoreStocks() {
  const qc = useQueryClient();
  const [today, setToday] = useState(() => new Date().toISOString().slice(0, 10).replace(/-/g, ''));
  const [compareSel, setCompareSel] = useState<string[]>([]);
  const [days, setDays] = useState(30);

  const coreQ = useQuery({ queryKey: ['core'], queryFn: api.core });
  const watchQ = useQuery({ queryKey: ['watch-items', today], queryFn: () => api.watchItems(today) });
  const watchDatesQ = useQuery({ queryKey: ['watch-items-dates'], queryFn: () => api.watchItems() });

  const allCodes = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of coreQ.data?.data || []) m.set(s.code, s.name);
    for (const w of watchQ.data?.data || []) m.set(w.code, w.name);
    return m;
  }, [coreQ.data, watchQ.data]);

  const quoteQ = useQuery({
    queryKey: ['quotes', [...allCodes.keys()].join(',')],
    queryFn: () => api.quotes([...allCodes.keys()]),
    enabled: allCodes.size > 0,
    refetchInterval: 60000,
  });
  const quoteMap = useMemo(() => {
    const m: Record<string, { price: number; pct: number }> = {};
    for (const q of quoteQ.data?.data || []) {
      const h = q.data?.HQInfo || {};
      const now = Number(h.Now) || 0;
      const base = Number(h.Close) || Number(h.Yield) || 0;
      const pct = now && base ? +(((now - base) / base) * 100).toFixed(2) : 0;
      m[q.code] = { price: now, pct };
    }
    return m;
  }, [quoteQ.data]);

  const compareQ = useQuery({
    queryKey: ['compare', [...compareSel].sort().join(','), days],
    queryFn: () => api.compare([...compareSel], days),
    enabled: compareSel.length >= 2,
  });

  const delCore = useMutation({ mutationFn: (c: CoreStock) => api.coreRemove(c.type, c.code), onSuccess: () => qc.invalidateQueries({ queryKey: ['core'] }) });
  const delWatch = useMutation({ mutationFn: (id: number) => api.watchItemRemove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['watch-items', today] }) });

  const grouped = useMemo(() => {
    const g: Record<string, { type: string; items: CoreStock[] }> = {};
    for (const p of POOLS) g[p.type] = { type: p.type, items: [] };
    for (const s of coreQ.data?.data || []) (g[s.type] ||= { type: s.type, items: [] }).items.push(s);
    return g;
  }, [coreQ.data]);

  const toggleCompare = (code: string) => {
    setCompareSel(prev => prev.includes(code) ? prev.filter(c => c !== code) : prev.length >= 8 ? prev : [...prev, code]);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold">核心个股 · 机构/情绪/反弹核心</h1>

      {/* ── ① 三类核心池 ── */}
      <div className="grid grid-cols-3 gap-4">
        {POOLS.map(p => {
          const items = grouped[p.type]?.items || [];
          const sectors: Record<string, CoreStock[]> = {};
          for (const s of items) (sectors[s.sector || '未分类'] ||= []).push(s);
          return (
            <Card key={p.type} title={`${p.label} · ${items.length}`}>
              <div className="space-y-2">
                {Object.entries(sectors).map(([sec, list]) => (
                  <div key={sec}>
                    <div className="mb-1 text-[11px] font-semibold" style={{ color: p.tone }}>{sec}</div>
                    <div className="space-y-1">
                      {list.map(s => {
                        const q = quoteMap[s.code];
                        return (
                          <div key={s.code} className="flex items-center justify-between rounded-lg bg-elevated px-2 py-1.5">
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                              <input type="checkbox" className="accent-[#1d4ed8]" checked={compareSel.includes(s.code)} onChange={() => toggleCompare(s.code)} />
                              <button className="min-w-0 truncate text-xs font-medium hover:text-accent" onClick={() => window.open(`/desk?code=${s.code}`, '_blank')}>
                                {s.name} <span className="num text-[10px] text-muted">{s.code}</span>
                              </button>
                            </label>
                            {q && (
                              <span className={`num text-[11px] font-semibold ${q.pct >= 0 ? 'text-bull' : 'text-bear'}`}>
                                {q.price.toFixed(2)} {q.pct >= 0 ? '+' : ''}{q.pct.toFixed(2)}%
                              </span>
                            )}
                            <button className="ml-1 text-[10px] text-muted hover:text-signal cursor-pointer" onClick={() => delCore.mutate(s)}>✕</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── ② 按日期自选观察 ── */}
      <DailyWatch today={today} setToday={setToday} watchQ={watchQ} delWatch={delWatch} quoteMap={quoteMap} compareSel={compareSel} toggleCompare={toggleCompare} watchDatesQ={watchDatesQ} />

      {/* ── ③ 个股对标 ── */}
      <Card title={`个股对标 · 已选 ${compareSel.length} 只（≥2只生效）`} hint="仅限核心池与自选列表内个股 · 区间涨幅归一对比">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {compareSel.length === 0 && <span className="text-xs text-muted">勾选左侧核心池或自选观察中的股票进行对比</span>}
            {compareSel.map(code => {
              const name = allCodes.get(code) || code;
              return (
                <span key={code} className="flex items-center gap-1 rounded bg-accent/10 px-2 py-1 text-[11px]">
                  {name} <button className="text-muted hover:text-signal cursor-pointer" onClick={() => toggleCompare(code)}>✕</button>
                </span>
              );
            })}
          </div>
          {compareSel.length >= 2 && (
            <div className="ml-auto flex items-center gap-1 text-[11px]">
              {[10, 30, 60].map(n => (
                <button key={n} className={`rounded px-2 py-1 ${days === n ? 'bg-accent text-white' : 'bg-elevated'}`} onClick={() => setDays(n)}>{n}日</button>
              ))}
            </div>
          )}
        </div>
        {compareSel.length >= 2 && compareQ.isLoading && <div className="py-6 text-center text-xs text-muted">加载对比数据…</div>}
        {compareSel.length >= 2 && ((compareQ.data?.data?.series?.length) ?? 0) >= 2 && compareQ.data && (
          <CompareChart data={compareQ.data.data.series} />
        )}
      </Card>
    </div>
  );
}

// ── 按日期自选观察 ──
function DailyWatch({ today, setToday, watchQ, delWatch, quoteMap, compareSel, toggleCompare, watchDatesQ }: any) {
  const qc = useQueryClient();
  const [kw, setKw] = useState('');
  const [sector, setSector] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [picked, setPicked] = useState<any>(null);

  const addWatch = useMutation({
    mutationFn: (w: { trade_date: string; code: string; name: string; sector: string }) => api.watchItemAdd(w),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['watch-items', today] }); setPicked(null); setKw(''); },
  });

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kw.trim()) return;
    const r = await fetch(`/api/search?kw=${encodeURIComponent(kw)}`).then(r => r.json());
    setResults(r.data || []);
  };

  const items = watchQ.data?.data || [];
  const dates = watchDatesQ.data?.data?.map((d: any) => d.trade_date).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i) || [];
  return (
    <Card title={`按日期自选观察 · ${today.slice(4)} · ${items.length}/10`} hint="每日≤10只 · 添加后同步K线/游资分析">
      <div className="mb-2 flex items-center gap-2 text-[11px]">
        <span className="text-muted">观察日</span>
        <select className="rounded border border-border bg-surface px-2 py-1 text-xs" value={today} onChange={e => setToday(e.target.value)}>
          {dates.map((d: string) => <option key={d} value={d}>{d}</option>)}
          <option value={today}>{today}</option>
        </select>
      </div>

      <form onSubmit={search} className="mb-2 flex flex-wrap items-center gap-2">
        <input className="w-40 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="搜索股票名/代码" value={kw} onChange={e => setKw(e.target.value)} />
        <input className="w-28 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="板块分类" value={sector} onChange={e => setSector(e.target.value)} />
        <button className="rounded bg-accent px-3 py-1 text-xs text-white cursor-pointer" type="submit">搜索</button>
        {picked && (
          <>
            <span className="text-xs font-medium text-accent">{picked.name} {picked.code}</span>
            <button
              className="rounded bg-signal px-3 py-1 text-xs text-white cursor-pointer disabled:opacity-40"
              disabled={items.length >= 10}
              onClick={() => addWatch.mutate({ trade_date: today, code: picked.code, name: picked.name, sector: sector || '自选' })}
            >
              添加
            </button>
          </>
        )}
      </form>
      {results.length > 0 && !picked && (
        <div className="mb-2 rounded-lg border border-border bg-elevated/60 p-1.5">
          {results.map(r => (
            <button key={r.code} className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-accent/10 cursor-pointer" onClick={() => { setPicked(r); setResults([]); }}>
              {r.name} <span className="num text-[10px] text-muted">{r.code}</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {items.map((w: any) => {
          const q = quoteMap[w.code];
          return (
            <div key={w.id} className="flex items-center gap-2 rounded-lg bg-elevated px-2 py-1.5">
              <input type="checkbox" className="accent-[#1d4ed8]" checked={compareSel.includes(w.code)} onChange={() => toggleCompare(w.code)} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{w.name} <span className="num text-[10px] text-muted">{w.code}</span></div>
                <div className="text-[10px] text-muted">{w.sector}{w.note ? ` · ${w.note}` : ''}</div>
              </div>
              {q && (
                <span className={`num text-[11px] font-semibold ${q.pct >= 0 ? 'text-bull' : 'text-bear'}`}>
                  {q.pct >= 0 ? '+' : ''}{q.pct.toFixed(2)}%
                </span>
              )}
              <button className="text-[10px] text-muted hover:text-signal cursor-pointer" onClick={() => delWatch.mutate(w.id)}>✕</button>
            </div>
          );
        })}
        {items.length === 0 && <div className="col-span-2 py-4 text-center text-xs text-muted">该日暂无自选观察，搜索添加</div>}
      </div>
    </Card>
  );
}

// ── 个股对标折线图 ──
function CompareChart({ data }: { data: { code: string; name: string; dates: string[]; pct: number[]; close: number[] }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !data?.length) return;
    const chart = echarts.init(ref.current);
    const palette = ['#1d4ed8', '#c8341f', '#0f766e', '#b45309', '#7c3aed', '#db2777', '#4d7c0f', '#0369a1'];
    chart.setOption({
      grid: { left: 44, right: 16, top: 28, bottom: 34 },
      tooltip: { trigger: 'axis', formatter: (ps: any) => {
        const d = ps[0]?.axisValue;
        let s = `<b>${d}</b>`;
        for (const p of ps) s += `<br/><span style="color:${p.color}">${p.seriesName}</span>: ${p.value > 0 ? '+' : ''}${p.value}%`;
        return s;
      } },
      legend: { top: 0, textStyle: { color: '#8e8e96', fontSize: 10 }, type: 'scroll' },
      xAxis: { type: 'category', data: data[0].dates.map((d: string) => d.slice(4)), axisLabel: { color: '#8e8e96', fontSize: 9 } },
      yAxis: { type: 'value', name: '区间涨幅%', nameTextStyle: { color: '#8e8e96', fontSize: 9 }, axisLabel: { color: '#8e8e96', fontSize: 9 }, splitLine: { lineStyle: { color: '#e8eaed' } } },
      series: data.map((s, i) => ({
        name: s.name, type: 'line', smooth: true, symbolSize: 3,
        data: s.pct, lineStyle: { width: 1.5, color: palette[i % palette.length] },
        itemStyle: { color: palette[i % palette.length] },
      })),
    });
    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.dispose(); };
  }, [data]);
  return <div ref={ref} style={{ height: 300, width: '100%' }} />;
}

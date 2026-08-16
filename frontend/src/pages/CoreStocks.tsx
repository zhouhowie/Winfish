// 核心个股 — ①三类核心池（反弹/机构/情绪）②按日期自选观察（每日≤10只）③个股对标
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type CoreStock } from '@/lib/api';
import { Card } from '@/components/ui';
import StockModal from '@/components/StockModal';
import { KChart } from '@/components/KChart';

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
  const [modal, setModal] = useState<{ code: string; name: string } | null>(null);
  const [comparePeriod, setComparePeriod] = useState<'day' | 'min'>('day');

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
                              <button className="min-w-0 truncate text-xs font-medium hover:text-accent" onClick={() => setModal({ code: s.code, name: s.name })}>
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
      <DailyWatch today={today} setToday={setToday} watchQ={watchQ} delWatch={delWatch} quoteMap={quoteMap} compareSel={compareSel} toggleCompare={toggleCompare} watchDatesQ={watchDatesQ} onOpenStock={setModal} />

      {/* ── ③ 个股对标 ── */}
      <Card title={`个股对标 · 已选 ${compareSel.length} 只（≥1只生效）`} hint="勾选左侧核心池或自选观察中的股票 · 每只展示K线（分时/日K）+ MA5/10/20/47/131">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {compareSel.length === 0 && <span className="text-xs text-muted">勾选左侧核心池或自选观察中的股票进行对标（1只即可）</span>}
            {compareSel.map(code => {
              const name = allCodes.get(code) || code;
              return (
                <span key={code} className="flex items-center gap-1 rounded bg-accent/10 px-2 py-1 text-[11px]">
                  {name} <button className="text-muted hover:text-signal cursor-pointer" onClick={() => toggleCompare(code)}>✕</button>
                </span>
              );
            })}
          </div>
          {compareSel.length >= 1 && (
            <div className="ml-auto flex items-center gap-2">
              <div className="flex gap-1 text-[11px]">
                <button className={`rounded px-2 py-1 ${comparePeriod === 'day' ? 'bg-accent text-white' : 'bg-elevated'}`} onClick={() => setComparePeriod('day')}>日K</button>
                <button className={`rounded px-2 py-1 ${comparePeriod === 'min' ? 'bg-accent text-white' : 'bg-elevated'}`} onClick={() => setComparePeriod('min')}>分时</button>
              </div>
              <div className="flex gap-1 text-[11px]">
                {[10, 30, 60].map(n => (
                  <button key={n} className={`rounded px-2 py-1 ${days === n ? 'bg-accent text-white' : 'bg-elevated'}`} onClick={() => setDays(n)}>{n}日</button>
                ))}
              </div>
            </div>
          )}
        </div>
        {compareSel.length >= 1 && (
          <CompareKlineGrid codes={compareSel} names={allCodes} period={comparePeriod} days={days} />
        )}
      </Card>

      {/* 个股弹窗：点击名字打开（默认分时=最近交易日） */}
      {modal && <StockModal code={modal.code} name={modal.name} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── 按日期自选观察 ──
function DailyWatch({ today, setToday, watchQ, delWatch, quoteMap, compareSel, toggleCompare, watchDatesQ, onOpenStock }: any) {
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
              <button className="min-w-0 flex-1 text-left cursor-pointer" onClick={() => onOpenStock && onOpenStock({ code: w.code, name: w.name })}>
                <div className="truncate text-xs font-medium hover:text-accent">{w.name} <span className="num text-[10px] text-muted">{w.code}</span></div>
                <div className="text-[10px] text-muted">{w.sector}{w.note ? ` · ${w.note}` : ''}</div>
              </button>
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

// ── 个股对标：每只展示 K 线（分时/日K 切换）+ MA5/10/20/47/131 ──
function CompareKlineGrid({ codes, names, period, days }: { codes: string[]; names: Map<string, string>; period: 'day' | 'min'; days: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {codes.map(code => (
        <CompareStockCard key={code} code={code} name={names.get(code) || code} period={period} days={days} />
      ))}
    </div>
  );
}

function CompareStockCard({ code, name, period, days }: { code: string; name: string; period: 'day' | 'min'; days: number }) {
  const setcode = code.startsWith('6') ? '1' : code.startsWith('8') || code.startsWith('4') ? '2' : '0';
  const kq = useQuery({
    queryKey: ['compare-kline', code, period, days],
    queryFn: () => api.kline(code, setcode, period === 'day' ? '4' : '0', String(period === 'day' ? Math.max(days + 40, 90) : 50)),
  });
  const bars = useMemo(() => {
    const items = kq.data?.data?.items || [];
    if (period === 'day') {
      return items.map((it: any) => ({ date: it.Data, o: Number(it.Open), h: Number(it.High), l: Number(it.Low), c: Number(it.Close) }));
    }
    return items.map((it: any) => {
      const sec = Number(it.Second || 0);
      const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
      const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
      return { date: it.Data, time: `${hh}:${mm}`, o: Number(it.Open), h: Number(it.High), l: Number(it.Low), c: Number(it.Close) };
    });
  }, [kq.data, period]);

  return (
    <div className="rounded-xl border border-border bg-elevated/40 p-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-semibold">{name}</span>
        <span className="num text-[10px] text-muted">{code}</span>
        <span className="ml-auto text-[10px] text-muted">{period === 'day' ? `日K · 近${days}日` : '分时 · 最近交易日'}</span>
      </div>
      <KChart bars={bars} height={260} showMA={period === 'day'} maPeriods={[5, 10, 20, 47, 131]} />
    </div>
  );
}

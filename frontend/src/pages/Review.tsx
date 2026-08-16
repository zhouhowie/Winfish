// 盘后复盘 — 六维复盘（数据→周期→逻辑）+ 归档 + 心法清单
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { QK, useEmotion, useVolume, useReviews } from '@/lib/useQueries';
import { Card, Chip, Badge } from '@/components/ui';
import { fmtAmount } from '@/lib/format';

const PERIODS = ['混沌期', '确认主升', '盘顶预期', '退潮叠加混沌'];
const LOGICS = ['连板模式', '尾盘2点半模式', '趋势段模式'];
const MINDSETS = [
  { title: '周期定仓位', text: '混沌期轻仓试错，主升期敢于加仓，盘顶预期降低预期，退潮期休息为主' },
  { title: '主线是生命线', text: '只做当日最强主线，逻辑未失效不轻易离场，不因普通波动下车' },
  { title: '先预案后下手', text: '买价、止损、仓位盘中前写清楚，盘中只执行不临时起意' },
  { title: '让判断冷静', text: '情绪化交易是最大的亏损来源，逆势时先停手，复盘后再动手' },
];
const DEFAULT_CHECKS = [
  '今日情绪周期定位清楚了吗（混沌/主升/盘顶/退潮）？',
  '下手模式是否与周期匹配（连板/尾盘/趋势）？',
  '仓位是否符合盘前预案（总仓上限、单笔止损）？',
  '买入是否符合主线逻辑，而非随意追涨？',
  '止损位是否预先设定并严格执行？',
  '是否避免在非主线/弱势方向恋战？',
  '尾盘2点半前是否确认当日情绪无恶化？',
  '是否做了盘后复盘并写下明日预案？',
];

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function Review() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'review' | 'archive' | 'mindset'>('review');
  const [date, setDate] = useState(todayStr());

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-base font-semibold">盘后复盘</h1>
        <button className={`btn btn-sm ${tab === 'review' ? 'btn-primary' : ''}`} onClick={() => setTab('review')}>情绪复盘</button>
        <button className={`btn btn-sm ${tab === 'archive' ? 'btn-primary' : ''}`} onClick={() => setTab('archive')}>复盘归档</button>
        <button className={`btn btn-sm ${tab === 'mindset' ? 'btn-primary' : ''}`} onClick={() => setTab('mindset')}>心法·检查清单</button>
      </div>

      {tab === 'review' && <EmotionReviewTab date={date} setDate={setDate} />}
      {tab === 'archive' && <ArchiveTab />}
      {tab === 'mindset' && <MindsetTab date={date} setDate={setDate} />}
    </div>
  );
}

// ── 情绪复盘（六维：市场温度/市场方向/情绪温度/连板梯队/连板负反馈/资金意图 + 周期判定）──
function EmotionReviewTab({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const qc = useQueryClient();
  const emotion = useEmotion();
  const volume = useVolume(5);
  const statsQ = useQuery({ queryKey: ['stats', 5], queryFn: () => api.stats(5), refetchInterval: 300000 });
  const sectorQ = useQuery({ queryKey: ['sector-flow', 'industry', 30], queryFn: () => api.sectorFlow('industry', 30), refetchInterval: 300000 });

  const st = emotion.data?.stats;
  const vols = volume.data?.series || [];
  const lastVol = vols[vols.length - 1]?.amount;
  const stats = statsQ.data?.data || [];
  const lastStat = stats[stats.length - 1];
  const flows = sectorQ.data?.list || [];
  const inFlow = flows.filter((f: any) => (f.mainNet || 0) > 0).sort((a: any, b: any) => (b.mainNet || 0) - (a.mainNet || 0)).slice(0, 5);
  const outFlow = flows.filter((f: any) => (f.mainNet || 0) < 0).sort((a: any, b: any) => (a.mainNet || 0) - (b.mainNet || 0)).slice(0, 5);

  // 连板梯队：主板 vs 创业板分组
  const ladder = emotion.data?.ladder || [];
  const mainLadder = ladder.filter(l => !l.stocks.some(s => s.code.startsWith('30') || s.code.startsWith('68')));
  const cybLadder = ladder.filter(l => l.stocks.some(s => s.code.startsWith('30') || s.code.startsWith('68')));

  // 负反馈：炸板率 + 断板（昨日涨停今日未涨停，由 emotionHistory 推）
  const histQ = useQuery({ queryKey: ['emotion-history-408'], queryFn: () => api.emotionHistoryFrom('20260408') });
  const histDaily = histQ.data?.daily || [];
  // 复盘日非交易日时自动落到最近交易日
  const effDate = histDaily.find((d: any) => d.date === date.replace(/-/g, '')) ? date.replace(/-/g, '') : histDaily[histDaily.length - 1]?.date;
  const todayIdx = histDaily.findIndex((d: any) => d.date === effDate);
  const negFeedback = useMemo(() => {
    if (todayIdx <= 0) return null;
    const today = histDaily[todayIdx], prev = histDaily[todayIdx - 1];
    const prevCodes = new Set((prev.ups || []).map((u: any) => u.code));
    const broken = (today.ups || []).filter((u: any) => prevCodes.has(u.code));
    const dead = [...prevCodes].filter(c => !(today.ups || []).some((u: any) => u.code === c));
    return { prevCount: prevCodes.size, promoted: broken.length, dead: dead.length, deadNames: dead.map(c => { const u = (prev.ups || []).find((x: any) => x.code === c); return u?.name; }).filter(Boolean).slice(0, 12) };
  }, [histDaily, todayIdx]);

  const [marketCycle, setMarketCycle] = useState('');
  const [emotionCycle, setEmotionCycle] = useState('');
  const [hotNote, setHotNote] = useState('');
  const [intent, setIntent] = useState('');
  const [negNote, setNegNote] = useState('');
  const [nextDir, setNextDir] = useState('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  const save = async () => {
    let existing: Record<string, any> = {};
    try { existing = (await api.reviewGet(date)).data?.data || {}; } catch { /* noop */ }
    await api.reviewSave({
      trade_date: date, summary: existing.summary || '', plan: existing.plan || '',
      data: { ...existing, emotionReview: { marketCycle, emotionCycle, hotNote, intent, negNote, nextDirection: nextDir, note } },
    });
    setSaved(true);
    qc.invalidateQueries({ queryKey: QK.reviews });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded border border-border bg-surface px-2 py-1 text-xs" />
        <button className="btn btn-sm btn-primary" onClick={save}>{saved ? '已保存 ✓' : '保存复盘'}</button>
        <span className="text-[10px] text-muted">六维数据自动带入收盘，人工确认周期与逻辑</span>
      </div>

      {/* 维度1 市场温度 + 维度2 市场方向 */}
      <div className="grid grid-cols-2 gap-4">
        <Card title="① 市场温度" hint="上下涨跌家数">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-elevated px-2 py-2 text-center"><div className="num text-xl font-bold text-bull">{lastStat?.up_count ?? '--'}</div><div className="text-[10px] text-muted">上涨</div></div>
            <div className="rounded-lg bg-elevated px-2 py-2 text-center"><div className="num text-xl font-bold text-bear">{lastStat?.down_count ?? '--'}</div><div className="text-[10px] text-muted">下跌</div></div>
            <div className="rounded-lg bg-elevated px-2 py-2 text-center"><div className="num text-xl font-bold">{lastStat?.flat_count ?? '--'}</div><div className="text-[10px] text-muted">平盘</div></div>
          </div>
        </Card>
        <Card title="② 市场方向" hint="成交量 + 板块资金流向">
          <div className="mb-2 flex items-center justify-between rounded-lg bg-elevated px-3 py-2">
            <span className="text-xs text-secondary">两市成交</span><span className="num text-base font-bold">{fmtAmount(lastVol)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-elevated px-2 py-1.5"><div className="mb-1 font-semibold text-bull">净流入 TOP3</div>{inFlow.slice(0, 3).map(f => <div key={f.name} className="flex justify-between"><span className="truncate">{f.name}</span><span className="num text-bull">+{(f.mainNet! / 1e8).toFixed(1)}亿</span></div>)}</div>
            <div className="rounded-lg bg-elevated px-2 py-1.5"><div className="mb-1 font-semibold text-bear">净流出 TOP3</div>{outFlow.slice(0, 3).map(f => <div key={f.name} className="flex justify-between"><span className="truncate">{f.name}</span><span className="num text-bear">{(f.mainNet! / 1e8).toFixed(1)}亿</span></div>)}</div>
          </div>
        </Card>
      </div>

      {/* 维度3 情绪温度 + 维度4 连板梯队 */}
      <div className="grid grid-cols-2 gap-4">
        <Card title="③ 情绪温度" hint="涨跌停家数">
          <div className="grid grid-cols-5 gap-2">
            <div className="rounded-lg bg-elevated px-2 py-2 text-center"><div className="num text-lg font-bold text-bull">{st?.limitUpCount ?? '--'}</div><div className="text-[10px] text-muted">涨停</div></div>
            <div className="rounded-lg bg-elevated px-2 py-2 text-center"><div className="num text-lg font-bold text-bear">{st?.limitDownCount ?? '--'}</div><div className="text-[10px] text-muted">跌停</div></div>
            <div className="rounded-lg bg-elevated px-2 py-2 text-center"><div className="num text-lg font-bold">{st?.brokenCount ?? '--'}</div><div className="text-[10px] text-muted">炸板</div></div>
            <div className="rounded-lg bg-elevated px-2 py-2 text-center"><div className={`num text-lg font-bold ${st && st.sealRate >= 70 ? 'text-bull' : 'text-bear'}`}>{st ? `${st.sealRate}%` : '--'}</div><div className="text-[10px] text-muted">封板率</div></div>
            <div className="rounded-lg bg-elevated px-2 py-2 text-center"><div className="num text-lg font-bold">{st ? `${st.maxStreak}板` : '--'}</div><div className="text-[10px] text-muted">最高板</div></div>
          </div>
        </Card>
        <Card title="④ 连板梯队" hint="主板-趋势中军/情绪连板 · 创业板">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-elevated px-2 py-1.5">
              <div className="mb-1 text-[10px] font-semibold text-accent">主板</div>
              {mainLadder.slice(0, 4).map(l => <div key={l.streak} className="flex justify-between text-[11px]"><span className="num">{l.streak}板 × {l.count}</span><span className="truncate pl-2 text-muted">{l.stocks.slice(0, 2).map(s => s.name).join('/')}</span></div>)}
              {mainLadder.length === 0 && <div className="text-[11px] text-muted">无</div>}
            </div>
            <div className="rounded-lg bg-elevated px-2 py-1.5">
              <div className="mb-1 text-[10px] font-semibold text-bull">创业板/科创</div>
              {cybLadder.slice(0, 4).map(l => <div key={l.streak} className="flex justify-between text-[11px]"><span className="num">{l.streak}板 × {l.count}</span><span className="truncate pl-2 text-muted">{l.stocks.slice(0, 2).map(s => s.name).join('/')}</span></div>)}
              {cybLadder.length === 0 && <div className="text-[11px] text-muted">无</div>}
            </div>
          </div>
        </Card>
      </div>

      {/* 维度5 连板负反馈 + 维度6 资金意图 */}
      <div className="grid grid-cols-2 gap-4">
        <Card title="⑤ 连板负反馈" hint="断板次日 · 连续负反馈">
          {negFeedback ? (
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between rounded-lg bg-elevated px-3 py-1.5"><span>昨日涨停 {negFeedback.prevCount} 只</span><span className="num text-bull">晋级 {negFeedback.promoted}</span></div>
              <div className="flex justify-between rounded-lg bg-elevated px-3 py-1.5"><span>断板（负反馈）</span><span className="num text-bear">{negFeedback.dead} 只</span></div>
              <div className="rounded-lg bg-elevated px-3 py-1.5"><div className="mb-1 font-semibold">断板股</div><div className="flex flex-wrap gap-1">{negFeedback.deadNames.map(n => <span key={n} className="rounded bg-bear/10 px-1.5 py-0.5 text-[10px] text-bear">{n}</span>)}{negFeedback.deadNames.length === 0 && '无'}</div></div>
              <input className="w-full rounded border border-border bg-surface px-2 py-1 text-[11px]" placeholder="负反馈备注（连板中炸板/大面等）" value={negNote} onChange={e => { setNegNote(e.target.value); setSaved(false); }} />
            </div>
          ) : <div className="py-4 text-center text-xs text-muted">历史数据未覆盖该日</div>}
        </Card>
        <Card title="⑥ 资金意图" hint="热点催化">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(emotion.data?.themeRank || []).slice(0, 8).map(t => (
              <span key={t.name} className="rounded bg-accent/10 px-2 py-1 text-[11px] font-medium text-accent">{t.name} {t.count}</span>
            ))}
          </div>
          <input className="w-full rounded border border-border bg-surface px-2 py-1 text-[11px]" placeholder="资金意图 / 热点催化备注" value={intent} onChange={e => { setIntent(e.target.value); setSaved(false); }} />
        </Card>
      </div>

      {/* 周期判定：市场周期 + 情绪周期 */}
      <Card title="周期判定" hint="市场周期（分化/修复/主升/高潮/退潮/冰点）× 情绪周期（主升/盘顶/退潮/混沌复苏）">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold text-accent">市场周期</div>
            <div className="flex flex-wrap gap-1.5">
              {['分化', '修复', '主升', '高潮', '退潮', '冰点'].map(c => (
                <Chip key={c} on={marketCycle === c} onClick={() => { setMarketCycle(c); setSaved(false); }}>{c}</Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold text-signal">情绪周期</div>
            <div className="flex flex-wrap gap-1.5">
              {['混沌复苏', '主升', '盘顶', '退潮'].map(c => (
                <Chip key={c} on={emotionCycle === c} onClick={() => { setEmotionCycle(c); setSaved(false); }}>{c}</Chip>
              ))}
            </div>
          </div>
        </div>
        {marketCycle && emotionCycle && (
          <div className="mt-3 rounded-lg bg-accent/5 px-4 py-2 text-[11px] ring-1 ring-accent/20">
            定位：市场<b className="text-accent">{marketCycle}</b> + 情绪<b className="text-signal">{emotionCycle}</b> → {marketCycle === '主升' && emotionCycle === '主升' ? '全面进攻，重仓主线' : marketCycle === '退潮' || emotionCycle === '退潮' ? '防守为主，控制仓位' : '结构性机会，跟随主线节奏'}
          </div>
        )}
      </Card>

      <Card title="操作逻辑与备注" hint="决策 · 下手顺序 · 明日预案">
        <div className="mb-2 flex items-center gap-2">
          <span className="w-16 flex-none text-xs text-secondary">明日方向</span>
          <input className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="如 CPO 光通信 / AI算力，可多个" value={nextDir} onChange={e => { setNextDir(e.target.value); setSaved(false); }} />
        </div>
        <div className="flex items-start gap-2">
          <span className="w-16 flex-none pt-1 text-xs text-secondary">复盘备注</span>
          <textarea className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs" rows={3} placeholder="今日复盘要点、明日关注、风险提示…" value={note} onChange={e => { setNote(e.target.value); setSaved(false); }} />
        </div>
      </Card>
    </div>
  );
}

// ── 归档 ──
function ArchiveTab() {
  const { data } = useReviews();
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const list = data?.data || [];

  const open = async (d: string) => {
    setSel(d);
    try { setDetail((await api.reviewGet(d)).data); } catch { /* noop */ }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card title="复盘归档">
        <div className="max-h-[520px] overflow-y-auto">
          {list.length === 0 && <div className="py-6 text-center text-xs text-muted">暂无归档</div>}
          {list.map(r => (
            <button key={r.id} onClick={() => open(r.trade_date)} className={`block w-full rounded-lg px-3 py-2 text-left transition-colors ${sel === r.trade_date ? 'bg-elevated' : 'hover:bg-elevated/60'}`}>
              <div className="num text-xs font-semibold">{r.trade_date}</div>
              <div className="truncate text-[11px] text-muted">{r.summary || '（无摘要）'}</div>
            </button>
          ))}
        </div>
      </Card>
      <Card title={detail ? `复盘 · ${detail.trade_date}` : '详情'}>
        {detail ? (
          <div className="space-y-3">
            <div><div className="text-[10px] font-semibold text-accent">当日要点</div><div className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{detail.summary || '（无）'}</div></div>
            <div><div className="text-[10px] font-semibold text-accent">次日预案</div><div className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{detail.plan || '（无）'}</div></div>
            {detail.data?.emotionReview && (
              <div className="rounded-lg bg-elevated p-3 text-xs">
                <div className="mb-1 flex flex-wrap gap-2">
                  <Badge tone="accent">{detail.data.emotionReview.marketCycle || '市场周期未定'}</Badge>
                  <Badge tone="danger">{detail.data.emotionReview.emotionCycle || '情绪周期未定'}</Badge>
                </div>
                {detail.data.emotionReview.nextDirection && <div>明日方向：{detail.data.emotionReview.nextDirection}</div>}
                {detail.data.emotionReview.intent && <div>资金意图：{detail.data.emotionReview.intent}</div>}
                {detail.data.emotionReview.note && <div className="mt-1 text-muted">{detail.data.emotionReview.note}</div>}
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-muted">点左侧归档查看详情</div>
        )}
      </Card>
    </div>
  );
}

// ── 心法清单 ──
function MindsetTab({ date, setDate }: { date: string; setDate: (d: string) => void }) {
  const qc = useQueryClient();
  const [checks, setChecks] = useState<string[]>(DEFAULT_CHECKS);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [newCheck, setNewCheck] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    try {
      const d = (await api.reviewGet(date)).data?.data || {};
      if (d.checklist) {
        setChecks(d.checklist.items || DEFAULT_CHECKS);
        setChecked(d.checklist.checked || {});
      } else {
        setChecks([...DEFAULT_CHECKS]); setChecked({});
      }
    } catch { setChecks([...DEFAULT_CHECKS]); setChecked({}); }
    setLoaded(true);
  };
  const save = async (c: string[], ch: Record<string, boolean>) => {
    let existing: Record<string, any> = {};
    try { existing = (await api.reviewGet(date)).data?.data || {}; } catch { /* noop */ }
    await api.reviewSave({ trade_date: date, summary: existing.summary || '', plan: existing.plan || '', data: { ...existing, checklist: { items: c, checked: ch } } });
    qc.invalidateQueries({ queryKey: QK.reviews });
  };

  // 首次挂载加载
  useMemo(() => { if (!loaded) load(); }, [loaded]);

  const toggle = (i: number) => {
    const key = checks[i];
    const next = { ...checked, [key]: !checked[key] };
    setChecked(next);
    save(checks, next);
  };
  const add = () => {
    if (!newCheck.trim()) return;
    const next = [...checks, newCheck.trim()];
    setChecks(next); setNewCheck('');
    save(next, checked);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input type="date" value={date} onChange={e => { setDate(e.target.value); setLoaded(false); }} className="rounded border border-border bg-surface px-2 py-1 text-xs" />
        <button className="btn btn-sm btn-primary" onClick={() => { setLoaded(false); }}>重新加载</button>
        <span className="text-[10px] text-muted">勾选状态按日期独立存档</span>
      </div>

      <Card title="核心心法">
        <div className="grid grid-cols-2 gap-3">
          {MINDSETS.map(m => (
            <div key={m.title} className="rounded-lg bg-elevated p-3">
              <div className="text-sm font-bold text-accent">{m.title}</div>
              <div className="mt-1 text-xs leading-relaxed text-secondary">{m.text}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="每日检查清单" hint={`已完成 ${Object.values(checked).filter(Boolean).length} / ${checks.length}`}>
        <div className="mb-2 flex gap-2">
          <input className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="新增检查项…" value={newCheck} onChange={e => setNewCheck(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
          <button className="btn btn-sm" onClick={add}>添加</button>
        </div>
        <div className="space-y-1.5">
          {checks.map((c, i) => (
            <div key={c} onClick={() => toggle(i)} className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 transition-colors ${checked[c] ? 'bg-elevated opacity-60' : 'bg-elevated/50 hover:bg-elevated'}`}>
              <span className={`grid h-4 w-4 flex-none place-items-center rounded border text-[10px] font-bold text-white ${checked[c] ? 'border-accent bg-accent' : 'border-border bg-surface'}`}>
                {checked[c] ? '✓' : ''}
              </span>
              <span className={`text-xs ${checked[c] ? 'line-through' : ''}`}>{c}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

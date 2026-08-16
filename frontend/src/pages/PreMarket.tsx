// 盘前预期 — 市场观察 / 参与策略 / 择时判定 / 持仓同步 / 买入计划 / 卖出计划 / 关注方向
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { QK, usePremarket, usePremarketDates, useEmotion } from '@/lib/useQueries';
import { Card, Chip, Badge, Empty } from '@/components/ui';
import { useQuery } from '@tanstack/react-query';

const MARKET_DIMS: [string, string[]][] = [
  ['市场周期', ['混沌期', '确认主升', '盘顶预期', '退潮叠加混沌']],
  ['市场趋势', ['上涨', '震荡', '下跌']],
  ['行情结构', ['扩散', '收敛', '分化']],
  ['资金信号', ['流入', '流出', '未判断']],
  ['情绪阶段', ['冰点', '修复', '发酵', '主升', '退潮']],
  ['资金状态', ['流入', '流出', '平衡']],
  ['择时信号', ['进攻', '震荡', '防守']],
];
const MODES = ['进攻', '正常', '防守', '不做'];

// 买入模式（用户定义）
const BUY_MODES = ['对称结构', 'N行结构', '回踩白线有效', '回踩黄线有效', '关键K', '单针', 'B1', 'B2', 'B3', '回踩均线有效', '厂字突破', '打板', '左侧埋伏', '砖型图', 'ABC波浪'];
// 卖出模式（用户定义）
const SELL_MODES = ['放飞止盈', '触发止损', 'S1', '滴滴', '破黄白', '死叉', '均线破位'];
// 市场周期 × 情绪周期 → 建议仓位与模式（择时判定）
const TIMING: Record<string, { pos: string; mode: string }> = {
  '主升_主升': { pos: '60-80%', mode: '进攻：打板/突破/回踩均线' },
  '主升_盘顶': { pos: '40-60%', mode: '震荡：回踩白线/关键K' },
  '修复_复苏': { pos: '40-60%', mode: '进攻：对称结构/左侧埋伏' },
  '修复_主升': { pos: '50-70%', mode: '进攻：N行/厂字突破' },
  '分化_退潮': { pos: '20-40%', mode: '防守：低吸/回踩黄线' },
  '退潮_退潮': { pos: '0-20%', mode: '防守：不做/打板观察' },
  '冰点_混沌': { pos: '0-30%', mode: '试探：单针/关键K' },
};
const MARKET_CYCLES = ['分化', '修复', '主升', '高潮', '退潮', '冰点'];
const EMOTION_CYCLES = ['混沌复苏', '主升', '盘顶', '退潮'];

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function PreMarket() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayStr());
  const [newDir, setNewDir] = useState('');

  const { data } = usePremarket(date);
  const { data: dates } = usePremarketDates();
  const emotion = useEmotion();

  // 买入/卖出计划（trade_plans 表）
  const plansQ = useQuery({ queryKey: ['plans', date], queryFn: () => api.plans(date.replace(/-/g, '')) });
  const plans = plansQ.data?.data || [];
  const buyPlans = plans.filter(p => p.side === 'buy');
  const sellPlans = plans.filter(p => p.side === 'sell');

  const [newBuy, setNewBuy] = useState({ code: '', name: '', mode: '', logic: '', tp: '', sl: '' });
  const [newSell, setNewSell] = useState({ code: '', name: '', mode: '', logic: '' });

  const bySection = useMemo(() => {
    const g: Record<string, any> = { market: null, strategy: null, directions: [], holdings: [] };
    for (const it of data?.items || []) {
      const p = it.payload;
      if (it.section === 'market') g.market = p;
      else if (it.section === 'strategy') g.strategy = p;
      else if (it.section === 'direction') g.directions.push(p);
      else if (it.section === 'holding') g.holdings.push(p);
      else if (it.section === 'target') g.holdings.push({ ...p, _legacy: true }); // 旧标的预案并入持仓同步
    }
    return g;
  }, [data]);

  // 持仓实时行情（现价/浮动盈亏）
  const holdingCodes = bySection.holdings.map((h: any) => h.code).filter(Boolean);
  const hqQ = useQuery({
    queryKey: ['quotes', holdingCodes.join(',')],
    queryFn: () => api.quotes(holdingCodes),
    enabled: holdingCodes.length > 0,
    refetchInterval: 60000,
  });
  const hqMap = useMemo(() => {
    const m: Record<string, { now: number; pct: number }> = {};
    for (const q of hqQ.data?.data || []) {
      const h = q.data?.HQInfo || {};
      const now = Number(h.Now) || 0;
      const base = Number(h.Close) || Number(h.Yield) || 0;
      m[q.code] = { now, pct: now && base ? +(((now - base) / base) * 100).toFixed(2) : 0 };
    }
    return m;
  }, [hqQ.data]);

  const ups = emotion.data?.limitUps || [];
  const dirStats = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of bySection.directions) {
      const kw = (d.name || '').toLowerCase();
      m[d.name] = ups.filter(s => String(s['涨停原因'] || '').toLowerCase().includes(kw) || String(s.sec_name || '').toLowerCase().includes(kw)).length;
    }
    return m;
  }, [bySection.directions, ups]);

  const save = async (section: string, itemKey: string, payload: Record<string, any>) => {
    await api.premarketSave({ trade_date: date, section, item_key: itemKey, payload });
    qc.invalidateQueries({ queryKey: QK.premarket(date) });
  };
  const refresh = () => qc.invalidateQueries({ queryKey: QK.premarket(date) });

  const dims = bySection.market?.dimensions || {};
  const strategy = bySection.strategy || {};

  // 择时判定：市场周期 + 情绪周期 → 建议
  const marketCycle = dims['市场周期'] || '分化';
  const emotionCycle = dims['情绪阶段'] || '混沌复苏';
  const timingKey = `${marketCycle}_${emotionCycle}`;
  const timing = TIMING[timingKey] || TIMING[`${marketCycle}_复苏`] || { pos: '30-50%', mode: '观望：等信号确认' };
  const totalPosPct = bySection.holdings.reduce((s: number, h: any) => s + (h.pos || 0), 0);

  const addPlan = async (side: 'buy' | 'sell') => {
    const b = side === 'buy' ? newBuy : newSell;
    if (!b.code.trim()) return;
    await api.planAdd({
      trade_date: date.replace(/-/g, ''), side,
      code: b.code.trim(), name: b.name.trim(), mode: b.mode, logic: b.logic,
      tp: (b as any).tp, sl: (b as any).sl,
    });
    qc.invalidateQueries({ queryKey: ['plans', date] });
    qc.invalidateQueries({ queryKey: ['watchlist'] });
    if (side === 'buy') setNewBuy({ code: '', name: '', mode: '', logic: '', tp: '', sl: '' });
    else setNewSell({ code: '', name: '', mode: '', logic: '' });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-base font-semibold">盘前预期</h1>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-btn border border-border bg-surface px-2 py-1 text-xs" />
        <button className="btn btn-sm" onClick={() => setDate(todayStr())}>今日</button>
        <button className="btn btn-sm" onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().slice(0, 10)); }}>‹</button>
        <div className="ml-2 flex items-center gap-1 text-[11px] text-muted">
          复制：{(dates?.dates || []).filter(d => d !== date).slice(0, 4).map((d: string) => (
            <button key={d} className="rounded bg-elevated px-1.5 py-0.5 hover:text-foreground" onClick={async () => { await api.premarketCopy(d, date); refresh(); }}>{d.slice(5)}</button>
          ))}
        </div>
      </div>

      {/* ① 盘前观察市场 */}
      <Card title="盘前观察市场" hint="市场周期定位 · 龙头的一生">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {MARKET_DIMS.map(([dim, opts]) => (
            <div key={dim} className="flex items-center gap-2">
              <span className="w-16 flex-none text-xs text-secondary">{dim}</span>
              <div className="flex flex-wrap gap-1">
                {opts.map(o => (
                  <Chip key={o} on={dims[dim] === o} onClick={() => save('market', '_', { dimensions: { ...dims, [dim]: o } })}>{o}</Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ② 参与策略 */}
      <Card title="盘前参与策略">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-secondary">参与模式</span>
            <div className="flex gap-1">
              {MODES.map(m => (
                <Chip key={m} on={strategy.mode === m} onClick={() => save('strategy', '_', { ...strategy, mode: m })}
                  color={m === '进攻' ? '#f04438' : m === '防守' ? '#12b76a' : m === '不做' ? '#71717a' : undefined}>{m}</Chip>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-1 text-xs text-secondary">总仓
            <input type="number" className="num w-16 rounded border border-border bg-surface px-2 py-1 text-right text-xs" value={strategy.totalPos ?? ''} onChange={e => save('strategy', '_', { ...strategy, totalPos: Number(e.target.value) })} />%
          </label>
          <label className="flex items-center gap-1 text-xs text-secondary">单笔止损
            <input type="number" className="num w-16 rounded border border-border bg-surface px-2 py-1 text-right text-xs" value={strategy.stopLoss ?? ''} onChange={e => save('strategy', '_', { ...strategy, stopLoss: Number(e.target.value) })} />%
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-secondary">下手模式</span>
            <select className="rounded border border-border bg-surface px-2 py-1 text-xs" value={strategy.tradeMode || ''} onChange={e => save('strategy', '_', { ...strategy, tradeMode: e.target.value })}>
              <option value="">未选</option>
              <option value="limitup">连板模式</option>
              <option value="tail">尾盘2点半</option>
              <option value="trend">趋势段</option>
            </select>
          </div>
        </div>
      </Card>

      {/* ③ 择时判定：市场周期 × 情绪周期 → 建议仓位/模式 */}
      <Card title="择时判定" hint="依据复盘中的市场周期与情绪周期，给出建议仓位与操作模式（邓总/青哥框架）">
        <div className="grid grid-cols-[1fr_1fr_1.6fr] gap-4">
          <div>
            <div className="mb-1 text-[11px] text-secondary">市场周期</div>
            <div className="flex flex-wrap gap-1">
              {MARKET_CYCLES.map(c => (
                <Chip key={c} on={marketCycle === c} onClick={() => save('market', '_', { dimensions: { ...dims, '市场周期': c } })}>{c}</Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-secondary">情绪周期</div>
            <div className="flex flex-wrap gap-1">
              {EMOTION_CYCLES.map(c => (
                <Chip key={c} on={emotionCycle === c} onClick={() => save('market', '_', { dimensions: { ...dims, '情绪阶段': c } })}>{c}</Chip>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-accent/5 px-4 py-2 ring-1 ring-accent/20">
            <div className="text-[11px] text-accent">建议仓位</div>
            <div className="num text-xl font-bold">{timing.pos}</div>
            <div className="mt-1 text-[11px] text-secondary">操作模式：{timing.mode}</div>
          </div>
        </div>
      </Card>

      {/* ④ 持仓同步 */}
      <Card title="持仓同步" hint="持仓个股与持仓比例（盘前快照 · 实时盈亏）">
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-[11px] text-secondary">
            <span>合计仓位</span><span className={`num font-semibold ${totalPosPct > 100 ? 'text-signal' : ''}`}>{totalPosPct.toFixed(0)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-elevated">
            <div className="h-full rounded-full" style={{ width: `${Math.min(totalPosPct, 100)}%`, background: 'linear-gradient(90deg,#1d4ed8,#c8341f)' }} />
          </div>
        </div>
        {bySection.holdings.length === 0 && <Empty text="暂无持仓录入，在下方添加" />}
        {bySection.holdings.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">股票</th><th className="th">现价</th><th className="th">成本</th><th className="th">浮动盈亏</th><th className="th">仓位</th><th className="th">动作</th><th className="th">条件</th><th className="th"></th></tr></thead>
              <tbody>
                {bySection.holdings.map((h: any) => {
                  const q = hqMap[h.code];
                  const pnl = q?.now && h.cost ? +(((q.now - h.cost) / h.cost) * 100).toFixed(2) : null;
                  return (
                    <tr key={h.code}>
                      <td className="td"><b>{h.name}</b> <span className="num text-[10px] text-muted">{h.code}</span>{h._legacy && <Badge tone="warn">旧</Badge>}</td>
                      <td className="td num">{q?.now ? q.now.toFixed(2) : '--'}</td>
                      <td className="td num">{h.cost ?? '--'}</td>
                      <td className={`td num ${pnl != null ? (pnl >= 0 ? 'text-bull' : 'text-bear') : 'text-muted'}`}>{pnl != null ? `${pnl >= 0 ? '+' : ''}${pnl}%` : '--'}</td>
                      <td className="td num">{h.pos ?? '--'}%</td>
                      <td className="td"><Badge>{h.action}</Badge></td>
                      <td className="td text-muted">{h.condition}</td>
                      <td className="td"><button className="text-[10px] text-danger hover:underline" onClick={async () => { const it = data?.items.find(i => i.section === 'holding' && i.item_key === h.code); if (it) { await api.premarketDelete(it.id); refresh(); } }}>删</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2 border-t border-border/40 pt-2">
          <HoldingAdd date={date} save={save} refresh={refresh} data={data} />
        </div>
      </Card>

      {/* ⑤ 买入计划 */}
      <Card title="买入计划" hint="添加后自动加入自选，并在核心个股模块呈现">
        <div className="mb-2 flex flex-wrap gap-2">
          <input className="w-20 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="代码" value={newBuy.code} onChange={e => setNewBuy({ ...newBuy, code: e.target.value })} />
          <input className="w-24 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="名称" value={newBuy.name} onChange={e => setNewBuy({ ...newBuy, name: e.target.value })} />
          <select className="rounded border border-border bg-surface px-2 py-1 text-xs" value={newBuy.mode} onChange={e => setNewBuy({ ...newBuy, mode: e.target.value })}>
            <option value="">买入模式</option>
            {BUY_MODES.map(m => <option key={m}>{m}</option>)}
          </select>
          <input className="w-44 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="买入逻辑" value={newBuy.logic} onChange={e => setNewBuy({ ...newBuy, logic: e.target.value })} />
          <input className="w-16 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="止盈" value={newBuy.tp} onChange={e => setNewBuy({ ...newBuy, tp: e.target.value })} />
          <input className="w-16 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="止损" value={newBuy.sl} onChange={e => setNewBuy({ ...newBuy, sl: e.target.value })} />
          <button className="btn btn-sm btn-primary" onClick={() => addPlan('buy')}>添加</button>
        </div>
        {buyPlans.length === 0 && <Empty text="暂无买入计划" />}
        {buyPlans.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">股票</th><th className="th">买入模式</th><th className="th">买入逻辑</th><th className="th">止盈</th><th className="th">止损</th><th className="th">状态</th><th className="th"></th></tr></thead>
              <tbody>
                {buyPlans.map(p => (
                  <tr key={p.id}>
                    <td className="td"><b>{p.name}</b> <span className="num text-[10px] text-muted">{p.code}</span></td>
                    <td className="td"><Badge tone="bull">{p.mode}</Badge></td>
                    <td className="td text-muted">{p.logic}</td>
                    <td className="td num">{p.tp || '--'}</td>
                    <td className="td num">{p.sl || '--'}</td>
                    <td className="td">
                      <select className="rounded border border-border bg-surface px-1 py-0.5 text-[11px]" value={p.status} onChange={e => { api.planPatch(p.id, { status: e.target.value }); qc.invalidateQueries({ queryKey: ['plans', date] }); }}>
                        {['pending', 'done', 'cancel'].map(s => <option key={s} value={s}>{s === 'pending' ? '待执行' : s === 'done' ? '已执行' : '已取消'}</option>)}
                      </select>
                    </td>
                    <td className="td"><button className="text-[10px] text-danger hover:underline" onClick={async () => { await api.planDelete(p.id); qc.invalidateQueries({ queryKey: ['plans', date] }); }}>删</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ⑥ 卖出计划 */}
      <Card title="卖出计划">
        <div className="mb-2 flex flex-wrap gap-2">
          <input className="w-20 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="代码" value={newSell.code} onChange={e => setNewSell({ ...newSell, code: e.target.value })} />
          <input className="w-24 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="名称" value={newSell.name} onChange={e => setNewSell({ ...newSell, name: e.target.value })} />
          <select className="rounded border border-border bg-surface px-2 py-1 text-xs" value={newSell.mode} onChange={e => setNewSell({ ...newSell, mode: e.target.value })}>
            <option value="">卖出模式</option>
            {SELL_MODES.map(m => <option key={m}>{m}</option>)}
          </select>
          <input className="w-44 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="卖出逻辑" value={newSell.logic} onChange={e => setNewSell({ ...newSell, logic: e.target.value })} />
          <button className="btn btn-sm btn-primary" onClick={() => addPlan('sell')}>添加</button>
        </div>
        {sellPlans.length === 0 && <Empty text="暂无卖出计划" />}
        {sellPlans.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th className="th">股票</th><th className="th">卖出模式</th><th className="th">卖出逻辑</th><th className="th">状态</th><th className="th"></th></tr></thead>
              <tbody>
                {sellPlans.map(p => (
                  <tr key={p.id}>
                    <td className="td"><b>{p.name}</b> <span className="num text-[10px] text-muted">{p.code}</span></td>
                    <td className="td"><Badge tone="bear">{p.mode}</Badge></td>
                    <td className="td text-muted">{p.logic}</td>
                    <td className="td">
                      <select className="rounded border border-border bg-surface px-1 py-0.5 text-[11px]" value={p.status} onChange={e => { api.planPatch(p.id, { status: e.target.value }); qc.invalidateQueries({ queryKey: ['plans', date] }); }}>
                        {['pending', 'done', 'cancel'].map(s => <option key={s} value={s}>{s === 'pending' ? '待执行' : s === 'done' ? '已执行' : '已取消'}</option>)}
                      </select>
                    </td>
                    <td className="td"><button className="text-[10px] text-danger hover:underline" onClick={async () => { await api.planDelete(p.id); qc.invalidateQueries({ queryKey: ['plans', date] }); }}>删</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ⑦ 关注方向 */}
      <Card title="盘前关注方向" hint="盘中自动统计各方向今日涨停数">
        <div className="mb-2 flex gap-2">
          <input className="rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="方向名，如 CPO / AIGC" value={newDir} onChange={e => setNewDir(e.target.value)} onKeyDown={async e => { if (e.key === 'Enter' && newDir.trim()) { await save('direction', newDir.trim(), { name: newDir.trim(), states: [{ status: '观察', text: '' }] }); setNewDir(''); } }} />
          <button className="btn btn-sm btn-primary" onClick={async () => { if (newDir.trim()) { await save('direction', newDir.trim(), { name: newDir.trim(), states: [{ status: '观察', text: '' }] }); setNewDir(''); } }}>添加</button>
        </div>
        {bySection.directions.length === 0 && <Empty text="暂无关注方向" />}
        <div className="grid grid-cols-2 gap-3">
          {bySection.directions.map((d: any) => (
            <div key={d.name} className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm font-semibold">{d.name}</span>
                <span className={`num ml-auto text-xs ${dirStats[d.name] ? 'text-bull' : 'text-muted'}`}>今日涨停 {dirStats[d.name] ?? 0}</span>
                <button className="text-[10px] text-danger hover:underline" onClick={async () => {
                  const it = data?.items.find(i => i.section === 'direction' && i.item_key === d.name);
                  if (it) { await api.premarketDelete(it.id); refresh(); }
                }}>删</button>
              </div>
              <div className="space-y-1">
                {d.states.map((s: any, i: number) => (
                  <div key={i} className="flex gap-1.5">
                    <select className="rounded border border-border bg-surface px-1.5 py-0.5 text-[11px]" value={s.status} onChange={e => {
                      const states = d.states.map((x: any, j: number) => j === i ? { ...x, status: e.target.value } : x);
                      save('direction', d.name, { ...d, states });
                    }}>
                      {['观察', '验证', '失败'].map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                    <input className="flex-1 rounded border border-border bg-surface px-1.5 py-0.5 text-[11px]" placeholder="条件，如 放量 / 跌破低点" value={s.text} onChange={e => {
                      const states = d.states.map((x: any, j: number) => j === i ? { ...x, text: e.target.value } : x);
                      save('direction', d.name, { ...d, states });
                    }} />
                  </div>
                ))}
                <button className="text-[11px] text-accent hover:underline" onClick={() => save('direction', d.name, { ...d, states: [...d.states, { status: '验证', text: '' }] })}>+ 状态</button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// 持仓添加（内嵌小组件）
function HoldingAdd({ date, save, refresh, data }: any) {
  const [h, setH] = useState({ code: '', name: '', cost: '', pos: '', action: '持有', condition: '' });
  return (
    <>
      <input className="w-20 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="代码" value={h.code} onChange={e => setH({ ...h, code: e.target.value })} />
      <input className="w-24 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="名称" value={h.name} onChange={e => setH({ ...h, name: e.target.value })} />
      <input className="w-16 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="成本" value={h.cost} onChange={e => setH({ ...h, cost: e.target.value })} />
      <input className="w-16 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="仓位%" value={h.pos} onChange={e => setH({ ...h, pos: e.target.value })} />
      <select className="rounded border border-border bg-surface px-2 py-1 text-xs" value={h.action} onChange={e => setH({ ...h, action: e.target.value })}>
        {['持有', '加仓', '减仓', '卖出', '观望'].map(a => <option key={a}>{a}</option>)}
      </select>
      <input className="w-48 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="持有/离场条件" value={h.condition} onChange={e => setH({ ...h, condition: e.target.value })} />
      <button className="btn btn-sm btn-primary" onClick={async () => {
        if (!h.code.trim()) return;
        await save('holding', h.code.trim(), {
          code: h.code.trim(), name: h.name.trim(), cost: h.cost ? Number(h.cost) : null,
          pos: h.pos ? Number(h.pos) : null, action: h.action, condition: h.condition.trim(),
        });
        setH({ code: '', name: '', cost: '', pos: '', action: '持有', condition: '' });
      }}>添加</button>
    </>
  );
}

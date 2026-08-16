// 持仓分析 — 持仓汇总 + 胜率统计 + 归因分析 + 操作建议 + 模式检验 + 交割单导入（仅盘后）
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { api, type Trade } from '@/lib/api';
import { QK, useTrades } from '@/lib/useQueries';
import { Card, Badge, Empty } from '@/components/ui';

const BUY_MODES = ['对称结构', 'N行结构', '回踩白线有效', '回踩黄线有效', '关键K', '单针', 'B1', 'B2', 'B3', '回踩均线有效', '厂字突破', '打板', '左侧埋伏', '砖型图', 'ABC波浪'];
const SELL_MODES = ['放飞止盈', '触发止损', 'S1', '滴滴', '破黄白', '死叉', '均线破位'];

export default function Positions() {
  const qc = useQueryClient();
  const { data } = useTrades();
  const trades: Trade[] = useMemo(() => [...(data?.data || [])].sort((a, b) => a.trade_date.localeCompare(b.trade_date)), [data]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<'positions' | 'stats' | 'modes'>('positions');

  // 汇总持仓（加权平均成本）
  const positions = useMemo(() => {
    const m: Record<string, any> = {};
    for (const t of trades) {
      if (!m[t.code]) m[t.code] = { code: t.code, name: t.name || '', shares: 0, costSum: 0, realized: 0, buys: 0, sells: 0 };
      const p = m[t.code];
      if (t.side === 'buy') {
        const cost = t.price != null ? t.price : t.amount && t.shares ? t.amount / t.shares : 0;
        const sh = t.shares || 0;
        p.shares += sh; p.costSum += cost * sh; p.buys++;
      } else {
        const sh = t.shares || 0;
        if (p.costSum > 0 && p.shares > 0) {
          const avg = p.costSum / p.shares;
          p.realized += (t.price != null ? t.price - avg : 0) * Math.min(sh, p.shares);
        }
        p.shares -= sh; p.sells++;
        if (p.shares < 0) p.shares = 0;
      }
    }
    return Object.values(m).filter(p => p.shares > 0).map(p => ({ ...p, avgCost: +(p.costSum / p.shares).toFixed(3) }));
  }, [trades]);

  // 胜率统计：按 code 配对（买→卖闭环）计算每笔平仓盈亏
  const closedTrades = useMemo(() => {
    const out: { code: string; name: string; buyDate: string; sellDate: string; pnl: number; buyMode: string; sellMode: string; side: string }[] = [];
    const open: Record<string, { date: string; price: number; shares: number; mode: string }[]> = {};
    for (const t of trades) {
      const sh = t.shares || 0;
      if (!sh) continue;
      if (t.side === 'buy') {
        (open[t.code] ||= []).push({ date: t.trade_date, price: t.price ?? 0, shares: sh, mode: t.mode || '' });
      } else {
        let remaining = sh;
        const sMode = t.mode || '';
        while (remaining > 0 && (open[t.code] || []).length) {
          const o = open[t.code][0];
          const closeShares = Math.min(o.shares, remaining);
          const pnl = (t.price ?? o.price - o.price) * closeShares;
          out.push({ code: t.code, name: t.name || '', buyDate: o.date, sellDate: t.trade_date, pnl, buyMode: o.mode, sellMode: sMode, side: 'closed' });
          o.shares -= closeShares; remaining -= closeShares;
          if (o.shares <= 0) open[t.code].shift();
        }
      }
    }
    return out;
  }, [trades]);

  const wins = closedTrades.filter(c => c.pnl > 0);
  const losses = closedTrades.filter(c => c.pnl < 0);
  const winRate = closedTrades.length ? +(wins.length / closedTrades.length * 100).toFixed(1) : null;
  const avgWin = wins.length ? wins.reduce((s, c) => s + c.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, c) => s + c.pnl, 0)) / losses.length : 0;
  const profitFactor = avgLoss > 0 ? +(avgWin / avgLoss).toFixed(2) : null;
  const totalPnl = closedTrades.reduce((s, c) => s + c.pnl, 0);

  // 归因：按股票
  const attribution = useMemo(() => {
    const m: Record<string, { code: string; name: string; pnl: number; n: number }> = {};
    for (const c of closedTrades) {
      (m[c.code] ||= { code: c.code, name: c.name, pnl: 0, n: 0 }).pnl += c.pnl;
      m[c.code].n++;
    }
    return Object.values(m).sort((a, b) => b.pnl - a.pnl);
  }, [closedTrades]);

  // 模式检验：按买入模式/卖出模式统计
  const modeStats = useMemo(() => {
    const byMode: Record<string, { mode: string; n: number; win: number; pnl: number }> = {};
    for (const c of closedTrades) {
      for (const key of [c.buyMode, c.sellMode]) {
        if (!key) continue;
        (byMode[key] ||= { mode: key, n: 0, win: 0, pnl: 0 }).n++;
        byMode[key].pnl += c.pnl;
        if (c.pnl > 0) byMode[key].win++;
      }
    }
    return Object.values(byMode).sort((a, b) => b.pnl - a.pnl);
  }, [closedTrades]);

  // 操作建议（规则引擎）
  const advice = useMemo(() => {
    const list: string[] = [];
    if (winRate == null) return ['暂无平仓记录，导入交割单或录入操作后自动生成统计与建议'];
    list.push(`胜率 ${winRate}%${winRate >= 50 ? '，处于合格线上' : '，低于 50% 需收敛出手频率'}；盈亏比 ${profitFactor ?? '--'}${(profitFactor ?? 0) >= 1.5 ? '，赚钱效应健康' : '，偏弱，注意截断亏损'}`);
    if (positions.length > 5) list.push(`当前持仓 ${positions.length} 只偏多，短线建议集中到 3~5 只主线，减少跟踪成本`);
    const losers = attribution.filter(a => a.pnl < 0).slice(0, 2);
    if (losers.length) list.push(`主要亏损来自 ${losers.map(l => `${l.name}(${l.pnl < 0 ? '-' : ''}${(Math.abs(l.pnl) / 1e4).toFixed(1)}万)`) .join('、')}，复盘买入逻辑是否失效`);
    const topMode = modeStats[0];
    if (topMode && topMode.n >= 2) list.push(`盈利贡献最大模式：${topMode.mode}（${topMode.n}笔，+${(topMode.pnl / 1e4).toFixed(1)}万），可优先复用`);
    return list;
  }, [winRate, profitFactor, positions.length, attribution, modeStats]);

  const totalCost = positions.reduce((s, p) => s + p.avgCost * p.shares, 0);
  const sellTotal = trades.filter(t => t.side === 'sell').reduce((s, t) => s + (t.amount || 0), 0);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result).split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { setMsg('文件为空或格式不对'); return; }
      const header = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      const col = (names: string[]) => header.findIndex(h => names.some(n => h.includes(n)));
      const idx = {
        date: col(['日期', '成交日期', '发生日期']),
        code: col(['代码', '证券代码', '股票代码']),
        name: col(['名称', '证券名称', '股票名称']),
        side: col(['操作', '方向', '买卖', '业务']),
        price: col(['价格', '成交价格', '成交均价']),
        shares: col(['数量', '成交数量', '股数']),
        amount: col(['金额', '成交金额', '发生金额']),
      };
      if (idx.code < 0 || idx.side < 0) { setMsg('无法识别列：需要 日期/代码/方向(买卖)/价格/数量'); return; }
      const rows = [];
      for (const line of lines.slice(1)) {
        const p = line.split(',').map(x => x.trim().replace(/^["']|["']$/g, ''));
        const s = String(p[idx.side] || '').toLowerCase();
        const side = s.includes('买') || s.includes('buy') ? 'buy' : s.includes('卖') || s.includes('sell') ? 'sell' : null;
        if (!side) continue;
        rows.push({
          date: idx.date >= 0 ? (p[idx.date] || '').replace(/[-\/]/g, '') : '',
          code: p[idx.code] || '', name: idx.name >= 0 ? p[idx.name] || '' : '', side,
          price: idx.price >= 0 && p[idx.price] ? Number(p[idx.price]) : null,
          shares: idx.shares >= 0 && p[idx.shares] ? Number(p[idx.shares]) : null,
          amount: idx.amount >= 0 && p[idx.amount] ? Number(p[idx.amount]) : null,
          note: '交割单导入',
        });
      }
      if (!rows.length) { setMsg('解析到 0 条有效记录（检查方向列是否为 买入/卖出）'); return; }
      api.importTrades(rows).then(r => {
        setMsg(`✅ 导入 ${r.ok} 条，跳过 ${r.skip} 条`);
        qc.invalidateQueries({ queryKey: QK.trades });
      }).catch(err => setMsg(`导入失败: ${err.message}`));
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const reversed = [...trades].reverse();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-base font-semibold">持仓分析 · 盘后</h1>
        <button className={`btn btn-sm ${tab === 'positions' ? 'btn-primary' : ''}`} onClick={() => setTab('positions')}>持仓</button>
        <button className={`btn btn-sm ${tab === 'stats' ? 'btn-primary' : ''}`} onClick={() => setTab('stats')}>胜率·归因·建议</button>
        <button className={`btn btn-sm ${tab === 'modes' ? 'btn-primary' : ''}`} onClick={() => setTab('modes')}>操作模式检验</button>
      </div>

      {/* 总览 KPI */}
      <div className="grid grid-cols-5 gap-3">
        <div className="card card-pad text-center"><div className="num text-2xl font-bold text-accent">{positions.length}</div><div className="mt-1 text-[11px] text-muted">持仓股票</div></div>
        <div className="card card-pad text-center"><div className="num text-2xl font-bold">{(totalCost / 1e4).toFixed(0)}万</div><div className="mt-1 text-[11px] text-muted">持仓成本</div></div>
        <div className="card card-pad text-center"><div className={`num text-2xl font-bold ${winRate != null && winRate >= 50 ? 'text-bull' : 'text-bear'}`}>{winRate != null ? `${winRate}%` : '--'}</div><div className="mt-1 text-[11px] text-muted">胜率</div></div>
        <div className="card card-pad text-center"><div className="num text-2xl font-bold">{profitFactor ?? '--'}</div><div className="mt-1 text-[11px] text-muted">盈亏比</div></div>
        <div className="card card-pad text-center"><div className={`num text-2xl font-bold ${totalPnl >= 0 ? 'text-bull' : 'text-bear'}`}>{totalPnl >= 0 ? '+' : ''}{(totalPnl / 1e4).toFixed(1)}万</div><div className="mt-1 text-[11px] text-muted">平仓盈亏</div></div>
      </div>

      {tab === 'positions' && (
        <>
          <Card title="当前持仓">
            {positions.length === 0 ? (
              <Empty text="暂无持仓。导入交割单或到「操作记录」录入买卖" />
            ) : (
              <table className="w-full">
                <thead><tr><th className="th">代码</th><th className="th">名称</th><th className="th">持仓股数</th><th className="th">平均成本</th><th className="th">持仓市值</th><th className="th">累计已实现</th></tr></thead>
                <tbody>
                  {positions.map(p => (
                    <tr key={p.code}>
                      <td className="td num">{p.code}</td>
                      <td className="td">{p.name}</td>
                      <td className="td num">{p.shares}</td>
                      <td className="td num">{p.avgCost}</td>
                      <td className="td num">{(p.avgCost * p.shares / 1e4).toFixed(1)}万</td>
                      <td className={`td num ${p.realized >= 0 ? 'text-bull' : 'text-bear'}`}>{(p.realized / 1e4).toFixed(2)}万</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="操作记录" hint={`共 ${trades.length} 条`}>
            {trades.length === 0 ? (
              <Empty text="暂无操作记录" />
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full">
                  <thead><tr><th className="th">日期</th><th className="th">方向</th><th className="th">代码</th><th className="th">名称</th><th className="th">价格</th><th className="th">股数</th><th className="th">金额</th><th className="th">模式</th><th className="th">备注</th></tr></thead>
                  <tbody>
                    {reversed.slice(0, 80).map(t => (
                      <tr key={t.id}>
                        <td className="td num text-muted">{t.trade_date}</td>
                        <td className="td"><Badge tone={t.side === 'buy' ? 'bull' : 'bear'}>{t.side === 'buy' ? '买' : '卖'}</Badge></td>
                        <td className="td num">{t.code}</td>
                        <td className="td">{t.name}</td>
                        <td className="td num">{t.price ?? '--'}</td>
                        <td className="td num">{t.shares ?? '--'}</td>
                        <td className="td num">{t.amount ? (t.amount / 1e4).toFixed(1) + '万' : '--'}</td>
                        <td className="td"><ModeSelect t={t} /></td>
                        <td className="td text-muted">{t.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="card card-pad flex flex-col items-center justify-center gap-2">
            <div className="text-sm font-semibold">📄 导入交割单</div>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={onFile} />
            <button className="btn btn-sm btn-primary" onClick={() => fileRef.current?.click()}>选择 CSV 文件</button>
            {msg && <div className="text-[10px] text-muted">{msg}</div>}
          </div>
        </>
      )}

      {tab === 'stats' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card title="胜率统计" hint={`${closedTrades.length} 笔平仓`}>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-elevated px-2 py-2"><div className="num text-lg font-bold text-bull">{wins.length}</div><div className="text-[10px] text-muted">盈利笔</div></div>
                <div className="rounded-lg bg-elevated px-2 py-2"><div className="num text-lg font-bold text-bear">{losses.length}</div><div className="text-[10px] text-muted">亏损笔</div></div>
                <div className="rounded-lg bg-elevated px-2 py-2"><div className="num text-lg font-bold">{(avgWin / 1e4).toFixed(1)}万</div><div className="text-[10px] text-muted">平均盈利</div></div>
                <div className="rounded-lg bg-elevated px-2 py-2"><div className="num text-lg font-bold">{(avgLoss / 1e4).toFixed(1)}万</div><div className="text-[10px] text-muted">平均亏损</div></div>
              </div>
            </Card>
            <Card title="归因分析" hint="按股票盈亏贡献">
              <div className="max-h-[240px] space-y-1 overflow-y-auto">
                {attribution.map(a => (
                  <div key={a.code} className="flex items-center justify-between rounded-lg bg-elevated px-2.5 py-1.5 text-[11px]">
                    <span className="truncate">{a.name} <span className="num text-muted">×{a.n}</span></span>
                    <span className={`num font-semibold ${a.pnl >= 0 ? 'text-bull' : 'text-bear'}`}>{a.pnl >= 0 ? '+' : ''}{(a.pnl / 1e4).toFixed(1)}万</span>
                  </div>
                ))}
                {attribution.length === 0 && <Empty text="暂无归因数据" />}
              </div>
            </Card>
            <Card title="操作建议" hint="基于胜率/盈亏比/持仓/模式自动生成">
              <div className="space-y-2">
                {advice.map((a, i) => (
                  <div key={i} className="rounded-lg bg-accent/5 px-3 py-2 text-[11px] leading-relaxed ring-1 ring-accent/15">{a}</div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      {tab === 'modes' && (
        <Card title="操作模式检验" hint="为操作记录标注模式后统计胜率（买入模式/卖出模式分开）">
          <div className="mb-3 text-[11px] text-muted">在「持仓」tab 的操作记录里为每笔交易选择模式，统计自动更新</div>
          {modeStats.length === 0 ? (
            <Empty text="暂无模式数据：先给操作记录标注模式" />
          ) : (
            <table className="w-full">
              <thead><tr><th className="th">模式</th><th className="th">笔数</th><th className="th">盈利笔</th><th className="th">胜率</th><th className="th">累计盈亏</th></tr></thead>
              <tbody>
                {modeStats.map(m => (
                  <tr key={m.mode}>
                    <td className="td"><Badge tone={m.pnl >= 0 ? 'bull' : 'bear'}>{m.mode}</Badge></td>
                    <td className="td num">{m.n}</td>
                    <td className="td num">{m.win}</td>
                    <td className="td num">{m.n ? `${(m.win / m.n * 100).toFixed(0)}%` : '--'}</td>
                    <td className={`td num ${m.pnl >= 0 ? 'text-bull' : 'text-bear'}`}>{m.pnl >= 0 ? '+' : ''}{(m.pnl / 1e4).toFixed(1)}万</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}

// 模式选择下拉
function ModeSelect({ t }: { t: Trade }) {
  const qc = useQueryClient();
  const options = t.side === 'buy' ? BUY_MODES : SELL_MODES;
  return (
    <select
      className="rounded border border-border bg-surface px-1 py-0.5 text-[10px]"
      value={t.mode || ''}
      onChange={async e => {
        await api.tradeModeUpdate(t.id, e.target.value);
        qc.invalidateQueries({ queryKey: QK.trades });
      }}
    >
      <option value="">未标注</option>
      {options.map(m => <option key={m}>{m}</option>)}
    </select>
  );
}

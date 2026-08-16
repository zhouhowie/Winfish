// 自选（观察池）— 分组 + 实时行情
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { QK, useWatchlist } from '@/lib/useQueries';
import { Card, Empty } from '@/components/ui';
import { fmtPct, pctClass, fmtAmount, fmtNum } from '@/lib/format';

const GROUPS = ['默认', '核心', '题材', '防御', '游资'];

export default function Watchlist() {
  const qc = useQueryClient();
  const { data } = useWatchlist();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [group, setGroup] = useState('默认');

  const items = data?.data || [];
  const codes = useMemo(() => items.map(i => i.code), [items]);

  const quotesQ = useQuery({
    queryKey: ['quotes-watch', codes.join(',')],
    queryFn: () => api.quotes(codes),
    enabled: codes.length > 0,
    refetchInterval: 30000,
  });

  const quotes = useMemo(() => {
    const m: Record<string, { now: number; pctChg: number | null; amount: number; name: string }> = {};
    for (const q of quotesQ.data?.data || []) {
      const h = q.data?.HQInfo || {};
      const b = q.data?.BaseInfo || {};
      m[q.code] = {
        now: h.Now as number,
        pctChg: h.Now != null && (h.Close || h.Yield) ? +(((h.Now as number - (h.Close as number || h.Yield as number)) / (h.Close as number || h.Yield as number)) * 100).toFixed(2) : null,
        amount: h.Amount as number,
        name: b.Name || '',
      };
    }
    return m;
  }, [quotesQ.data]);

  const add = async () => {
    if (!code.trim()) return;
    await api.watchAdd({ code: code.trim(), name: name.trim() || undefined, group_name: group });
    setCode(''); setName('');
    qc.invalidateQueries({ queryKey: QK.watchlist });
  };
  const remove = async (c: string) => {
    await api.watchRemove(c);
    qc.invalidateQueries({ queryKey: QK.watchlist });
  };

  const visibleGroups = GROUPS.filter(g => items.some(i => i.group_name === g));

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold">自选 · 观察池</h1>

      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <input className="w-24 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="代码" value={code} onChange={e => setCode(e.target.value)} />
          <input className="w-28 rounded border border-border bg-surface px-2 py-1 text-xs" placeholder="名称" value={name} onChange={e => setName(e.target.value)} />
          <select className="rounded border border-border bg-surface px-2 py-1 text-xs" value={group} onChange={e => setGroup(e.target.value)}>
            {GROUPS.map(g => <option key={g}>{g}</option>)}
          </select>
          <button className="btn btn-sm btn-primary" onClick={add}>添加</button>
        </div>

        {items.length === 0 && <div className="py-8 text-center text-xs text-muted">观察池为空，添加股票后自动加载实时行情</div>}

        {visibleGroups.map(g => (
          <div key={g} className="mb-3">
            <div className="mb-1 text-[10px] font-semibold tracking-widest text-accent">{g}</div>
            <table className="w-full">
              <thead><tr><th className="th">代码</th><th className="th">名称</th><th className="th">现价</th><th className="th">涨跌幅</th><th className="th">成交额</th><th className="th">备注</th><th className="th"></th></tr></thead>
              <tbody>
                {items.filter(i => i.group_name === g).map(it => {
                  const q = quotes[it.code];
                  return (
                    <tr key={it.code}>
                      <td className="td num">{it.code}</td>
                      <td className="td">{q?.name || it.name || '--'}</td>
                      <td className={`td num ${pctClass(q?.pctChg)}`}>{fmtNum(q?.now)}</td>
                      <td className={`td num ${pctClass(q?.pctChg)}`}>{fmtPct(q?.pctChg)}</td>
                      <td className="td num text-muted">{fmtAmount(q?.amount)}</td>
                      <td className="td text-muted">{it.note}</td>
                      <td className="td"><button className="text-[10px] text-danger hover:underline" onClick={() => remove(it.code)}>删</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </Card>
    </div>
  );
}

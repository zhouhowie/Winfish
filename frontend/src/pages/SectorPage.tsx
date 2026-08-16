// 板块资金雷达 — 独立导航页（OneChart 风格）
import { useState } from 'react';
import { useKgSector } from '@/lib/useQueries';
import { Card } from '@/components/ui';
import { fmtPct, pctClass } from '@/lib/format';

const SORTS = [
  { key: 'score', label: '加权评分' },
  { key: 'ratio', label: '波段流入率' },
  { key: 'net', label: '单日净额' },
];

export default function SectorPage() {
  const [type, setType] = useState<'concept' | 'industry'>('concept');
  const [sort, setSort] = useState<'score' | 'ratio' | 'net'>('score');
  const kg = useKgSector(type, sort, 60);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-base font-semibold">板块资金雷达</h1>
        <span className="num text-[11px] text-muted">数据日期 {kg.data?.date || '--'} · {kg.data?.total || 0} 个板块</span>
      </div>

      <Card
        right={
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <button className={`rounded px-2.5 py-1 text-xs ${type === 'concept' ? 'bg-accent text-white' : 'bg-elevated text-secondary'}`} onClick={() => setType('concept')}>概念</button>
              <button className={`rounded px-2.5 py-1 text-xs ${type === 'industry' ? 'bg-accent text-white' : 'bg-elevated text-secondary'}`} onClick={() => setType('industry')}>行业</button>
            </div>
            <select className="rounded border border-border bg-surface px-2 py-1 text-xs" value={sort} onChange={e => setSort(e.target.value as any)}>
              {SORTS.map(s => <option key={s.key} value={s.key}>按{s.label}</option>)}
            </select>
          </div>
        }
      >
        <div className="max-h-[680px] overflow-y-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">#</th><th className="th">板块</th><th className="th">涨跌幅</th>
                <th className="th">加权评分</th><th className="th">波段流入率</th><th className="th">单日净额</th><th className="th">龙头</th>
              </tr>
            </thead>
            <tbody>
              {(kg.data?.list || []).map(s => (
                <tr key={s.rank} className="border-b border-border/30 hover:bg-elevated/50">
                  <td className="td num text-muted">{s.rank}</td>
                  <td className="td font-medium">{s.name}</td>
                  <td className={`td num ${pctClass(s.pctChg)}`}>{fmtPct(s.pctChg)}</td>
                  <td className="td num">{s.score?.toFixed(0) ?? '--'}</td>
                  <td className="td num">{s.ratio != null ? (s.ratio * 100).toFixed(2) + '%' : '--'}</td>
                  <td className={`td num ${s.net != null && s.net >= 0 ? 'text-bull' : 'text-bear'}`}>{s.net != null ? `${s.net >= 0 ? '+' : ''}${s.net.toFixed(1)}亿` : '--'}</td>
                  <td className="td text-muted">{s.leadStock || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="text-[10px] text-muted">
        波段流入率 / 加权评分 / 净额 · 本地缓存 · 不重复请求
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, Badge } from '@/components/ui';

export default function ExportPage() {
  const [date, setDate] = useState('');
  const reviewsQ = useQuery({ queryKey: ['reviews'], queryFn: api.reviews });
  const reviewDates = (reviewsQ.data?.data || []).map(r => r.trade_date);
  const plansQ = useQuery({ queryKey: ['plans'], queryFn: () => api.plans() });
  const plans = plansQ.data?.data || [];

  const sel = date || reviewDates[0] || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const reviewQ = useQuery({ queryKey: ['review', sel], queryFn: () => api.reviewGet(sel), enabled: !!reviewDates.length });

  const planByDate = plans.filter(p => p.trade_date === sel);

  const exportHtml = () => {
    const d = reviewQ.data?.data;
    const title = `Fishwin 交易日报 · ${sel}`;
    const rows = [
      ['盘后复盘', d?.summary || '（无归档）', d?.plan ? `次日预案：${d.plan}` : ''],
      ['盘前预期·买入计划', planByDate.filter(p => p.side === 'buy').map(p => `${p.name}(${p.code}) ${p.mode} ${p.logic} 止盈${p.tp} 止损${p.sl}`).join('<br/>') || '（无）', ''],
      ['盘前预期·卖出计划', planByDate.filter(p => p.side === 'sell').map(p => `${p.name}(${p.code}) ${p.mode} ${p.logic}`).join('<br/>') || '（无）', ''],
    ];
    const html = `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:'Noto Serif SC',serif;max-width:860px;margin:40px auto;padding:0 32px;color:#14171b;background:#fafaf7;line-height:1.8}
h1{font-size:22px;border-bottom:3px double #1d4ed8;padding-bottom:10px}h2{font-size:16px;color:#1d4ed8;border-left:4px solid #1d4ed8;padding-left:10px;margin-top:28px}
table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border:1px solid #e8eaed;padding:8px 12px;font-size:13px;text-align:left;vertical-align:top}
th{background:#f3f3ee;letter-spacing:2px}blockquote{border-left:3px solid #c8341f;margin:12px 0;padding:8px 16px;background:#fff;color:#5a5a66}
.muted{color:#8e8e96;font-size:12px}.red{color:#DC143C}.green{color:#228B22}</style></head><body>
<h1>${title}</h1><div class="muted">生成时间：${new Date().toLocaleString('zh-CN')} · Fishwin Trading Desk</div>
${rows.filter(r => r[1] && r[1] !== '（无）').map(r => `<h2>${r[0]}</h2><p>${r[1]}</p>${r[2] ? `<blockquote>${r[2]}</blockquote>` : ''}`).join('')}
</body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Fishwin日报_${sel}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold">导出日报</h1>

      <Card title="日报导出" hint="由盘后复盘 + 盘前预期（买入/卖出计划）自动汇总">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-muted">选择日期</span>
          <select className="rounded border border-border bg-surface px-2 py-1 text-xs" value={sel} onChange={e => setDate(e.target.value)}>
            {reviewDates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button className="ml-auto rounded bg-accent px-4 py-1.5 text-xs font-medium text-white cursor-pointer" onClick={exportHtml}>
            导出 HTML 日报
          </button>
        </div>

        <div className="space-y-2">
          <div className="rounded-lg bg-elevated px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold text-accent">盘后复盘（{sel}）</div>
            <div className="text-xs leading-relaxed">{reviewQ.data?.data?.summary || '当日未归档复盘'}</div>
            {reviewQ.data?.data?.plan && <div className="mt-1 border-t border-border/40 pt-1 text-xs text-secondary">次日预案：{reviewQ.data?.data?.plan}</div>}
          </div>
          <div className="rounded-lg bg-elevated px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold text-bull">盘前预期 · 买入计划（{sel}）</div>
            {planByDate.filter(p => p.side === 'buy').map(p => (
              <div key={p.id} className="text-xs"><Badge tone="bull">{p.mode}</Badge> {p.name}({p.code}) {p.logic} · 止盈 {p.tp} · 止损 {p.sl}</div>
            )) || <div className="text-xs text-muted">无买入计划</div>}
            {planByDate.filter(p => p.side === 'buy').length === 0 && <div className="text-xs text-muted">无买入计划</div>}
          </div>
          <div className="rounded-lg bg-elevated px-3 py-2">
            <div className="mb-1 text-[11px] font-semibold text-bear">盘前预期 · 卖出计划（{sel}）</div>
            {planByDate.filter(p => p.side === 'sell').map(p => (
              <div key={p.id} className="text-xs"><Badge tone="bear">{p.mode}</Badge> {p.name}({p.code}) {p.logic}</div>
            ))}
            {planByDate.filter(p => p.side === 'sell').length === 0 && <div className="text-xs text-muted">无卖出计划</div>}
          </div>
        </div>
      </Card>
    </div>
  );
}

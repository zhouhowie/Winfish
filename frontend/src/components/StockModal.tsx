// 个股 K 线弹窗（分时/日K 切换，参考悟道连板身位弹窗）
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type KlineRes } from '@/lib/api';
import { KChart, type KBar } from '@/components/KChart';
import { fmtAmount } from '@/lib/format';

function toBars(r?: KlineRes): KBar[] {
  return (r?.data?.items || []).map(it => ({
    date: it.Data, o: Number(it.Open), h: Number(it.High), l: Number(it.Low), c: Number(it.Close),
  }));
}
function toBarsMin(r?: KlineRes): KBar[] {
  return (r?.data?.items || []).map(it => {
    const sec = Number(it.Second || 0);
    const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
    const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    return {
      date: it.Data, time: `${hh}:${mm}`,
      o: Number(it.Open), h: Number(it.High), l: Number(it.Low), c: Number(it.Close),
    };
  });
}

export default function StockModal({ code, name, onClose, defaultPeriod = 'min' }: { code: string; name?: string; onClose: () => void; defaultPeriod?: 'day' | 'min' }) {
  const [period, setPeriod] = useState<'day' | 'min'>(defaultPeriod);
  const setcode = code.startsWith('6') ? '1' : '0';

  const kq = useQuery({
    queryKey: ['stock-modal', code, period],
    queryFn: () => api.kline(code, setcode, period === 'day' ? '4' : '0', period === 'day' ? '90' : '50'),
  });
  const qq = useQuery({
    queryKey: ['stock-modal-q', code],
    queryFn: () => api.quotes([code]),
  });

  const quote = useMemo(() => {
    const d = qq.data?.data?.[0]?.data?.HQInfo || {};
    const b = qq.data?.data?.[0]?.data?.BaseInfo || {};
    return {
      now: d.Now as number | undefined,
      pct: d.Now != null && (d.Close || d.Yield) ? +(((d.Now as number - (d.Close as number || d.Yield as number)) / (d.Close as number || d.Yield as number)) * 100).toFixed(2) : null,
      amount: d.Amount as number | undefined,
      high: d.MaxP as number | undefined,
      low: d.MinP as number | undefined,
      open: d.Open as number | undefined,
      name: b.Name || name || '',
      turnover: d.HSL as number | undefined, // 换手率
    };
  }, [qq.data, name]);

  // Esc 关闭
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const bars = period === 'day' ? toBars(kq.data as KlineRes) : toBarsMin(kq.data as KlineRes);
  const pctCls = quote.pct == null || quote.pct === 0 ? 'text-muted' : quote.pct > 0 ? 'text-bull' : 'text-bear';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl border border-border bg-surface p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold">{quote.name || name || code}</span>
            <span className="num text-[11px] text-muted">{code}</span>
            <span className={`num text-lg font-bold ${pctCls}`}>{quote.now?.toFixed(2) ?? '--'}</span>
            <span className={`num text-sm ${pctCls}`}>{quote.pct != null ? `${quote.pct > 0 ? '+' : ''}${quote.pct.toFixed(2)}%` : '--'}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="mr-1 flex gap-1">
              <button className={`rounded px-2.5 py-1 text-xs ${period === 'day' ? 'bg-accent text-white' : 'bg-elevated text-secondary'}`} onClick={() => setPeriod('day')}>日K</button>
              <button className={`rounded px-2.5 py-1 text-xs ${period === 'min' ? 'bg-accent text-white' : 'bg-elevated text-secondary'}`} onClick={() => setPeriod('min')}>分时</button>
            </div>
            <button onClick={onClose} className="rounded px-2 py-1 text-xs text-muted hover:bg-elevated hover:text-foreground">✕</button>
          </div>
        </div>

        {/* 基本信息 */}
        <div className="mb-2 flex flex-wrap gap-4 text-[11px] text-secondary">
          <span>今开 <b className="num text-foreground">{quote.open?.toFixed(2) ?? '--'}</b></span>
          <span>最高 <b className="num text-bull">{quote.high?.toFixed(2) ?? '--'}</b></span>
          <span>最低 <b className="num text-bear">{quote.low?.toFixed(2) ?? '--'}</b></span>
          <span>成交额 <b className="num text-foreground">{fmtAmount(quote.amount)}</b></span>
          {quote.turnover != null && <span>换手率 <b className="num text-foreground">{quote.turnover.toFixed(2)}%</b></span>}
        </div>

        {/* K线 */}
        <div className="rounded-lg border border-border/60 bg-elevated/30 p-2">
          <KChart bars={bars} height={340} showMA={period === 'day'} />
        </div>
      </div>
    </div>
  );
}

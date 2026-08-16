// 看板总览 — 指数/量能/情绪 + 外盘分组（全球指数/美股七姐妹/费半/MU/LITE/黄金）+ 年度走势
import { useEmotion, useGlobalAll, useMarketSummary, useVolume } from '@/lib/useQueries';
import { Card } from '@/components/ui';
import { fmtPct, pctClass, fmtNum, fmtAmount } from '@/lib/format';
import { Globe } from 'lucide-react';
import YearView from '@/components/YearView';
import type { UsQuote } from '@/lib/api';

const DAY_RANGES = [10, 20, 30];

function QuoteCell({ name, price, pct, sub }: { name: string; price: string | number; pct: number | null; sub?: string }) {
  return (
    <div className="rounded-lg bg-elevated px-3 py-2">
      <div className="truncate text-[10px] text-secondary">{name}</div>
      <div className={`num truncate text-sm font-bold ${pctClass(pct)}`}>{price}</div>
      <div className={`num text-[11px] ${pctClass(pct)}`}>{fmtPct(pct)}</div>
      {sub && <div className="text-[9px] text-muted">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const emotion = useEmotion();
  const global = useGlobalAll();
  const market = useMarketSummary();
  const volume = useVolume(10); // 主升侦测（开局爆量+持续）

  const st = emotion.data?.stats;
  const indices = global.data?.indices || {};
  const us = global.data?.us || {};
  const gold = global.data?.gold;
  const rally = volume.data?.rally;

  const usList: UsQuote[] = Object.values(us);
  const mag7 = usList.filter(u => ['aapl', 'msft', 'googl', 'amzn', 'nvda', 'meta', 'tsla'].includes(u.key));
  const semi = usList.filter(u => ['soxx', 'mu', 'lite'].includes(u.key));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">看板总览</h1>
        <span className="num text-[11px] text-muted">
          {market.data?.source === 'tdx' ? 'TDX' : 'Tushare'} · {new Date(market.data?.ts || Date.now()).toLocaleTimeString('zh-CN', { hour12: false })}
        </span>
      </div>

      {/* 指数与量能 */}
      <Card
        title="指数与量能"
        right={
          rally?.rally ? (
            <span className="badge bg-bull/10 text-bull animate-pulse">🚀 主升开启（开局爆量+持续）</span>
          ) : rally && (rally.openSurge || rally.sustained) ? (
            <span className="badge bg-warning/10 text-warning">⚠ 爆量观察中（10:30前≥5000亿 / 11:30≥7000亿）</span>
          ) : undefined
        }
      >
        <div className="grid grid-cols-5 gap-2">
          {Object.values(market.data?.indices || {}).map(idx => (
            <div key={idx.key} className="rounded-lg bg-elevated px-3 py-2">
              <div className="text-[10px] text-secondary">{idx.name}</div>
              <div className={`num text-lg font-bold ${pctClass(idx.pctChg)}`}>{fmtNum(idx.now)}</div>
              <div className={`num text-xs ${pctClass(idx.pctChg)}`}>{fmtPct(idx.pctChg)}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-5 gap-2">
          <div className="rounded-lg bg-elevated px-3 py-2 text-center"><div className="num text-xl font-bold text-accent">{fmtAmount(market.data?.turnover)}</div><div className="text-[10px] text-muted">两市成交</div></div>
          <div className="rounded-lg bg-elevated px-3 py-2 text-center"><div className="num text-xl font-bold text-bull">{st?.limitUpCount ?? '--'}</div><div className="text-[10px] text-muted">涨停</div></div>
          <div className="rounded-lg bg-elevated px-3 py-2 text-center"><div className="num text-xl font-bold text-bear">{st?.limitDownCount ?? '--'}</div><div className="text-[10px] text-muted">跌停</div></div>
          <div className="rounded-lg bg-elevated px-3 py-2 text-center"><div className={`num text-xl font-bold ${st && st.sealRate >= 70 ? 'text-bull' : 'text-bear'}`}>{st ? `${st.sealRate}%` : '--'}</div><div className="text-[10px] text-muted">封板率</div></div>
          <div className="rounded-lg bg-elevated px-3 py-2 text-center"><div className="num text-xl font-bold">{st ? `${st.maxStreak}板` : '--'}</div><div className="text-[10px] text-muted">最高连板</div></div>
        </div>
      </Card>

      {/* 外盘映射：分组 */}
      <Card title="外盘映射" hint="全球指数 · 美股 · 黄金" right={<Globe className="h-3.5 w-3.5 text-muted" />}>
        {/* 全球指数 */}
        <div className="mb-1 text-[10px] font-semibold tracking-widest text-secondary">全球指数</div>
        <div className="grid grid-cols-5 gap-2">
          {Object.values(indices).map(g => (
            <QuoteCell key={g.key} name={g.name} price={g.close.toLocaleString()} pct={g.pctChg} />
          ))}
        </div>
        {/* 美股七姐妹 */}
        <div className="mb-1 mt-3 text-[10px] font-semibold tracking-widest text-secondary">美股七姐妹</div>
        <div className="grid grid-cols-7 gap-2">
          {mag7.map(u => <QuoteCell key={u.key} name={u.name} price={u.price.toFixed(2)} pct={u.pctChg} />)}
        </div>
        {/* 半导体 + 黄金 */}
        <div className="mb-1 mt-3 text-[10px] font-semibold tracking-widest text-secondary">半导体 / 光通信 / 黄金</div>
        <div className="grid grid-cols-4 gap-2">
          {semi.map(u => <QuoteCell key={u.key} name={u.name} price={u.price.toFixed(2)} pct={u.pctChg} />)}
          {gold && <QuoteCell name={gold.name} price={gold.price.toFixed(1)} pct={gold.pctChg} sub="美元/盎司" />}
        </div>
      </Card>

      {/* 图表区：天数切换 */}
      {/* 年度走势（独立块，纵向图表 + 时间滑块） */}
      <YearView />

      {/* 板块资金已独立为导航页 → 见 /sector */}

      <div className="flex items-center gap-1.5 text-[10px] text-muted">
        数据源：TDX（行情/情绪）· 东财（外盘/美股/板块资金）· Tushare（资金流）· 自动刷新 · 历史数据已入库缓存
      </div>
    </div>
  );
}

// 盘中操盘 — 指数K线 + 板块资金 + 重点监测 + 情绪 + 量能
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, type KlineRes } from '@/lib/api';
import { QK, useEmotion, usePremarket } from '@/lib/useQueries';
import { Card, Chip, Badge } from '@/components/ui';
import { KChart, type KBar, type MarkLine } from '@/components/KChart';
import { fmtPct, pctClass, fmtNum } from '@/lib/format';

const INDICES = [
  { key: 'sh', name: '上证指数', code: '000001', setcode: '1' },
  { key: 'sz', name: '深证成指', code: '399001', setcode: '0' },
  { key: 'cyb', name: '创业板指', code: '399006', setcode: '0' },
  { key: 'kc50', name: '科创50', code: '000688', setcode: '1' },
  { key: 'hs300', name: '沪深300', code: '000300', setcode: '1' },
];

function toBars(r?: KlineRes): KBar[] {
  return (r?.data?.items || []).map(it => ({
    date: it.Data, o: Number(it.Open), h: Number(it.High), l: Number(it.Low), c: Number(it.Close),
  }));
}

// 分时（5分钟K）转 bars：用 Second 生成 HH:mm 标签
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

export default function Desk() {
  const today = new Date().toISOString().slice(0, 10);
  const [idxKey, setIdxKey] = useState(0);
  const [kPeriod, setKPeriod] = useState<'day' | 'min'>('day');
  const [stockCode, setStockCode] = useState<string | null>(null);
  const [stockPeriod, setStockPeriod] = useState<'day' | 'min'>('day');

  const idx = INDICES[idxKey];
  const idxK = useQuery({
    queryKey: ['kline', idx.code, kPeriod],
    queryFn: () => api.kline(idx.code, idx.setcode, kPeriod === 'day' ? '4' : '0', kPeriod === 'day' ? '90' : '50'),
    refetchInterval: 60000,
  });

  const plan = usePremarket(today);
  const emotion = useEmotion();

  const targets = plan.data?.items.filter(i => i.section === 'target').map(i => i.payload) || [];
  const holdings = plan.data?.items.filter(i => i.section === 'holding').map(i => i.payload) || [];
  const strategy = plan.data?.items.find(i => i.section === 'strategy')?.payload || {};
  const watchCodes = [...new Set([...targets.map(t => t.code), ...holdings.map(h => h.code)].filter(Boolean))];

  const quotesQ = useQuery({
    queryKey: ['quotes', watchCodes.join(',')],
    queryFn: () => api.quotes(watchCodes),
    enabled: watchCodes.length > 0,
    refetchInterval: 30000,
  });  const quotes: Record<string, { now: number; pctChg: number; name: string }> = useMemo(() => {
    const m: Record<string, any> = {};
    for (const q of quotesQ.data?.data || []) {
      const h = q.data?.HQInfo || {};
      const b = q.data?.BaseInfo || {};
      m[q.code] = {
        now: h.Now as number,
        pctChg: h.Now != null && (h.Close || h.Yield) ? +(((h.Now as number - (h.Close as number || h.Yield as number)) / (h.Close as number || h.Yield as number)) * 100).toFixed(2) : null,
        name: b.Name || '',
      };
    }
    return m;
  }, [quotesQ.data]);

  // 个股主力资金流（Tushare moneyflow）
  const mfQ = useQuery({
    queryKey: ['moneyflow', watchCodes.join(',')],
    queryFn: () => api.moneyflow(watchCodes),
    enabled: watchCodes.length > 0,
    refetchInterval: 120000,
  });
  const moneyflows = mfQ.data?.data || {};

  const stockQ = useQuery({
    queryKey: ['kline-stock', stockCode, stockPeriod],
    queryFn: () => api.kline(stockCode!, stockCode!.startsWith('6') ? '1' : '0', stockPeriod === 'day' ? '4' : '0', stockPeriod === 'day' ? '90' : '50'),
    enabled: !!stockCode,
  });
  const stock = targets.find(t => t.code === stockCode) || holdings.find(h => h.code === stockCode);

  const modeLabel = strategy.tradeMode === 'limitup' ? '连板模式' : strategy.tradeMode === 'tail' ? '尾盘2点半' : strategy.tradeMode === 'trend' ? '趋势段' : strategy.tradeMode;

  const ladder = emotion.data?.ladder || [];
  const themes = emotion.data?.themeRank || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">盘中操盘</h1>
        {modeLabel && <Badge tone="accent">今日模式：{modeLabel}</Badge>}
      </div>

      {/* 指数K线 */}
      <Card
        title="指数K线"
        right={
          <div className="flex items-center gap-1">
            <div className="mr-1 flex gap-1">
              <Chip on={kPeriod === 'day'} onClick={() => setKPeriod('day')}>日K</Chip>
              <Chip on={kPeriod === 'min'} onClick={() => setKPeriod('min')}>分时</Chip>
            </div>
            {INDICES.map((x, i) => (
              <Chip key={x.key} on={i === idxKey} onClick={() => setIdxKey(i)}>{x.name}</Chip>
            ))}
          </div>
        }
      >
        {kPeriod === 'day' ? (
          <KChart bars={toBars(idxK.data as KlineRes)} height={320} />
        ) : (
          <KChart bars={toBarsMin(idxK.data as KlineRes)} height={320} showMA={false} />
        )}
      </Card>

      {/* 重点监测 */}
      <Card
        title="重点监测"
        hint={`盘前预案自动同步 · ${today}`}
        right={watchCodes.length ? <Badge>{watchCodes.length} 只</Badge> : undefined}
      >
        {watchCodes.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted">盘前预案未添加标的/持仓，去「盘前预案」添加后自动同步监测</div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {[...targets, ...holdings].map(t => {
              const q = quotes[t.code];
              const isTarget = !!t.buyPrice;
              const dist = q?.now && t.buyPrice ? +(((q.now - t.buyPrice) / t.buyPrice) * 100).toFixed(2) : null;
              const pnl = q?.now && t.cost ? +(((q.now - t.cost) / t.cost) * 100).toFixed(2) : null;
              const broken = t.stopLoss && q?.now != null && q.now < t.stopLoss;
              return (
                <button key={t.code} onClick={() => setStockCode(t.code)} className="flex items-center gap-2 border-b border-border/40 py-1.5 text-left hover:bg-elevated/50 rounded px-1 cursor-pointer">
                  <span className="text-xs font-medium">{q?.name || t.name || t.code}</span>
                  <span className="num text-[10px] text-muted">{t.code}</span>
                  {moneyflows[t.code] && (
                    <span className={`num text-[10px] ${moneyflows[t.code].mainNet >= 0 ? 'text-bull' : 'text-bear'}`}>
                      主力 {moneyflows[t.code].mainNet >= 0 ? '+' : ''}{(moneyflows[t.code].mainNet / 1e4).toFixed(2)}亿
                    </span>
                  )}
                  {isTarget ? (
                    <>
                      <span className="num ml-auto text-xs" style={{ color: '#3b82f6' }}>买 {t.buyPrice}</span>
                      <span className={`num text-xs ${pctClass(dist)}`}>{dist != null ? fmtPct(dist) : '--'}</span>
                      {broken && <Badge tone="danger">破位</Badge>}
                    </>
                  ) : (
                    <>
                      <span className="num ml-auto text-xs text-secondary">本 {t.cost}</span>
                      <span className={`num text-xs ${pctClass(pnl)}`}>{pnl != null ? fmtPct(pnl) : '--'}</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {stockCode && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold">
                {quotes[stockCode]?.name || stock?.name} {stockCode}
                {stock?.buyPrice && <span className="num ml-2 text-[10px] text-muted">买价 {stock.buyPrice}</span>}
                {stock?.stopLoss && <span className="num ml-2 text-[10px] text-danger">止损 {stock.stopLoss}</span>}
              </span>
              <div className="flex items-center gap-1">
                <Chip on={stockPeriod === 'day'} onClick={() => setStockPeriod('day')}>日K</Chip>
                <Chip on={stockPeriod === 'min'} onClick={() => setStockPeriod('min')}>分时</Chip>
                <button className="btn btn-sm" onClick={() => setStockCode(null)}>关闭</button>
              </div>
            </div>
            {stockPeriod === 'day' ? (
              <KChart
                bars={toBars(stockQ.data as KlineRes)}
                height={280}
                markLines={[
                  ...(stock?.buyPrice ? [{ y: Number(stock.buyPrice), label: `买价 ${stock.buyPrice}`, color: '#1d4ed8' }] : []),
                  ...(stock?.stopLoss ? [{ y: Number(stock.stopLoss), label: `止损 ${stock.stopLoss}`, color: '#c8341f' }] : []),
                ]}
              />
            ) : (
              <KChart
                bars={toBarsMin(stockQ.data as KlineRes)}
                height={280}
                showMA={false}
                markLines={[
                  ...(stock?.buyPrice ? [{ y: Number(stock.buyPrice), label: `买价 ${stock.buyPrice}`, color: '#1d4ed8' }] : []),
                  ...(stock?.stopLoss ? [{ y: Number(stock.stopLoss), label: `止损 ${stock.stopLoss}`, color: '#c8341f' }] : []),
                ]}
              />
            )}
          </div>
        )}
      </Card>

      {/* 板块资金 + 情绪摘要 */}
      <div className="grid grid-cols-2 gap-4">
        <SectorCard />
        <EmotionCard ladder={ladder} themes={themes} stats={emotion.data?.stats} />
      </div>
    </div>
  );
}

function SectorCard() {
  const sector = useQuery({ queryKey: QK.sector('industry'), queryFn: () => api.sectorFlow('industry', 20), refetchInterval: 60000 });
  return (
    <Card title="板块资金流" hint="行业 · 主力净流入" >
      <div className="max-h-[300px] overflow-y-auto">
        {(sector.data?.list || []).map(s => (
          <div key={s.code} className="flex items-center gap-2 border-b border-border/40 py-1">
            <span className="w-24 truncate text-xs">{s.name}</span>
            <span className={`num w-14 text-xs ${pctClass(s.pctChg)}`}>{fmtPct(s.pctChg)}</span>
            <span className={`num ml-auto text-xs ${s.mainNet >= 0 ? 'text-bull' : 'text-bear'}`}>
              {s.mainNet >= 0 ? '+' : ''}{(s.mainNet / 1e8).toFixed(1)}亿
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function EmotionCard({ ladder, themes, stats }: { ladder: any[]; themes: any[]; stats: any }) {
  return (
    <Card title="情绪温度" hint={stats ? `涨停 ${stats.limitUpCount} · 跌停 ${stats.limitDownCount} · 封板率 ${stats.sealRate}%` : ''}>
      <div className="mb-2">
        <div className="text-[10px] font-semibold text-secondary">连板梯队</div>
        <div className="space-y-1">
          {ladder.slice(0, 6).map(l => (
            <div key={l.streak} className="flex items-center gap-2">
              <span className={`num w-8 text-xs font-bold ${l.streak >= 4 ? 'text-bull' : l.streak >= 2 ? 'text-foreground' : 'text-muted'}`}>{l.streak}板</span>
              <span className="flex flex-1 flex-wrap gap-1">
                {l.stocks.slice(0, 6).map((s: any) => (
                  <span key={s.code} className="rounded bg-elevated px-1.5 py-0.5 text-[10px]">{s.name}</span>
                ))}
                {l.count > 6 && <span className="num text-[10px] text-muted">+{l.count - 6}</span>}
              </span>
              <span className="num text-[10px] text-muted">{l.count}家</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-semibold text-secondary">涨停主类</div>
        <div className="flex flex-wrap gap-1">
          {themes.slice(0, 10).map(t => (
            <span key={t.name} className="rounded bg-accent/8 px-1.5 py-0.5 text-[10px] text-accent">{t.name} {t.count}</span>
          ))}
        </div>
      </div>
    </Card>
  );
}

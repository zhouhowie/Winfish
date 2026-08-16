import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, Badge } from '@/components/ui';

export default function Patrol() {
  const [tick, setTick] = useState(0);
  const patrolQ = useQuery({
    queryKey: ['patrol', tick],
    queryFn: api.patrol,
    refetchInterval: 10 * 60 * 1000,
  });
  const items = patrolQ.data?.items || [];

  const refresh = () => setTick(t => t + 1);

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold">信息巡检 · Hana 巡检</h1>

      <Card
        title="当日要闻"
        hint="新浪财经 7x24 · 每10分钟自动刷新"
        right={
          <button className="rounded bg-accent px-3 py-1 text-xs text-white cursor-pointer" onClick={refresh}>
            立即巡检
          </button>
        }
      >
        {patrolQ.isLoading && <div className="py-6 text-center text-xs text-muted">巡检中…</div>}
        {!patrolQ.isLoading && items.length === 0 && <div className="py-6 text-center text-xs text-muted">暂无要闻</div>}
        <div className="space-y-1">
          {items.map((it, i) => (
            <a key={i} href={it.url || '#'} target="_blank" rel="noreferrer" className="flex items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-elevated">
              <span className="num shrink-0 pt-0.5 text-[10px] text-muted">{it.time?.slice(5) || ''}</span>
              <span className="min-w-0 flex-1 text-xs leading-relaxed hover:text-accent">{it.title}</span>
              {it.source && <span className="shrink-0 pt-0.5 text-[10px] text-muted">{it.source}</span>}
            </a>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card title="巡检项 · 外盘">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-muted">美股/七姐妹/费半</span><Badge tone="accent">看板总览</Badge></div>
            <div className="flex justify-between"><span className="text-muted">COMEX 黄金</span><Badge tone="accent">看板总览</Badge></div>
            <div className="flex justify-between"><span className="text-muted">两市成交/活跃市值</span><Badge tone="accent">看板总览</Badge></div>
          </div>
        </Card>
        <Card title="巡检项 · 政策与资金">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-muted">板块资金流向</span><Badge tone="accent">板块跟踪</Badge></div>
            <div className="flex justify-between"><span className="text-muted">加权评分雷达</span><Badge tone="accent">板块资金</Badge></div>
            <div className="flex justify-between"><span className="text-muted">两融/融券</span><Badge tone="default">盘后复盘</Badge></div>
          </div>
        </Card>
        <Card title="巡检项 · 情绪">
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-muted">涨跌家数/涨跌停</span><Badge tone="accent">情绪周期</Badge></div>
            <div className="flex justify-between"><span className="text-muted">连板梯队/龙头轨迹</span><Badge tone="accent">情绪周期</Badge></div>
            <div className="flex justify-between"><span className="text-muted">情绪节点共振</span><Badge tone="danger">板块跟踪</Badge></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

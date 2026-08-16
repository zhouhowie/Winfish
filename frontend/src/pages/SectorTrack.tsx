import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, Badge } from '@/components/ui';

// 核心板块（与情绪节点匹配）
const TRACKS: { name: string; tags: string[]; keywords: string[] }[] = [
  { name: '半导体', tags: ['半导体材料', '半导体设备', '芯片'], keywords: ['半导体', '芯片', '中船特气', '中巨芯', '有研', '云南锗业'] },
  { name: 'PCB', tags: ['PCB'], keywords: ['PCB', '宝鼎', '沪电', '东山', '宏和'] },
  { name: '光通信', tags: ['光通信', 'CPO', '光模块'], keywords: ['光通信', 'CPO', '光模块', '中际旭创', '剑桥', '天洋', '汇绿'] },
  { name: 'MLCC', tags: ['MLCC', '被动元件'], keywords: ['MLCC', '风华', '被动元件'] },
  { name: '创新药', tags: ['创新药', '医药'], keywords: ['创新药', '医药', '百花', 'CRO'] },
  { name: 'IDC', tags: ['算力租赁', '液冷', 'Token工厂', 'AIDC'], keywords: ['IDC', '算力租赁', '液冷', 'AIDC', '利通', '宏景', '协创', '美利云', 'Token'] },
  { name: '国产算力', tags: ['国产算力', '算力', '服务器'], keywords: ['算力', '国产', '寒武纪', '工业富联', '昇腾'] },
  { name: '消费地产', tags: ['消费', '地产', '食品'], keywords: ['消费', '地产', '食品', '一鸣'] },
  { name: '机器人', tags: ['机器人', '人形机器人'], keywords: ['机器人', '人形'] },
];

export default function SectorTrack() {
  const [nodeDate, setNodeDate] = useState('');
  const kgQ = useQuery({ queryKey: ['kg-sector', 'concept', 'score', 80], queryFn: () => api.kgSector('concept', 'score', 80), refetchInterval: 600000 });
  const indQ = useQuery({ queryKey: ['kg-sector', 'industry', 'score', 80], queryFn: () => api.kgSector('industry', 'score', 80), refetchInterval: 600000 });
  const nodesQ = useQuery({ queryKey: ['nodes'], queryFn: api.nodes });
  const statsQ = useQuery({ queryKey: ['stats', 15], queryFn: () => api.stats(15), refetchInterval: 300000 });

  const kgList = useMemo(() => [...(kgQ.data?.list || []), ...(indQ.data?.list || [])], [kgQ.data, indQ.data]);
  const nodes = nodesQ.data?.data || [];
  const stats = statsQ.data?.data || [];

  // 关键节点（用户给定的周期坐标）
  const keyNodes = nodes.length ? nodes : [
    { node_date: '20260720', label: '政策底', desc: '政策发力' },
    { node_date: '20260721', label: '市场底', desc: '首日下探' },
    { node_date: '20260727', label: '市场底二次确认', desc: '二次回踩确认' },
    { node_date: '20260731', label: '情绪复苏', desc: '情绪回暖' },
    { node_date: '20260804', label: '指数与情绪共振', desc: '新周期开启' },
  ];

  // 每个板块匹配 KG 数据
  const rows = TRACKS.map(t => {
    const hit = kgList.filter(k => t.keywords.some(kw => (k.name || '').includes(kw)) || t.tags.some(tag => (k.name || '').includes(tag)));
    const byDate: Record<string, { pct: number; net: number; score: number }> = {};
    for (const k of hit) {
      const d = k.rank ? '' : ''; // rank 无日期字段，KG 当前日期整体
      byDate[k.name] = { pct: k.pctChg ?? 0, net: k.net ?? 0, score: k.score ?? 0 };
    }
    const best = hit.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    return {
      track: t,
      count: hit.length,
      best: best ? { name: best.name, pct: best.pctChg ?? 0, net: best.net ?? 0, score: best.score ?? 0, lead: best.leadStock } : null,
      hits: hit.slice(0, 5),
    };
  });

  // 情绪节点时间线（与当日市场温度）
  const idx = stats.findIndex(s => s.date === nodeDate || (!nodeDate && s.date === stats[stats.length - 1]?.date));
  const today = stats[idx] || stats[stats.length - 1];

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold">板块跟踪 · 核心板块轮动与情绪节点匹配</h1>

      {/* ── ① 情绪节点时间线 ── */}
      <Card title="情绪周期 · 关键节点坐标" hint="7.20政策底 → 7.21市场底 → 7.27二次确认 → 7.31情绪复苏 → 8.4指数与情绪共振（新周期开启）">
        <div className="flex items-center justify-between gap-2 overflow-x-auto py-3">
          {keyNodes.map((n, i) => (
            <div key={n.node_date} className="flex min-w-[8.5rem] flex-1 items-center">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 shrink-0 rounded-full" style={{ background: i === keyNodes.length - 1 ? '#c8341f' : '#1d4ed8', boxShadow: `0 0 8px ${i === keyNodes.length - 1 ? '#c8341f66' : '#1d4ed866'}` }} />
                  <span className="num text-xs font-bold">{n.node_date.slice(4)}</span>
                </div>
                <div className="mt-1 text-[11px] font-semibold" style={{ color: i === keyNodes.length - 1 ? '#c8341f' : undefined }}>{n.label}</div>
                {n.desc && <div className="text-[10px] text-muted">{n.desc}</div>}
              </div>
              {i < keyNodes.length - 1 && <div className="mx-1 h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>
        <div className="mt-1 rounded-lg bg-elevated px-3 py-2 text-[11px] text-secondary">
          当前定位：<b className="text-signal">8.4 指数与情绪共振后</b>，新周期主升中段 —— 板块轮动以「半导体材料/PCB/光通信/IDC」为主线，创新药、机器人作支线。
        </div>
      </Card>

      {/* ── ② 核心板块轮动状态 ── */}
      <div className="grid grid-cols-3 gap-3">
        {rows.map(r => {
          const stage = r.best ? (r.best.pct >= 5 ? '主升' : r.best.pct >= 1 ? '发酵' : r.best.pct >= -1 ? '震荡' : '退潮') : '—';
          const stageTone = stage === '主升' ? 'bull' : stage === '发酵' ? 'accent' : stage === '退潮' ? 'bear' : 'default';
          return (
            <Card key={r.track.name} title={r.track.name} right={<span className="text-[10px] text-muted">{r.track.tags.join(' · ')}</span>}>
              {r.best ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="truncate text-xs font-medium">{r.best.name}</span>
                    <Badge tone={stageTone as any}>{stage}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                    <div><div className={`num text-sm font-bold ${r.best.pct >= 0 ? 'text-bull' : 'text-bear'}`}>{r.best.pct >= 0 ? '+' : ''}{r.best.pct.toFixed(2)}%</div><div className="text-[10px] text-muted">当日</div></div>
                    <div><div className={`num text-sm font-bold ${(r.best.net ?? 0) >= 0 ? 'text-bull' : 'text-bear'}`}>{(r.best.net ?? 0) >= 0 ? '+' : ''}{(r.best.net ?? 0).toFixed(1)}亿</div><div className="text-[10px] text-muted">净流入</div></div>
                    <div><div className="num text-sm font-bold">{(r.best.score ?? 0).toFixed(0)}</div><div className="text-[10px] text-muted">加权评分</div></div>
                  </div>
                  <div className="mt-2 text-[10px] text-muted">龙头：{r.best.lead || '--'}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {r.hits.slice(0, 3).map(h => (
                      <span key={h.name} className="rounded bg-elevated px-1.5 py-0.5 text-[10px]">{h.name}</span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-3 text-center text-xs text-muted">KG 数据未匹配到该板块</div>
              )}
            </Card>
          );
        })}
      </div>

      {/* ── ③ 当日市场温度（情绪节点回看） ── */}
      {today && (
        <Card title={`情绪节点回看 · ${today.date}`} hint="各节点日对应的市场温度">
          <div className="grid grid-cols-5 gap-2">
            <div className="rounded-lg bg-elevated px-3 py-2 text-center"><div className="num text-lg font-bold">{today.up_count ?? '--'}</div><div className="text-[10px] text-muted">上涨家数</div></div>
            <div className="rounded-lg bg-elevated px-3 py-2 text-center"><div className="num text-lg font-bold">{today.down_count ?? '--'}</div><div className="text-[10px] text-muted">下跌家数</div></div>
            <div className="rounded-lg bg-elevated px-3 py-2 text-center"><div className="num text-lg font-bold text-bull">{today.limit_up ?? '--'}</div><div className="text-[10px] text-muted">涨停</div></div>
            <div className="rounded-lg bg-elevated px-3 py-2 text-center"><div className="num text-lg font-bold text-bear">{today.limit_down ?? '--'}</div><div className="text-[10px] text-muted">跌停</div></div>
            <div className="rounded-lg bg-elevated px-3 py-2 text-center"><div className="num text-lg font-bold">{today.turnover ? (today.turnover / 1e12).toFixed(2) : '--'}</div><div className="text-[10px] text-muted">两市成交(万亿)</div></div>
          </div>
        </Card>
      )}
    </div>
  );
}

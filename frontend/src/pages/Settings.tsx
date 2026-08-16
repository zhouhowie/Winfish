// 设置 — 颜色风格（深色/浅色/报纸） + 数据源状态 + 关于
import { useMarketSummary, useAmv } from '@/lib/useQueries';
import { Card, Badge } from '@/components/ui';
import { getTheme, setTheme, type Theme } from '@/lib/theme';
import { useState } from 'react';

const SOURCES = [
  { name: 'TDX tdxhub', desc: '行情 / K线 / 涨停情绪 / 梯队（主源，云端直连）', tone: 'accent' as const },
  { name: 'Tushare', desc: '日线 / 指标 / 宏观（免费档限频，低频校准）', tone: 'accent' as const },
  { name: '东财 push2', desc: '外盘指数 / 板块资金流（国内直连）', tone: 'default' as const },
  { name: '本地 0AMV', desc: '活跃市值（本地文件，需 extract_amv.py 更新推送）', tone: 'default' as const },
  { name: 'KG 资金流', desc: '板块加权评分雷达（本地 radar_data_latest.js / GitHub 备援）', tone: 'default' as const },
  { name: '悟道 MCP', desc: '备用降级数据源', tone: 'default' as const },
];

const THEMES: { key: Theme; label: string; desc: string; bg: string; fg: string }[] = [
  { key: 'light', label: '浅色', desc: '暖纸浅底 · 默认', bg: '#fafaf7', fg: '#14171b' },
  { key: 'dark', label: '深色', desc: '夜间低光', bg: '#14151a', fg: '#e6e6ea' },
  { key: 'news', label: '报纸', desc: '米黄报纸质感', bg: '#f3ecd9', fg: '#1c1917' },
];

export default function Settings() {
  const [theme, setT] = useState<Theme>(getTheme());
  const market = useMarketSummary();
  const amv = useAmv(5);

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold">设置</h1>

      <Card title="颜色风格">
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map(t => (
            <button
              key={t.key}
              onClick={() => { setTheme(t.key); setT(t.key); }}
              className={`rounded-xl border-2 p-3 text-left transition-colors cursor-pointer ${theme === t.key ? 'border-accent' : 'border-border hover:border-accent/40'}`}
              style={{ background: t.bg, color: t.fg }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">{t.label}</span>
                {theme === t.key && <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">当前</span>}
              </div>
              <div className="text-[10px] opacity-70">{t.desc}</div>
              <div className="mt-2 flex gap-1">
                <span className="h-3 w-3 rounded-full bg-[#DC143C]" />
                <span className="h-3 w-3 rounded-full bg-[#228B22]" />
                <span className="h-3 w-3 rounded-full bg-[#1D4ED8]" />
                <span className="h-3 w-3 rounded-full bg-[#C8341F]" />
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card title="数据源状态" hint="主源优先，失败自动降级">
        <div className="space-y-2">
          {SOURCES.map(s => (
            <div key={s.name} className="flex items-center gap-3 rounded-lg bg-elevated/60 px-3 py-2">
              <Badge tone={s.tone}>{s.name}</Badge>
              <span className="text-xs text-secondary">{s.desc}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 border-t border-border pt-3 text-[11px] text-muted">
          <span>当前行情源：<b className="text-foreground">{market.data?.source === 'tdx' ? 'TDX' : 'Tushare'}</b></span>
          <span>活跃市值：<b className="text-foreground">{amv.data?.source === 'local' ? `${amv.data.series.length} 条本地数据` : '未同步'}</b></span>
        </div>
        <div className="mt-3 rounded-lg border border-dashed border-border bg-elevated/40 px-3 py-2 text-[11px] leading-relaxed text-muted">
          <b className="text-foreground">数据刷新说明</b>：行情/情绪/板块等缓存数据统一为<b className="text-foreground">每小时整点</b>刷新（盘中 9:15-11:35 / 12:55-15:05 生效），手动打开页面时若缓存已过期会即时补拉一次；外盘每日 8:00 / 9:10 更新；收盘数据 15:10 自动归档。如需实时行情请以交易软件为准。
        </div>
      </Card>

      <Card title="关于">
        <div className="space-y-1 text-xs text-secondary">
          <div>Fishwin Trading Desk · A股盘中/盘前/盘后一体化工作台</div>
          <div>导航结构：发现（市场总览/情绪周期/板块跟踪/信息巡检）· 操盘（核心个股/盘中/盘前/盘后）· 系统（持仓/导出/反馈）</div>
          <div>前端：React 18 + TS + Tailwind · 后端：Node.js + SQLite · 数据：TDX / Tushare / 东财 / KG / 0AMV</div>
          <div className="pt-2 text-[10px] text-muted">仅供研究参考，不构成投资建议。数据源为公开接口，准确性以官方为准。</div>
        </div>
      </Card>
    </div>
  );
}

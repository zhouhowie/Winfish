// 设置 — 颜色风格（深色/浅色/报纸） + 数据接入配置 + 系统状态 + 关于
import { useMarketSummary } from '@/lib/useQueries';
import { Card, Badge } from '@/components/ui';
import { getTheme, setTheme, type Theme } from '@/lib/theme';
import { api } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const SOURCES: { name: string; desc: string; tone: 'default' | 'accent' }[] = [
  { name: '行情中心', desc: '行情 / K线 / 涨跌停情绪 / 连板梯队', tone: 'accent' as const },
  { name: '市场宽度', desc: '涨跌家数 / 成交额时间序列', tone: 'accent' as const },
  { name: '外盘映射', desc: '全球指数 / 美股 / 贵金属', tone: 'default' as const },
  { name: '板块雷达', desc: '板块加权评分与资金流向', tone: 'default' as const },
  { name: '本地数据', desc: '活跃市值 / 历史快照缓存', tone: 'default' as const },
  { name: '备用通道', desc: '自动降级，保证可用', tone: 'default' as const },
];

const THEMES: { key: Theme; label: string; desc: string; bg: string; fg: string }[] = [
  { key: 'light', label: '浅色', desc: '暖纸浅底 · 默认', bg: '#fafaf7', fg: '#14171b' },
  { key: 'dark', label: '深色', desc: '夜间低光', bg: '#14151a', fg: '#e6e6ea' },
  { key: 'news', label: '报纸', desc: '米黄报纸质感', bg: '#f3ecd9', fg: '#1c1917' },
];

export default function Settings() {
  const [theme, setT] = useState<Theme>(getTheme());
  const market = useMarketSummary();
  const qc = useQueryClient();

  const cfgQ = useQuery({ queryKey: ['runtime-config'], queryFn: api.getConfig });
  const [form, setForm] = useState<Record<string, string>>({ tushareToken: '', wudaoUrl: '', wudaoToken: '', tdxhubUrl: '' });
  const saveCfg = useMutation({
    mutationFn: (patch: Record<string, string>) => api.saveConfig(patch),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['runtime-config'] }); setForm({ tushareToken: '', wudaoUrl: '', wudaoToken: '', tdxhubUrl: '' }); },
  });
  const cfg = cfgQ.data?.data;

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

      <Card title="数据接入配置" hint="换机部署时在此填写密钥（写入 data/config.json，不入库）">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-xs text-secondary">Tushare Token</span>
            <input
              type="password"
              className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs"
              placeholder={cfg?.tushare_token_set ? '已配置（留空不变）' : '未配置，必填'}
              value={form.tushareToken}
              onChange={e => setForm(f => ({ ...f, tushareToken: e.target.value }))}
            />
            <Badge tone={cfg?.tushare_token_set ? 'accent' : 'default'}>{cfg?.tushare_token_set ? '已设置' : '未设置'}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-xs text-secondary">TDX 地址</span>
            <input
              className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs"
              placeholder={cfg?.tdxhub_url || 'http://tdxhub.icfqs.com:7615/TQLEX'}
              value={form.tdxhubUrl}
              onChange={e => setForm(f => ({ ...f, tdxhubUrl: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-xs text-secondary">备用通道 URL</span>
            <input
              className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs"
              placeholder={cfg?.wudao_url || '备用数据源地址（可选）'}
              value={form.wudaoUrl}
              onChange={e => setForm(f => ({ ...f, wudaoUrl: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-xs text-secondary">备用通道 Token</span>
            <input
              type="password"
              className="flex-1 rounded border border-border bg-surface px-2 py-1 text-xs"
              placeholder={cfg?.wudao_token_set ? '已配置（留空不变）' : '备用通道 Token（可选）'}
              value={form.wudaoToken}
              onChange={e => setForm(f => ({ ...f, wudaoToken: e.target.value }))}
            />
            <Badge tone={cfg?.wudao_token_set ? 'accent' : 'default'}>{cfg?.wudao_token_set ? '已设置' : '未设置'}</Badge>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              className="rounded bg-accent px-4 py-1.5 text-xs text-white cursor-pointer disabled:opacity-50"
              disabled={saveCfg.isPending || !(form.tushareToken || form.tdxhubUrl || form.wudaoUrl || form.wudaoToken)}
              onClick={() => saveCfg.mutate({
                ...(form.tushareToken ? { tushareToken: form.tushareToken } : {}),
                ...(form.tdxhubUrl ? { tdxhubUrl: form.tdxhubUrl } : {}),
                ...(form.wudaoUrl ? { wudaoUrl: form.wudaoUrl } : {}),
                ...(form.wudaoToken ? { wudaoToken: form.wudaoToken } : {}),
              })}
            >
              {saveCfg.isPending ? '保存中…' : '保存配置'}
            </button>
            {saveCfg.isSuccess && <span className="self-center text-xs text-bull">已保存（重启服务后生效）</span>}
            {saveCfg.isError && <span className="self-center text-xs text-bear">保存失败</span>}
          </div>
          <div className="text-[10px] text-muted">配置写入 data/config.json（已被 .gitignore 排除，不会同步到 GitHub）；优先级：.env 环境变量 &gt; 此页面配置。保存后需重启服务生效。</div>
        </div>
      </Card>

      <Card title="系统状态" hint="主通道优先，失败自动降级">
        <div className="space-y-2">
          {SOURCES.map(s => (
            <div key={s.name} className="flex items-center gap-3 rounded-lg bg-elevated/60 px-3 py-2">
              <Badge tone={s.tone}>{s.name}</Badge>
              <span className="text-xs text-secondary">{s.desc}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 border-t border-border pt-3 text-[11px] text-muted">
          <span>行情更新：<b className="text-foreground">{market.data ? '正常' : '待更新'}</b></span>
        </div>
        <div className="mt-3 rounded-lg border border-dashed border-border bg-elevated/40 px-3 py-2 text-[11px] leading-relaxed text-muted">
          <b className="text-foreground">数据刷新说明</b>：行情/情绪/板块等缓存数据统一为<b className="text-foreground">每小时整点</b>刷新（盘中 9:15-11:35 / 12:55-15:05 生效），手动打开页面时若缓存已过期会即时补拉一次；外盘每日 8:00 / 9:10 更新；收盘数据 15:10 自动归档。如需实时行情请以交易软件为准。
        </div>
      </Card>

      <Card title="关于">
        <div className="space-y-1 text-xs text-secondary">
          <div>知行 Winfish · A股盘中/盘前/盘后一体化工作台</div>
          <div>导航结构：发现（市场总览/情绪周期/板块跟踪/信息巡检）· 操盘（核心个股/盘中/盘前/盘后）· 系统（持仓/导出/反馈）</div>
          <div>前端：React 18 + TS + Tailwind · 后端：Node.js + SQLite</div>
          <div className="pt-2 text-[10px] text-muted">仅供研究参考，不构成投资建议。数据准确性以官方为准。</div>
        </div>
      </Card>
    </div>
  );
}

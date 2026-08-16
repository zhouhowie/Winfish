import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Flame, Radar, RadioTower, Star,
  Gauge, ClipboardList, BookOpenCheck, Briefcase, FileDown,
  Settings, Sun, Moon, Database, Activity, MessageCircle, Compass, Search,
} from 'lucide-react';
import { useMarketSummary } from '@/lib/useQueries';
import { fmtAmount } from '@/lib/format';
import { getTheme, toggleTheme } from '@/lib/theme';

const BRAND = '#1D4ED8';

type NavItem = { to: string; label: string; icon: typeof Star };
const groups: { title: string; items: NavItem[] }[] = [
  {
    title: '发现',
    items: [
      { to: '/', label: '市场总览', icon: LayoutDashboard },
      { to: '/emotion', label: '情绪周期', icon: Flame },
      { to: '/sector-track', label: '板块跟踪', icon: Radar },
      { to: '/patrol', label: '信息巡检', icon: RadioTower },
    ],
  },
  {
    title: '操盘',
    items: [
      { to: '/core', label: '核心个股', icon: Compass },
      { to: '/desk', label: '盘中操作', icon: Gauge },
      { to: '/premarket', label: '盘前预期', icon: ClipboardList },
      { to: '/review', label: '盘后复盘', icon: BookOpenCheck },
    ],
  },
  {
    title: '系统',
    items: [
      { to: '/positions', label: '持仓分析', icon: Briefcase },
      { to: '/export', label: '导出日报', icon: FileDown },
      { to: '/feedback', label: '反馈', icon: MessageCircle },
    ],
  },
];

function ThemeToggle() {
  const [theme, setT] = useState(getTheme());
  const label = theme === 'dark' ? '切换到浅色' : theme === 'news' ? '切换到深色' : '切换到报纸';
  return (
    <button
      onClick={() => setT(toggleTheme())}
      className="flex h-7 w-7 items-center justify-center rounded-btn text-secondary transition-colors hover:bg-elevated hover:text-foreground cursor-pointer"
      title={label}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : theme === 'news' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}

export function Layout() {
  const { data: market } = useMarketSummary();

  return (
    <div className="grid h-screen grid-cols-[13.5rem_1fr] bg-base text-foreground overflow-hidden">
      {/* 侧边栏 */}
      <aside className="flex h-full min-h-0 flex-col border-r border-border bg-surface overflow-hidden">
        <div className="shrink-0 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-8 w-8 place-items-center rounded-lg font-bold text-white"
              style={{ background: BRAND, boxShadow: `0 0 14px ${BRAND}66` }}
            >
              F
            </div>
            <div className="font-mono text-[13px] font-bold leading-tight tracking-[0.06em]">
              <div>Fishwin</div>
              <div>Trading Desk</div>
            </div>
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-secondary">
            A股 · 盘中 · 盘前 · 盘后
          </div>
          <div className="mt-3 h-px" style={{ background: `linear-gradient(90deg, ${BRAND}88, transparent 80%)` }} />
        </div>

        <nav className="flex-1 min-h-0 space-y-3 overflow-y-auto px-2 py-3">
          {groups.map(g => (
            <div key={g.title}>
              <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">{g.title}</div>
              <div className="space-y-0.5">
                {g.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-btn px-3 py-1.5 text-sm transition-colors ${
                        isActive ? 'bg-elevated font-medium text-foreground' : 'text-foreground/80 hover:bg-elevated hover:text-foreground'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* 底部数据源状态 + 设置入口 */}
        <div className="shrink-0 border-t border-border px-3 py-2.5 space-y-2">
          <NavLink to="/settings" className="flex items-center gap-2 rounded-btn px-2 py-1.5 text-xs text-secondary transition-colors hover:bg-elevated hover:text-foreground">
            <Settings className="h-3.5 w-3.5" />
            <span>设置</span>
          </NavLink>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-3.5 w-3.5 text-muted" />
              <span className="text-xs text-secondary">数据源</span>
            </div>
            <span className="badge bg-accent/10 text-accent">TDX · Tushare</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-secondary">两市成交</span>
            <span className="num text-xs font-semibold text-foreground">
              {market?.turnover ? (market.turnover / 1e12).toFixed(2) + '万亿' : '--'}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs text-secondary">
              <Activity className="h-3 w-3 text-bull" /> 状态
            </span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* 内容区 */}
      <main className="min-h-0 overflow-y-auto">
        <div className="mx-auto max-w-[1500px] p-5">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

// 主题：浅色 / 深色 / 报纸 — localStorage 持久化
export type Theme = 'light' | 'dark' | 'news';
const KEY = 'tf-theme';

export function getTheme(): Theme {
  try {
    const s = localStorage.getItem(KEY);
    if (s === 'dark' || s === 'light' || s === 'news') return s;
  } catch { /* ignore */ }
  return 'light';
}

export function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark');
  document.documentElement.classList.toggle('news', t === 'news');
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
}

export function setTheme(t: Theme): Theme {
  applyTheme(t);
  return t;
}

export function toggleTheme(): Theme {
  const order: Theme[] = ['light', 'dark', 'news'];
  const next = order[(order.indexOf(getTheme()) + 1) % order.length];
  applyTheme(next);
  return next;
}

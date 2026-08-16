import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, children, title, hint, right }: {
  className?: string; children: ReactNode; title?: string; hint?: string; right?: ReactNode;
}) {
  return (
    <div className={cn('card card-pad', className)}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-3.5 w-0.5 rounded-full bg-gradient-to-b from-accent to-accent/30" />
            <h2 className="text-xs font-semibold text-foreground">{title}</h2>
            {hint && <span className="num text-[10px] text-muted">{hint}</span>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({ label, value, className, valueClass }: {
  label: string; value: ReactNode; className?: string; valueClass?: string;
}) {
  return (
    <div className={cn('rounded-lg bg-elevated px-3 py-2.5 text-center', className)}>
      <div className={cn('num text-xl font-bold', valueClass)}>{value}</div>
      <div className="mt-0.5 text-[10px] text-muted">{label}</div>
    </div>
  );
}

export function Chip({ on, children, onClick, className, color }: {
  on?: boolean; children: ReactNode; onClick?: () => void; className?: string; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs transition-colors cursor-pointer',
        on ? 'border-transparent text-white' : 'border-border bg-surface text-secondary hover:text-foreground',
        className,
      )}
      style={on ? { background: color || 'hsl(var(--accent))' } : undefined}
    >
      {children}
    </button>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center text-xs text-muted">{text}</div>;
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'bull' | 'bear' | 'accent' | 'warn' | 'danger' }) {
  const tones: Record<string, string> = {
    default: 'bg-elevated text-secondary',
    bull: 'bg-bull/10 text-bull',
    bear: 'bg-bear/10 text-bear',
    accent: 'bg-accent/10 text-accent',
    warn: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
  };
  return <span className={cn('badge', tones[tone])}>{children}</span>;
}

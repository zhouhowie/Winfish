import { Card } from '@/components/ui';
import { MessageCircle, Mail } from 'lucide-react';

export default function Feedback() {
  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold">反馈</h1>

      <div className="grid grid-cols-2 gap-4 max-w-3xl">
        <Card title="QQ 交流">
          <div className="flex items-center gap-4 py-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent/10 text-accent">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-bold num">鱼</div>
              <div className="text-xs text-muted">知行 Winfish 使用交流与反馈</div>
            </div>
          </div>
        </Card>
        <Card title="邮箱">
          <div className="flex items-center gap-4 py-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-bull/10 text-bull">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm font-medium">winfish@hanako.ai</div>
              <div className="text-xs text-muted">功能建议 / bug 报告 / 数据源问题</div>
            </div>
          </div>
        </Card>
      </div>

      <Card title="使用说明" className="max-w-3xl">
        <ul className="list-inside list-disc space-y-1.5 text-xs leading-relaxed text-secondary">
          <li>多通道数据自动入库缓存（SQLite），避免重复请求上游；盘中数据自动定时刷新。</li>
          <li>遇到数据异常（涨跌停缺失、板块为空等）请截图反馈，附上时间点。</li>
          <li>导出日报支持从盘后复盘 + 盘前预期一键生成 HTML 报告。</li>
        </ul>
      </Card>
    </div>
  );
}

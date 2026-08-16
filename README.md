# trading-desk

公明的盘中操作 + 盘后复盘交互看板。**框架参考 [tickflow-stock-panel](https://github.com/shy3130/tickflow-stock-panel)**（React 18 + TS + Tailwind + Tanstack Query + ECharts），数据源由后端统一接管。

- 后端：Node.js (Express) + SQLite（内置 node:sqlite，免编译）· 端口 7788
- 前端：React 18 + TypeScript + Vite + Tailwind（亮/暗主题，默认亮色暖纸感）
- 数据源：**TDX tdxhub（主）** + **Tushare（辅）** + 东财（外盘/板块资金）+ 悟道（备用）
- 部署：腾讯云（见 DEPLOY.md）

## 页面（左侧边栏）

| 路由 | 页面 | 内容 |
|---|---|---|
| `/` | 看板总览 | 指数与量能 + 外盘映射（全球/美股七姐妹/费半/MU/LITE/黄金）+ 市场图表（10/20/30天）+ 年度走势（时间滑块+指数K线tab+量能/活跃市值/涨跌家数/涨跌停曲线） |
| `/sector` | 板块资金 | KG资金雷达（OneChart同源：加权评分/波段流入率/净额/龙头，概念/行业+排序） |
| `/premarket` | 盘前预案 | 市场定位观察（龙头的一生周期）/ 参与策略 / 关注方向 / 标的预案 / 持仓计划（按日期管理，一键复制） |
| `/desk` | 盘中操盘 | 指数K线（日K/分时切换，日K带MA5/10/20/47/131均线）+ 重点监测（盘前自动同步+个股K线+买价止损线+主力资金）+ 板块资金 + 情绪温度 |
| `/watchlist` | 自选 | 观察池分组 + 实时行情 |
| `/positions` | 持仓分析 | 持仓汇总（加权成本）+ 操作记录 + **交割单CSV导入** |
| `/ladder` | 连板梯队 | 涨停/跌停/炸板/封板率 + 梯队 + 主类 + 明细 |
| `/discover` | 发现 | 外盘映射（道指/纳指/日经/KOSPI/恒生）+ 活跃市值0AMV + 量能图 |
| `/review` | 盘后复盘 | 情绪复盘（数据→周期→逻辑）+ 复盘归档 + 心法·检查清单 |
| `/settings` | 设置 | 数据源状态 |

## 目录

```
server/                后端
  index.js             Express 入口（托管 frontend/dist）
  config.js            配置（.env）
  db.js                SQLite（观察池/操作/归档/盘前预案/快照缓存）
  scheduler.js         定时任务（盘中60s自动刷新）
  datasources/         tdx / tushare / wudao + 降级
  services/            emotion（涨停情绪）/ global（外盘）/ sector（板块资金）
  routes/              REST API
frontend/              React 前端（Vite + TS + Tailwind）
web/                   Vue 旧版（已废弃，保留作回退）
data/                  数据库与缓存
tickflow-ref/          参考源码（tickflow-stock-panel）
```

## 本地启动

```bash
npm install
cd frontend && npm install && npm run build && cd ..
npm start          # http://localhost:7788
```

## API

```
GET  /api/market/summary        大盘指数+成交额
GET  /api/market/quotes?codes=   实时行情
GET  /api/market/kline?code=     K线（period 4=日线）
GET  /api/market/volume?days=    两市成交额历史
GET  /api/market/amv             活跃市值（本地0AMV）
GET  /api/emotion                情绪面板（涨停/跌停/梯队/主类）
GET  /api/global/indices         外盘指数（东财）
GET  /api/sector/flow            板块资金流（行业/概念）
POST /api/import/trades          交割单批量导入
GET/POST /api/premarket          盘前预案（按日期）+ /copy
GET/POST/DELETE /api/watchlist   观察池
GET/POST /api/trades             操作记录
GET/POST /api/review             复盘归档
```

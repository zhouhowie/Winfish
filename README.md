# 知行 Winfish

A 股盘中 / 盘前 / 盘后一体化工作台。前后端一体，SQLite 持久化，数据由后端统一接管。

## 技术栈

- 后端：Node.js (Express) + SQLite（内置 node:sqlite，免编译）· 端口 7788
- 前端：React 18 + TypeScript + Vite + Tailwind（亮 / 暗主题，默认亮色暖纸感）
- 持久化：SQLite 单文件，重启不丢；定时任务自动刷新核心数据到缓存

## 页面（左侧边栏）

| 路由 | 页面 | 内容 |
|---|---|---|
| `/` | 看板总览 | 指数与量能 + 外盘映射 + 市场图表（10/20/30天）+ 年度走势（时间滑块 + 指数K线tab + 量能/活跃市值/涨跌家数/涨跌停曲线） |
| `/sector` | 板块资金 | 板块加权评分 / 波段流入率 / 净额 / 龙头，概念 / 行业 + 排序 |
| `/premarket` | 盘前预案 | 市场定位观察 / 参与策略 / 关注方向 / 标的预案 / 持仓计划（按日期管理，一键复制） |
| `/desk` | 盘中操盘 | 指数K线（日K/分时切换，日K带 MA5/10/20/47/131 均线）+ 重点监测（盘前自动同步 + 个股K线 + 买价止损线 + 主力资金）+ 板块资金 + 情绪温度 |
| `/watchlist` | 自选 | 观察池分组 + 实时行情 |
| `/positions` | 持仓分析 | 持仓汇总（加权成本）+ 操作记录 + 交割单CSV导入 |
| `/ladder` | 连板梯队 | 涨停/跌停/炸板/封板率 + 梯队 + 主类 + 明细 |
| `/discover` | 发现 | 外盘映射 + 活跃市值 0AMV + 量能图 |
| `/review` | 盘后复盘 | 情绪复盘（数据→周期→逻辑）+ 复盘归档 + 心法·检查清单 |
| `/settings` | 设置 | 主题风格 / 系统状态 / 关于 |

## 目录结构

```
server/                后端
  index.js             Express 入口（托管 frontend/dist）
  config.js            配置（.env，不入库）
  db.js                SQLite（观察池/操作/归档/盘前预案/快照缓存）
  scheduler.js         定时任务（盘中每小时整点刷新）
  datasources/         多通道数据接入 + 自动降级
  services/            情绪 / 外盘 / 板块 / 宽度 / 年度等业务服务
  routes/              REST API
frontend/              React 前端（Vite + TS + Tailwind）
web/                   Vue 旧版（已废弃，保留作回退）
data/                  数据库与缓存（不入库）
```

## 本地启动

```bash
npm install
cd frontend && npm install && npm run build && cd ..
npm start          # http://localhost:7788
```

## 数据刷新机制

- 盘中（9:15-11:35 / 12:55-15:05）：核心数据**每小时整点**刷新到缓存
- 外盘：每日 8:00 / 9:10 更新
- 盘后：15:10 自动拉收盘数据 + 当日快照归档
- 前端请求时若缓存过期会即时补拉一次

## API

```
GET  /api/market/summary        大盘指数+成交额
GET  /api/market/quotes?codes=   实时行情
GET  /api/market/kline?code=     K线（period 4=日线）
GET  /api/market/volume?days=    两市成交额历史
GET  /api/market/amv             活跃市值（本地0AMV）
GET  /api/emotion                情绪面板（涨停/跌停/梯队/主类）
GET  /api/global/indices         外盘指数
GET  /api/sector/flow            板块资金流（行业/概念）
POST /api/import/trades          交割单批量导入
GET/POST /api/premarket          盘前预案（按日期）+ /copy
GET/POST/DELETE /api/watchlist   观察池
GET/POST /api/trades             操作记录
GET/POST /api/review             复盘归档
```

## 说明

仅供研究参考，不构成投资建议。数据来源为公开渠道，准确性以官方为准。

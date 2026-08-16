# WinFish · 复盘点金

每日 A 股复盘与交易思考网站。基于自上而下四步法分析框架，整合情绪周期、技术分析、题材轮动三位专家体系。

## 文件结构

```
winfish/
├── index.html          # 首页 — 数据由 JS 渲染（容器 + 脚本引用）
├── archive.html        # 历史归档 — 数据由 JS 渲染
├── about.html          # 交易哲学 — 框架介绍
├── css/
│   └── style.css       # 完整样式系统（深色主题、响应式）
├── data/               # ★ 数据层（与页面分离，每日只需更新这里）
│   ├── latest.js       # 首页数据：window.WF_LATEST（量能/情绪/五维/资金流/近期复盘）
│   └── archive.js      # 归档数据：window.WF_ARCHIVE（按月索引全部复盘条目）
├── js/
│   ├── core/           # ★ 核心层（通用能力，跨页面复用）
│   │   ├── utils.js    # 工具函数：转义 / 星标 / 涨跌色 / DOM 辅助
│   │   └── app.js      # 全局交互：导航 / 锚点滚动 / 返回顶部 / 入场动画
│   ├── components/     # ★ 组件层（一个文件一个区块的渲染逻辑）
│   │   ├── stats.js    # 快速统计卡片
│   │   ├── emotion.js  # 情绪周期定位
│   │   ├── review.js   # 今日复盘卡片（量能/风险/主线/预案表）
│   │   ├── diagnosis.js# 五维诊断
│   │   ├── recent.js   # 近期复盘列表
│   │   ├── flows.js    # 主力资金流向表
│   │   └── archive.js  # 归档时间线
│   └── pages/          # ★ 页面层（按页面组装组件 + 入口）
│       ├── index.js    # 首页组装
│       └── archive.js  # 归档页组装
├── fupan/
│   ├── 2026-07-15.html # 当日完整复盘报告（示例）
│   └── ...             # 后续每日新增
└── assets/             # 静态资源（图片等）
```

## 分层逻辑

```
data/（数据）→ components/（区块渲染）→ pages/（页面组装）→ 浏览器
```

- **数据层**：每天复盘只需改 `data/latest.js` 和 `data/archive.js`，不动页面
- **组件层**：每个渲染函数只做一件事，可单独维护、复用
- **页面层**：只负责调用组件 + 触发全局交互

## 每日更新流程

1. 更新 `data/latest.js` 中的最新一日数据（量能、情绪、五维、资金流、近期列表）
2. 在 `data/archive.js` 对应月份下追加新条目（新月份则新增 month 对象）
3. 生成当日完整报告 HTML → 放入 `fupan/`
4. 上传至服务器

## 部署到阿里云

### 方式一：OSS + CDN（推荐 · 低成本）

1. 在阿里云 OSS 创建一个 Bucket（如 `winfish`），开启「静态网站托管」
2. 将整个 `winfish/` 目录上传到 Bucket
3. 绑定你的域名，配置 CDN 加速
4. 设置默认首页为 `index.html`

### 方式二：ECS + Nginx

1. 将 `winfish/` 目录上传到 ECS 服务器
2. Nginx 配置示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/winfish;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

## 技术栈

- 纯静态 HTML + CSS + JavaScript（数据层用 `<script>` 注入全局变量，无需后端，file:// 直接双击也能打开）
- 无外部依赖，加载速度快

## 说明

数据来源于公开市场信息，不构成投资建议。
主编：Howie

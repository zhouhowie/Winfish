/* ============================================
   WinFish · 数据层 · 首页最新数据
   window.WF_LATEST — 每日更新此文件即可刷新首页
   ============================================ */

window.WF_LATEST = {
  /* 日期信息 */
  date: "2026-07-15",
  weekday: "周三",
  dateLabel: "数据截止 2026年7月15日（周三）收盘",

  /* 快速统计卡片 */
  stats: [
    { key: "volume", label: "全市场成交额", value: "1.96", unit: "万亿", color: "red" },
    { key: "limitUp", label: "涨停家数", value: "48", unit: "", color: "red" },
    { key: "limitDown", label: "跌停家数", value: "3", unit: "", color: "green" },
    { key: "height", label: "连板高度", value: "5", unit: "", color: "gold" },
    { key: "upCount", label: "红盘家数", value: "1835", unit: "", color: "dim" },
    { key: "downCount", label: "绿盘家数", value: "3184", unit: "", color: "dim" }
  ],

  /* 情绪周期定位 */
  emotion: {
    phase: "降温期",
    phaseTag: "tag-orange",
    segments: [
      { name: "冰点", flex: 0.5, cls: "seg-ice" },
      { name: "修复", flex: 0.8, cls: "seg-recover" },
      { name: "主升", flex: 1.5, cls: "seg-rise" },
      { name: "高潮", flex: 1.2, cls: "seg-euph" },
      { name: "退潮", flex: 2, cls: "seg-retreat", pointer: true }
    ],
    details: [
      "涨停48家（首板32 / 连板16）",
      "连板高度 5 板",
      "晋级率 38%",
      "涨跌比 0.58"
    ]
  },

  /* 今日复盘卡片 */
  review: {
    title: "今日复盘 · 7月15日",
    link: "fupan/2026-07-15.html",
    volumeTitle: "量能信号",
    volumeText: "全市场成交额 1.96 万亿，较前日缩量约 1200 亿。量能连续3日回落，市场观望情绪加重，但仍在 1.8 万亿以上，暂未进入缩量风险区。",
    risk: {
      type: "success",
      level: "低风险",
      text: "量能未达 3.6 万亿警戒线，指数无明显加速迹象，情绪未过热。"
    },
    themes: ["AI算力", "光模块", "PCB", "智能驾驶", "AIDC"],
    plans: [
      { direction: "AI算力", tag: "tag-red", strategy: "持股观察，等待量能回补", condition: "成交额重回2万亿+", priority: 3 },
      { direction: "光模块", tag: "tag-blue", strategy: "回踩二轨低吸", condition: "板块指数回踩布林二轨", priority: 3 },
      { direction: "AIDC", tag: "tag-orange", strategy: "弱转强确认后介入", condition: "首板聚拢+板块指数放量", priority: 2 },
      { direction: "智能驾驶", tag: "tag-cyan", strategy: "观察，等待催化落地", condition: "政策催化+资金确认", priority: 1 }
    ],
    fullLinkText: "阅读完整 11 模块复盘报告"
  },

  /* 五维诊断 */
  diagnosis: {
    items: [
      { label: "指数强度", score: 55, bar: "gold" },
      { label: "量能健康度", score: 62, bar: "accent" },
      { label: "情绪温度", score: 42, bar: "orange" },
      { label: "资金方向", score: 48, bar: "orange" },
      { label: "板块结构", score: 50, bar: "gold" }
    ],
    overall: { score: 51, label: "偏弱震荡", tag: "tag-orange" }
  },

  /* 近期复盘列表 */
  recent: [
    { date: "7月15日", tag: "今日", cls: "tag-blue" },
    { date: "7月14日", tag: "已更新", cls: "tag-green" },
    { date: "7月13日", tag: "已更新", cls: "tag-green" },
    { date: "7月9日", tag: "已更新", cls: "tag-gray" },
    { date: "7月8日", tag: "已更新", cls: "tag-gray" },
    { date: "7月3日", tag: "已更新", cls: "tag-gray" },
    { date: "7月2日", tag: "已更新", cls: "tag-gray" },
    { date: "7月1日", tag: "已更新", cls: "tag-gray" }
  ],

  /* 主力资金流向 TOP5 */
  flows: [
    { rank: 1, name: "工业富联", flow: "+8.42亿", flowUp: true, change: "+3.86%", changeUp: true, turnover: "2.31%", logic: "AI算力龙头，英伟达映射" },
    { rank: 2, name: "中际旭创", flow: "+6.15亿", flowUp: true, change: "+2.54%", changeUp: true, turnover: "3.12%", logic: "光模块龙头，海外订单确认" },
    { rank: 3, name: "沪电股份", flow: "+4.87亿", flowUp: true, change: "+4.21%", changeUp: true, turnover: "4.56%", logic: "PCB龙头，AI服务器需求" },
    { rank: 4, name: "比亚迪", flow: "-3.24亿", flowUp: false, change: "-1.68%", changeUp: false, turnover: "1.12%", logic: "短期获利盘兑现" },
    { rank: 5, name: "赛力斯", flow: "+3.01亿", flowUp: true, change: "+2.78%", changeUp: true, turnover: "3.89%", logic: "智能驾驶催化，问界销量" }
  ]
};

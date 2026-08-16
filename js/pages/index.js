/* ============================================
   WinFish · pages/index — 首页组装
   依赖：core/utils, core/app, components/*, data/latest.js
   ============================================ */

window.WF = window.WF || {};

WF.pages = WF.pages || {};

WF.pages.index = (function () {
  "use strict";

  var u = WF.utils;

  function init() {
    /* 数据未注入（data/latest.js 未加载）时不渲染 */
    if (!window.WF_LATEST) return;

    var d = WF_LATEST;

    /* Hero 数据截止日期 */
    var heroDate = document.getElementById("hero-date");
    if (heroDate) heroDate.textContent = d.dateLabel;

    /* 各组件渲染 */
    WF.components.stats.render(d.stats);
    WF.components.emotion.render(d.emotion);
    WF.components.review.render(d.review);
    WF.components.diagnosis.render(d.diagnosis);
    WF.components.recent.render(d.recent);
    WF.components.flows.render(d.flows);

    /* 全局交互（导航/动画等） */
    if (WF.app) WF.app.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { init: init };
})();

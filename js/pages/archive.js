/* ============================================
   WinFish · pages/archive — 归档页组装
   依赖：core/utils, core/app, components/archive, data/archive.js
   ============================================ */

window.WF = window.WF || {};

WF.pages = WF.pages || {};

WF.pages.archive = (function () {
  "use strict";

  function init() {
    /* 数据未注入时不渲染 */
    if (!window.WF_ARCHIVE) return;

    WF.components.archive.render(WF_ARCHIVE.months);

    if (WF.app) WF.app.init();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { init: init };
})();

/* ============================================
   WinFish · core/utils — 通用工具函数
   ============================================ */

window.WF = window.WF || {};

WF.utils = (function () {
  "use strict";

  /* HTML 转义，防止数据中的特殊字符破坏页面 */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* 星标（优先级）：priority 1~5 → ★ */
  function stars(n) {
    var out = "";
    n = Math.max(0, Math.min(5, Number(n) || 0));
    for (var i = 0; i < n; i++) {
      out += '<span class="star">★</span>';
    }
    return out;
  }

  /* 涨跌方向 class：正→up / 负→down */
  function upDownClass(isUp) {
    return isUp ? "up" : "down";
  }

  /* 资金方向颜色：正→红（A股红涨） / 负→绿 */
  function flowColor(isInflow) {
    return isInflow ? "var(--red)" : "var(--green)";
  }

  /* 快捷 DOM 创建 */
  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        node.setAttribute(k, attrs[k]);
      });
    }
    if (html != null) node.innerHTML = html;
    return node;
  }

  return {
    esc: esc,
    stars: stars,
    upDownClass: upDownClass,
    flowColor: flowColor,
    el: el
  };
})();

/* ============================================
   WinFish · components/stats — 快速统计卡片
   ============================================ */

window.WF = window.WF || {};

WF.components = WF.components || {};

WF.components.stats = (function () {
  "use strict";

  var u = WF.utils;

  /* data: WF_LATEST.stats */
  function render(data) {
    var container = document.getElementById("quick-stats");
    if (!container || !data || !data.length) return;

    var html = data
      .map(function (s) {
        var unit = s.unit ? '<span style="font-size:0.5em;font-weight:400;">' + u.esc(s.unit) + "</span>" : "";
        var color = s.color === "red" ? "var(--red)" : s.color === "green" ? "var(--green)" : s.color === "gold" ? "var(--gold)" : "var(--text-dim)";
        return (
          '<div class="quick-stat-card">' +
          '<div class="qs-value" style="color:' + color + '">' + u.esc(s.value) + unit + "</div>" +
          '<div class="qs-label">' + u.esc(s.label) + "</div>" +
          "</div>"
        );
      })
      .join("");

    container.innerHTML = html;
  }

  return { render: render };
})();

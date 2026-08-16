/* ============================================
   WinFish · components/review — 今日复盘卡片
   ============================================ */

window.WF = window.WF || {};

WF.components = WF.components || {};

WF.components.review = (function () {
  "use strict";

  var u = WF.utils;

  /* data: WF_LATEST.review */
  function render(data) {
    var container = document.getElementById("review-card");
    if (!container || !data) return;

    var themes = data.themes
      .map(function (t) { return '<span class="tag tag-blue">' + u.esc(t) + "</span>"; })
      .join("");

    var planRows = data.plans
      .map(function (p) {
        return (
          "<tr>" +
          "<td><span class=\"tag " + u.esc(p.tag) + "\">" + u.esc(p.direction) + "</span></td>" +
          "<td>" + u.esc(p.strategy) + "</td>" +
          "<td>" + u.esc(p.condition) + "</td>" +
          "<td>" + u.stars(p.priority) + "</td>" +
          "</tr>"
        );
      })
      .join("");

    var html =
      '<div class="card-header">' +
      "<h3>" + u.esc(data.title) + "</h3>" +
      '<a href="' + u.esc(data.link) + '" style="font-size:0.85em;">查看完整报告 →</a>' +
      "</div>" +

      '<h4 style="margin:12px 0 8px;font-size:0.9rem;color:var(--text);">' + u.esc(data.volumeTitle) + "</h4>" +
      '<p style="font-size:0.9em;color:var(--text-dim);">' + u.esc(data.volumeText) + "</p>" +

      '<h4 style="margin:12px 0 8px;font-size:0.9rem;color:var(--text);">风险检查</h4>' +
      '<div class="alert alert-' + u.esc(data.risk.type) + '">' +
      "<strong>🟢 " + u.esc(data.risk.level) + "</strong> " + u.esc(data.risk.text) +
      "</div>" +

      '<h4 style="margin:12px 0 8px;font-size:0.9rem;color:var(--text);">板块主线</h4>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;">' + themes + "</div>" +

      '<h4 style="margin:12px 0 8px;font-size:0.9rem;color:var(--text);">预案精选</h4>' +
      '<div class="table-wrap">' +
      "<table><thead><tr>" +
      "<th>方向</th><th>策略</th><th>关键条件</th><th>优先级</th>" +
      "</tr></thead><tbody>" + planRows + "</tbody></table>" +
      "</div>" +

      '<div style="margin-top:16px;text-align:right;">' +
      '<a href="' + u.esc(data.link) + '" style="font-size:0.85rem;">' + u.esc(data.fullLinkText) + " →</a>" +
      "</div>";

    container.innerHTML = html;
  }

  return { render: render };
})();

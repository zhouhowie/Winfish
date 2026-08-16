/* ============================================
   WinFish · components/recent — 近期复盘列表
   ============================================ */

window.WF = window.WF || {};

WF.components = WF.components || {};

WF.components.recent = (function () {
  "use strict";

  var u = WF.utils;

  /* data: WF_LATEST.recent */
  function render(data) {
    var container = document.getElementById("recent-card");
    if (!container || !data || !data.length) return;

    var items = data
      .map(function (r) {
        return (
          "<li>" +
          '<span class="rl-date">' + u.esc(r.date) + "</span>" +
          '<span class="tag ' + u.esc(r.cls) + '">' + u.esc(r.tag) + "</span>" +
          "</li>"
        );
      })
      .join("");

    var html =
      '<div class="card-header">' +
      "<h3>近期复盘</h3>" +
      '<a href="archive.html" style="font-size:0.82em;">查看全部</a>' +
      "</div>" +
      '<ul class="recent-list">' + items + "</ul>";

    container.innerHTML = html;
  }

  return { render: render };
})();

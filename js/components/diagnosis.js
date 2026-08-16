/* ============================================
   WinFish · components/diagnosis — 五维诊断
   ============================================ */

window.WF = window.WF || {};

WF.components = WF.components || {};

WF.components.diagnosis = (function () {
  "use strict";

  var u = WF.utils;

  /* data: WF_LATEST.diagnosis */
  function render(data) {
    var container = document.getElementById("diagnosis-card");
    if (!container || !data) return;

    var bars = data.items
      .map(function (item) {
        return (
          "<div>" +
          '<div style="display:flex;justify-content:space-between;font-size:0.82em;margin-bottom:4px;">' +
          '<span style="color:var(--text-dim);">' + u.esc(item.label) + "</span>" +
          '<span style="color:var(--text-dim);">' + item.score + " / 100</span>" +
          "</div>" +
          '<div style="height:6px;background:var(--bg);border-radius:3px;overflow:hidden;">' +
          '<div style="width:' + item.score + "%;height:100%;background:" + u.esc(item.bar) + ";border-radius:3px;\"></div>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    var html =
      '<div class="card-header"><h3>五维诊断</h3></div>' +
      '<div style="display:flex;flex-direction:column;gap:10px;">' + bars +
      '<div style="margin-top:8px;text-align:center;">' +
      '<span class="tag ' + u.esc(data.overall.tag) + '">综合评分 ' + data.overall.score + " · " + u.esc(data.overall.label) + "</span>" +
      "</div></div>";

    container.innerHTML = html;
  }

  return { render: render };
})();

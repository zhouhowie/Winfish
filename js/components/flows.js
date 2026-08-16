/* ============================================
   WinFish · components/flows — 主力资金流向表
   ============================================ */

window.WF = window.WF || {};

WF.components = WF.components || {};

WF.components.flows = (function () {
  "use strict";

  var u = WF.utils;

  /* data: WF_LATEST.flows */
  function render(data) {
    var container = document.getElementById("flows-card");
    if (!container || !data || !data.length) return;

    var rows = data
      .map(function (f) {
        var flowColor = f.flowUp ? "var(--red)" : "var(--green)";
        return (
          "<tr>" +
          "<td>" + f.rank + "</td>" +
          "<td>" + u.esc(f.name) + "</td>" +
          '<td style="color:' + flowColor + ';">' + u.esc(f.flow) + "</td>" +
          '<td class="' + u.upDownClass(f.changeUp) + '">' + u.esc(f.change) + "</td>" +
          "<td>" + u.esc(f.turnover) + "</td>" +
          '<td style="font-size:0.85em;color:var(--text-dim);">' + u.esc(f.logic) + "</td>" +
          "</tr>"
        );
      })
      .join("");

    var html =
      '<div class="card-header"><h3>主力资金流向 TOP10</h3></div>' +
      '<div class="table-wrap">' +
      "<table><thead><tr>" +
      "<th>排名</th><th>标的</th><th>方向</th><th>今日涨跌</th><th>换手</th><th>逻辑</th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table>" +
      "</div>";

    container.innerHTML = html;
  }

  return { render: render };
})();

/* ============================================
   WinFish · components/archive — 归档时间线
   ============================================ */

window.WF = window.WF || {};

WF.components = WF.components || {};

WF.components.archive = (function () {
  "use strict";

  var u = WF.utils;

  /* data: WF_ARCHIVE.months */
  function render(months) {
    var container = document.getElementById("archive-timeline");
    if (!container || !months || !months.length) return;

    var html = months
      .map(function (month) {
        var items = month.items
          .map(function (item) {
            var tags = item.tags
              .map(function (t) { return '<span class="tag ' + u.esc(t.cls) + '">' + u.esc(t.text) + "</span>"; })
              .join('<span style="margin-left:4px;"></span>');
            return (
              '<a href="' + u.esc(item.link) + '" class="archive-item" style="display:block;">' +
              '<div class="ai-date">' + u.esc(item.date) +
              ' <span style="font-size:0.78em;color:var(--text-dim);font-weight:400;">' + u.esc(item.weekday) + "</span></div>" +
              '<div class="ai-meta">' + u.esc(item.meta) + "</div>" +
              '<div style="margin-top:6px;">' + tags + "</div>" +
              "</a>"
            );
          })
          .join("");

        return (
          '<div class="archive-month">' +
          "<h2>" + u.esc(month.label) + "</h2>" +
          '<div class="archive-items">' + items + "</div>" +
          "</div>"
        );
      })
      .join("");

    container.innerHTML = html;
  }

  return { render: render };
})();

/* ============================================
   WinFish · components/emotion — 情绪周期定位
   ============================================ */

window.WF = window.WF || {};

WF.components = WF.components || {};

WF.components.emotion = (function () {
  "use strict";

  var u = WF.utils;

  /* data: WF_LATEST.emotion */
  function render(data) {
    var container = document.getElementById("emotion-card");
    if (!container || !data) return;

    var segs = data.segments
      .map(function (seg) {
        var arrow = seg.pointer ? "← " : "";
        return (
          '<div class="segment ' + u.esc(seg.cls) + '" style="flex:' + seg.flex + ';">' +
          arrow + u.esc(seg.name) +
          "</div>"
        );
      })
      .join("");

    var details = data.details
      .map(function (d) { return "<span>" + u.esc(d) + "</span>"; })
      .join('<span>·</span>');

    var html =
      '<div class="card-header">' +
      "<h3>情绪周期定位</h3>" +
      '<span class="tag ' + u.esc(data.phaseTag) + '">' + u.esc(data.phase) + "</span>" +
      "</div>" +
      '<div class="cycle-bar">' + segs + "</div>" +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;font-size:0.85em;color:var(--text-dim);">' +
      details +
      "</div>";

    container.innerHTML = html;
  }

  return { render: render };
})();

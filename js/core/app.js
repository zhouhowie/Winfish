/* ============================================
   WinFish · core/app — 全局交互
   导航 / 锚点滚动 / 返回顶部 / 入场动画 / 表格触摸
   ============================================ */

window.WF = window.WF || {};

WF.app = (function () {
  "use strict";

  /* ---------- Mobile nav toggle ---------- */
  function initNav() {
    var toggle = document.getElementById("navToggle");
    var navLinks = document.getElementById("navLinks");
    if (!toggle || !navLinks) return;

    toggle.addEventListener("click", function () {
      navLinks.classList.toggle("open");
      var isOpen = navLinks.classList.contains("open");
      toggle.setAttribute("aria-expanded", isOpen);
      toggle.innerHTML = isOpen ? "✕" : "☰";
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navLinks.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.innerHTML = "☰";
      });
    });

    document.addEventListener("click", function (e) {
      if (!toggle.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.innerHTML = "☰";
      }
    });
  }

  /* ---------- Back to top ---------- */
  function initBackTop() {
    var backTop = document.getElementById("backTop");
    if (!backTop) return;

    window.addEventListener("scroll", function () {
      backTop.style.display = window.scrollY > 400 ? "" : "none";
    });

    backTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- Section nav active highlight ---------- */
  function initSectionNav() {
    var sectionNav = document.querySelector(".section-nav");
    if (!sectionNav) return;

    var links = sectionNav.querySelectorAll("a");
    var sections = [];

    links.forEach(function (link) {
      var href = link.getAttribute("href");
      if (href && href.startsWith("#")) {
        var target = document.getElementById(href.slice(1));
        if (target) sections.push({ el: target, link: link });
      }
    });

    function updateActiveSection() {
      var scrollPos = window.scrollY + 120;
      var currentId = null;

      for (var i = 0; i < sections.length; i++) {
        if (sections[i].el.offsetTop <= scrollPos) currentId = sections[i].el.id;
      }

      links.forEach(function (link) { link.classList.remove("active"); });
      if (currentId) {
        var active = sectionNav.querySelector('a[href="#' + currentId + '"]');
        if (active) active.classList.add("active");
      }
    }

    window.addEventListener("scroll", updateActiveSection);
    updateActiveSection();

    links.forEach(function (link) {
      link.addEventListener("click", function (e) {
        var href = link.getAttribute("href");
        if (!href || !href.startsWith("#")) return;
        e.preventDefault();
        var target = document.getElementById(href.slice(1));
        if (!target) return;
        var top = target.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: top, behavior: "smooth" });
      });
    });
  }

  /* ---------- Auto-update year ---------- */
  function initYear() {
    var yearSpan = document.getElementById("year");
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
  }

  /* ---------- Entrance animations ----------
     纯装饰：加 class 由 CSS animation 播放淡入，
     不依赖 IntersectionObserver，避免视口外内容（打印/截图）永远隐藏。 */
  function initAnimations() {
    if (!("IntersectionObserver" in window)) return;
    document
      .querySelectorAll(".card, .archive-item, .quick-stat-card")
      .forEach(function (el) {
        el.classList.add("wf-anim");
      });
  }

  /* ---------- Table row highlight on tap ---------- */
  function initTableTouch() {
    document.querySelectorAll("tr").forEach(function (row) {
      row.addEventListener("touchstart", function () {
        this.classList.add("touch-highlight");
      });
      row.addEventListener("touchend", function () {
        var self = this;
        setTimeout(function () {
          self.classList.remove("touch-highlight");
        }, 200);
      });
    });
  }

  /* ---------- 数据渲染完成后调用（DOM 已就绪且数据已注入） ---------- */
  function init() {
    initNav();
    initBackTop();
    initSectionNav();
    initYear();
    initAnimations();
    initTableTouch();
  }

  return {
    init: init
  };
})();

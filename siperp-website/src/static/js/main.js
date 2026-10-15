// SIPERP site: mobile menu, header shadow, and the Book a Demo / Contact forms.
(function () {
  "use strict";

  // Where the forms send leads (they land in Super Admin -> Demo Requests). The
  // address comes from site.config.json via a <meta> tag written at build time.
  // (window.SIPERP_API is only for testing against a local backend.)
  var apiMeta = document.querySelector('meta[name="siperp-api"]');
  var API = window.SIPERP_API || (apiMeta && apiMeta.content) || "";
  var phoneMeta = document.querySelector('meta[name="siperp-phone"]');
  var PHONE = (phoneMeta && phoneMeta.content) || "us";

  var header = document.querySelector(".site-header");
  var menuBtn = document.querySelector(".menu-btn");

  if (menuBtn && header) {
    menuBtn.addEventListener("click", function () {
      var open = header.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.querySelectorAll(".nav-links a").forEach(function (a) {
      a.addEventListener("click", function () {
        header.classList.remove("open");
        menuBtn.setAttribute("aria-expanded", "false");
      });
    });
  }

  function onScroll() {
    if (header) header.classList.toggle("scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  // ---- Resources dropdown ----
  var menus = document.querySelectorAll(".has-menu");
  menus.forEach(function (m) {
    var toggle = m.querySelector(".menu-toggle");
    if (!toggle) return;
    toggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = m.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });
  function closeMenus() {
    menus.forEach(function (m) {
      m.classList.remove("open");
      var t = m.querySelector(".menu-toggle");
      if (t) t.setAttribute("aria-expanded", "false");
    });
  }
  document.addEventListener("click", closeMenus);

  // ---- hero carousel ----
  var slidesBox = document.querySelector(".hero-slides");
  if (slidesBox) {
    var slides = slidesBox.querySelectorAll("[data-slide]");
    var dots = document.querySelectorAll(".ctrl-dots button");
    var current = 0;
    var timer = null;
    var show = function (n) {
      current = (n + slides.length) % slides.length;
      slides.forEach(function (s, i) { s.classList.toggle("is-active", i === current); });
      dots.forEach(function (d, i) { d.classList.toggle("on", i === current); });
    };
    var play = function () {
      stop();
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      timer = setInterval(function () { show(current + 1); }, 6500);
    };
    var stop = function () { if (timer) { clearInterval(timer); timer = null; } };
    var prev = document.querySelector(".ctrl-prev");
    var next = document.querySelector(".ctrl-next");
    if (prev) prev.addEventListener("click", function () { show(current - 1); play(); });
    if (next) next.addEventListener("click", function () { show(current + 1); play(); });
    dots.forEach(function (d, i) { d.addEventListener("click", function () { show(i); play(); }); });
    var art = document.querySelector(".hero2-art");
    if (art) {
      art.addEventListener("mouseenter", stop);
      art.addEventListener("mouseleave", play);
    }
    play();
  }

  // ---- site search (client side, over /search-index.json) ----
  var overlay = document.querySelector(".search-overlay");
  if (overlay) {
    var input = overlay.querySelector(".search-input");
    var list = overlay.querySelector(".search-results");
    var index = null;
    var render = function (q) {
      q = q.trim().toLowerCase();
      var items = (index || []).filter(function (it) {
        return !q || (it.title + " " + it.text + " " + it.keywords).toLowerCase().indexOf(q) !== -1;
      }).slice(0, 8);
      list.innerHTML = "";
      if (!items.length) {
        var li = document.createElement("li");
        li.className = "empty";
        li.textContent = "Nothing found. Try “pricing”, “inventory” or “GST”.";
        list.appendChild(li);
        return;
      }
      items.forEach(function (it) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = it.url;
        var b = document.createElement("b");
        b.textContent = it.title;
        var s = document.createElement("span");
        s.textContent = it.text;
        a.appendChild(b);
        a.appendChild(s);
        li.appendChild(a);
        list.appendChild(li);
      });
    };
    var openSearch = function () {
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      input.value = "";
      if (index) render("");
      else
        fetch("/search-index.json")
          .then(function (r) { return r.json(); })
          .then(function (data) { index = data; render(input.value); })
          .catch(function () { index = []; render(""); });
      setTimeout(function () { input.focus(); }, 30);
    };
    var closeSearch = function () {
      overlay.hidden = true;
      document.body.style.overflow = "";
    };
    document.querySelectorAll(".search-open").forEach(function (b) { b.addEventListener("click", openSearch); });
    input.addEventListener("input", function () { render(input.value); });
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeSearch(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeSearch(); closeMenus(); }
    });
  }

  // ---- lead forms ----
  document.querySelectorAll("form[data-lead]").forEach(function (form) {
    var msg = form.querySelector(".form-msg");
    var button = form.querySelector("button[type=submit]");

    function show(kind, text) {
      msg.className = "form-msg " + kind;
      msg.textContent = text;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var data = {};
      new FormData(form).forEach(function (value, key) { data[key] = value; });
      data.kind = form.getAttribute("data-lead");
      data.page = location.pathname;

      var phone = String(data.phone || "").replace(/\D/g, "");
      if (!String(data.name || "").trim()) return show("err", "Please enter your name.");
      if (!phone && !String(data.email || "").trim()) return show("err", "Please give a phone number or an email so we can reach you.");
      if (phone && phone.length < 10) return show("err", "Please enter a valid 10-digit phone number.");

      button.disabled = true;
      var label = button.textContent;
      button.textContent = "Sending…";
      msg.className = "form-msg";

      fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, body: body }; });
        })
        .then(function (r) {
          if (!r.ok) throw new Error((r.body && r.body.message) || "Something went wrong.");
          form.reset();
          show("ok", "Thank you! We have received your request and will contact you shortly.");
        })
        .catch(function (err) {
          var offline = err && /failed to fetch|network/i.test(err.message);
          show("err", (offline ? "We could not send that just now." : err.message) + " Please call " + PHONE + " or WhatsApp us and we will help you right away.");
        })
        .then(function () {
          button.disabled = false;
          button.textContent = label;
        });
    });
  });
})();

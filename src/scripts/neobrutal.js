/*
 * Neo-brutalist skin: behaviour.
 *
 * Purely presentational. It never moves, removes or rewrites content; it only
 *   - tags existing elements (nb-card, nb-btn, nb-pill, nb-img, nb-band, nb-prose-link)
 *     so styles/neobrutal.css can restyle the site's many hand-built blocks,
 *   - plays a one-off entrance animation as tagged elements scroll into view,
 *   - adds an aria-hidden, pointer-events:none layer of animated shapes.
 * No dependencies. Respects prefers-reduced-motion.
 */
(function () {
  'use strict';
  if (window.__nbSkin) return;
  window.__nbSkin = true;

  var doc = document, root = doc.documentElement, body = doc.body;
  if (!body) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen = new WeakSet();
  var bands = [];
  var cardRects = new Map();
  // blocks that already animate themselves keep their own entrance
  var OWN_REVEAL = '[class*="reveal"],[data-aos],[class*="animat"],.elementor-invisible,[class*="fade"]';
  var SKIP_MOTION = '[class*="marquee"],[class*="swiper"],[class*="slick"],[class*="carousel"],[class*="ticker"],[class*="slider"]';

  // Some pages scroll inside <body> (html{overflow:hidden}) instead of the window.
  var bodyScroller = false;
  function detectScroller() {
    var ho = getComputedStyle(root).overflowY, bo = getComputedStyle(body).overflowY;
    bodyScroller = (ho === 'hidden' || ho === 'clip') && (bo === 'auto' || bo === 'scroll') && body.scrollHeight > body.clientHeight + 40;
  }
  function scrollTop() { return bodyScroller ? body.scrollTop : window.scrollY; }

  // ---- helpers ---------------------------------------------------------------
  function rgba(str) {
    var m = /rgba?\(([^)]+)\)/.exec(str || '');
    if (!m) return [0, 0, 0, 0];
    var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
    return [p[0] || 0, p[1] || 0, p[2] || 0, p.length > 3 ? p[3] : 1];
  }
  function lum(c) {
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  }
  function px(v) { return parseFloat(v) || 0; }
  function fourBorders(cs) {
    return px(cs.borderTopWidth) >= 1 && px(cs.borderRightWidth) >= 1 && px(cs.borderBottomWidth) >= 1 && px(cs.borderLeftWidth) >= 1 &&
      cs.borderTopStyle !== 'none' && cs.borderLeftStyle !== 'none' && rgba(cs.borderTopColor)[3] >= 0.1;
  }
  function ownText(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }

  var CARD_TAGS = { DIV: 1, ARTICLE: 1, LI: 1, A: 1, SECTION: 1, ASIDE: 1, FIGURE: 1, FORM: 1, BLOCKQUOTE: 1, DETAILS: 1 };
  var BAND_TAGS = { DIV: 1, SECTION: 1, FOOTER: 1, HEADER: 1, MAIN: 1, ARTICLE: 1 };
  var PILL_TAGS = { SPAN: 1, DIV: 1, A: 1, LI: 1, BUTTON: 1, P: 1 };

  // ---- tagging ---------------------------------------------------------------
  function scan() {
    var vw = root.clientWidth, vh = window.innerHeight, sy = window.scrollY;
    var els = body.querySelectorAll('div,section,article,li,a,button,aside,figure,form,blockquote,details,span,p,img,footer,header,main');
    var todo = [];

    // read phase
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (seen.has(el) || el.__nbTagged) continue;
      if (el.closest('.nb-deco-layer') || el.closest('svg')) { seen.add(el); continue; }
      var r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 14) continue;          // hidden for now: look again later
      seen.add(el);
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      var tag = el.tagName, w = r.width, h = r.height;
      var inNav = !!el.closest('#hwnav');
      var item = { el: el, r: r, top: r.top + sy, cls: [] };

      if (tag === 'IMG') {
        var src = el.currentSrc || el.src || '';
        if (w >= 260 && h >= 150 && /\.(jpe?g|webp)(\?|$)/i.test(src) && !el.closest(SKIP_MOTION) && !inNav) {
          var pc = el.closest('.nb-card');
          var pr = pc && cardRects.get(pc);
          if (!(pr && w >= pr.width - 6)) { item.cls.push('nb-img'); item.fx = 'nb-fx-stamp'; }
        }
        if (item.cls.length) todo.push(item);
        continue;
      }

      var bg = rgba(cs.backgroundColor);
      var radius = px(cs.borderTopLeftRadius);
      var bordered = fourBorders(cs);
      var fixed = cs.position === 'fixed' || cs.position === 'sticky';
      var roundish = radius >= Math.min(w, h) / 2 - 2;
      var txt = null;

      // buttons
      if ((tag === 'A' || tag === 'BUTTON' || el.getAttribute('role') === 'button') && h >= 26 && h <= 86 && w >= 64 && w <= 480 &&
          (bg[3] >= 0.6 || bordered) && cs.display !== 'inline') {
        txt = ownText(el);
        if (txt.length >= 2 && txt.length <= 48 && !el.querySelector('img,picture,video')) item.cls.push('nb-btn');
      }

      // pills / tags
      if (!item.cls.length && PILL_TAGS[tag] && h >= 18 && h <= 42 && w >= 34 && w <= 280 && radius >= 8 &&
          (bg[3] >= 0.5 || bordered) && el.children.length <= 3 && !inNav) {
        txt = txt === null ? ownText(el) : txt;
        if (txt.length >= 2 && txt.length <= 34) item.cls.push('nb-pill');
      }

      // cards
      if (!item.cls.length && CARD_TAGS[tag] && !inNav && !fixed && !roundish && w >= 150 && h >= 80 && w <= vw * 0.94) {
        var isCard = bordered ||
          (radius >= 6 && bg[3] >= 0.5) ||
          (cs.boxShadow !== 'none' && radius >= 4 && bg[3] >= 0.5);
        if (isCard) {
          // skip wrappers that merely repeat an enclosing card
          var p = el.parentElement, dup = false, depth = 0;
          while (p && depth < 4) {
            var prc = cardRects.get(p);
            if (prc && Math.abs(prc.width - w) < 14 && Math.abs(prc.height - h) < 14) { dup = true; break; }
            p = p.parentElement; depth++;
          }
          if (!dup) {
            cardRects.set(el, r);
            item.cls.push('nb-card');
            item.fx = 'nb-fx-rise';
            if (h < 640 && (tag === 'A' || cs.cursor === 'pointer' || el.querySelector('a[href]'))) item.cls.push('nb-hot');
          }
        }
      }

      // full-width bands
      if (!item.cls.length && BAND_TAGS[tag] && !inNav && !fixed && w >= vw * 0.98 && h >= 180 && !el.closest('.hw-ann')) {
        var hasImg = /url\(/.test(cs.backgroundImage);
        if (bg[3] >= 0.9 || cs.backgroundImage !== 'none') {
          var par = el.parentElement, same = false;
          for (var d = 0; par && d < 3; d++, par = par.parentElement) {
            if (par.__nbBand && Math.abs(par.__nbBand - h) < 6) { same = true; break; }
          }
          if (!same) {
            el.__nbBand = h;
            item.cls.push('nb-band');
            item.band = { solid: bg[3] >= 0.9, img: hasImg, l: lum(bg), h: h };
          }
        }
      }

      // inline links in running text
      if (!item.cls.length && tag === 'A' && cs.display === 'inline' && el.getAttribute('href') && !inNav &&
          el.closest('p,li') && !el.closest('footer,nav,.hwf-shell,[class*="menu"],[class*="breadcrumb"]') && !el.querySelector('img,svg')) {
        item.cls.push('nb-prose-link');
      }

      if (!item.cls.length) continue;
      todo.push(item);
    }

    // section headings get an entrance too
    var heads = body.querySelectorAll('h2');
    for (var k = 0; k < heads.length; k++) {
      var hd = heads[k];
      if (seen.has(hd) || hd.__nbTagged) continue;
      var hr = hd.getBoundingClientRect();
      if (hr.width < 24 || hr.height < 10) continue;
      seen.add(hd);
      if (hd.closest('#hwnav') || hd.closest(SKIP_MOTION) || hd.closest('footer,[class*="hwf-"]')) continue;
      if (parseFloat(getComputedStyle(hd).fontSize) < 22) continue;   // small label headings stay put
      todo.push({ el: hd, r: hr, top: hr.top + sy, cls: [], fx: 'nb-fx-slide' });
    }

    // write phase
    var siblingIndex = new Map();
    for (var j = 0; j < todo.length; j++) {
      var it = todo[j], e = it.el;
      e.__nbTagged = true;
      for (var c = 0; c < it.cls.length; c++) e.classList.add(it.cls[c]);

      if (it.band) {
        bands.push(e);
        var b = it.band;
        if (b.solid && !b.img && b.h <= 1400) {       // long reading areas stay plain
          if (b.l > 0.6) {
            var li = lightBands++ % 4;
            if (li === 0) e.classList.add('nb-pat-dots');
            else if (li === 1 && b.h <= 900 && b.l > 0.8) e.classList.add('nb-block-lime');
            else if (li === 2) e.classList.add('nb-pat-grid');
          } else if (b.l < 0.2) {
            var di = darkBands++ % 3;
            if (di === 0) e.classList.add('nb-pat-grid');
            else if (di === 2) e.classList.add('nb-pat-stripes');
          }
        }
      }

      if (it.fx && !reduce && io && it.r.top > vh * 0.92 && !e.closest('.nb-wait') && !e.closest(SKIP_MOTION) && !e.matches(OWN_REVEAL)) {
        var ecs = getComputedStyle(e);
        if (parseFloat(ecs.opacity) >= 0.99 && ecs.animationName === 'none') {
          var parent = e.parentElement;
          var n = siblingIndex.get(parent) || 0;
          siblingIndex.set(parent, n + 1);
          e.style.setProperty('--nb-d', Math.min(n, 5) * 70 + 'ms');
          e.__nbFx = it.fx;
          e.classList.add('nb-wait');
          io.observe(e);
        }
      }
    }
    if (todo.length) placeShapesSoon();
  }
  var lightBands = 0, darkBands = 0;

  // ---- reveal on scroll ---------------------------------------------------------
  function reveal(el) {
    if (!el.classList.contains('nb-wait')) return;
    el.classList.remove('nb-wait');
    el.classList.add('nb-in', el.__nbFx || 'nb-fx-rise');
    var done = function () {
      el.classList.remove('nb-in', 'nb-fx-rise', 'nb-fx-slide', 'nb-fx-stamp');
      el.style.removeProperty('--nb-d');
      el.removeEventListener('animationend', done);
    };
    el.addEventListener('animationend', done);
    setTimeout(done, 1400);
  }
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { io.unobserve(en.target); reveal(en.target); }
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -5% 0px' }) : null;

  // never leave anything hidden: reveal whatever is above the fold line or was skipped past
  function sweep() {
    var waiting = doc.querySelectorAll('.nb-wait');
    var limit = window.innerHeight;
    for (var i = 0; i < waiting.length; i++) {
      var r = waiting[i].getBoundingClientRect();
      if (r.top < limit || r.width === 0) { if (io) io.unobserve(waiting[i]); reveal(waiting[i]); }
    }
  }
  window.addEventListener('beforeprint', function () {
    doc.querySelectorAll('.nb-wait').forEach(function (el) { el.classList.remove('nb-wait'); });
  });

  // ---- animated shapes -----------------------------------------------------------
  var INK = '#0a0a0a', LIME = '#c6ff3d', COBALT = '#1f3fff', ORANGE = '#ff5a1f', PAPER = '#f4f1e8';
  var S = ' stroke="' + INK + '" stroke-width="3" stroke-linejoin="miter"';
  var SHAPES = [
    ['nb-a-spin', '<polygon points="50,2 60,34 92,22 70,48 98,66 64,66 62,98 44,72 18,92 26,60 2,44 34,40"' + ' fill="' + LIME + '"' + S + '/>'],
    ['nb-a-bob', '<circle cx="50" cy="50" r="44" fill="' + COBALT + '"' + S + '/><path d="M50 6a44 44 0 0 1 0 88z" fill="' + PAPER + '"' + S + '/>'],
    ['nb-a-march', '<polyline points="4,70 24,30 44,70 64,30 84,70 98,44" fill="none" stroke="' + ORANGE + '" stroke-width="9" stroke-linejoin="miter"/>'],
    ['nb-a-wobble', '<path d="M36 4h28v32h32v28H64v32H36V64H4V36h32z" fill="' + PAPER + '"' + S + '/>'],
    ['nb-a-spin-r', '<rect x="6" y="6" width="88" height="88" fill="' + COBALT + '"' + S + '/><rect x="28" y="28" width="44" height="44" fill="' + LIME + '"' + S + '/>'],
    ['nb-a-wobble', '<polygon points="50,6 96,92 4,92" fill="' + ORANGE + '"' + S + '/>'],
    ['nb-a-blink', [18, 50, 82].map(function (y) { return [18, 50, 82].map(function (x) { return '<rect x="' + (x - 9) + '" y="' + (y - 9) + '" width="18" height="18" fill="' + LIME + '"' + S + '/>'; }).join(''); }).join('')],
    ['nb-a-bob', '<path d="M4 38h52V12l40 38-40 38V62H4z" fill="' + LIME + '"' + S + '/>'],
    ['nb-a-spin', '<path d="M50 4l12 34 34 12-34 12-12 34-12-34L4 50l34-12z" fill="' + ORANGE + '"' + S + '/>'],
  ];
  var layer = null, shapes = [], shapeIO = null, shapeTimer = 0;

  function ensureLayer() {
    if (layer) return;
    layer = doc.createElement('div');
    layer.className = 'nb-deco-layer';
    layer.setAttribute('aria-hidden', 'true');
    body.appendChild(layer);
    if ('IntersectionObserver' in window) {
      shapeIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { en.target.classList.toggle('nb-off', !en.isIntersecting); });
      }, { rootMargin: '80px' });
    }
  }
  function placeShapesSoon() { clearTimeout(shapeTimer); shapeTimer = setTimeout(placeShapes, 220); }

  function placeShapes() {
    ensureLayer();
    detectScroller();
    if (bodyScroller) {                       // the layer cannot follow an inner scroller: leave shapes out
      for (var q = 0; q < shapes.length; q++) shapes[q].style.display = 'none';
      onScroll();
      return;
    }
    var vw = root.clientWidth, sy = window.scrollY;
    var size = vw >= 1400 ? 78 : vw >= 1024 ? 58 : vw >= 768 ? 44 : 34;
    var gutter = vw >= 1400 ? Math.max(14, vw * 0.018) : 8;
    var ys = [];
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      if (!b.isConnected) continue;
      var r = b.getBoundingClientRect();
      if (r.width === 0) continue;
      var y = Math.round(r.top + sy);
      if (y < 260) continue;                                   // keep clear of the header / hero top
      if (ys.every(function (o) { return Math.abs(o - y) > 520; })) ys.push(y);
    }
    ys.sort(function (a, b2) { return a - b2; });
    ys = ys.slice(0, 12);

    for (var n = 0; n < ys.length; n++) {
      var sh = shapes[n];
      if (!sh) {
        var def = SHAPES[n % SHAPES.length];
        sh = doc.createElement('span');
        sh.className = 'nb-shape nb-off';
        sh.innerHTML = '<svg viewBox="0 0 100 100" class="' + def[0] + '" focusable="false">' + def[1] + '</svg>';
        sh.style.setProperty('--k', ((n % 3) - 1) * 0.05);
        layer.appendChild(sh);
        shapes.push(sh);
        if (shapeIO) shapeIO.observe(sh); else sh.classList.remove('nb-off');
      }
      sh.__y = ys[n];
      sh.style.setProperty('--s', size + 'px');
      sh.style.top = (ys[n] - size / 2) + 'px';
      if (n % 2 === 0) { sh.style.left = 'auto'; sh.style.right = gutter + 'px'; }
      else { sh.style.right = 'auto'; sh.style.left = gutter + 'px'; }
      sh.style.display = '';
    }
    for (var x = ys.length; x < shapes.length; x++) shapes[x].style.display = 'none';
    onScroll();
  }

  // ---- scroll: progress bar + shape parallax ---------------------------------------
  var bar = doc.createElement('div');
  bar.className = 'nb-progress';
  bar.setAttribute('aria-hidden', 'true');
  body.appendChild(bar);

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var sy = scrollTop(), vh = window.innerHeight;
      var max = bodyScroller ? body.scrollHeight - body.clientHeight : root.scrollHeight - vh;
      bar.style.setProperty('--nb-progress', max > 0 ? Math.min(1, sy / max).toFixed(4) : 0);
      if (reduce) return;
      for (var i = 0; i < shapes.length; i++) {
        var s = shapes[i];
        if (s.classList.contains('nb-off')) continue;
        s.style.setProperty('--p', Math.round(sy + vh / 2 - s.__y));
      }
    });
  }
  // anything scrolled past before its observer fired (fast jumps, anchor links) is shown at once
  var sweepAt = 0;
  doc.addEventListener('scroll', function () {
    onScroll();
    var now = Date.now();
    if (now - sweepAt > 140) { sweepAt = now; sweep(); }
  }, { passive: true, capture: true });
  doc.addEventListener('scrollend', sweep, { passive: true, capture: true });

  // ---- button press burst -----------------------------------------------------------
  var BURST = [LIME, COBALT, ORANGE, PAPER];
  doc.addEventListener('pointerdown', function (ev) {
    if (reduce || !ev.target || !ev.target.closest) return;
    var btn = ev.target.closest('.nb-btn, .elementor-button, .hs-button, input[type="submit"], button[type="submit"]');
    if (!btn || !body.animate) return;
    ensureLayer();
    for (var i = 0; i < 6; i++) {
      var bit = doc.createElement('span');
      var ang = (Math.PI * 2 * i) / 6 + Math.random() * 0.6;
      var dist = 36 + Math.random() * 30;
      bit.style.cssText = 'position:absolute;width:10px;height:10px;border:2px solid ' + INK + ';background:' + BURST[i % 4] +
        ';left:' + (ev.pageX - 5) + 'px;top:' + (ev.pageY - 5) + 'px;pointer-events:none;';
      layer.appendChild(bit);
      bit.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + Math.cos(ang) * dist + 'px,' + Math.sin(ang) * dist + 'px) rotate(200deg)', opacity: 0 },
      ], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1)' }).onfinish = (function (b) { return function () { b.remove(); }; })(bit);
    }
  }, { passive: true });

  // ---- lifecycle ------------------------------------------------------------------------
  var scanTimer = 0;
  function scanSoon(ms) { clearTimeout(scanTimer); scanTimer = setTimeout(function () { scan(); sweep(); }, typeof ms === 'number' ? ms : 160); }

  detectScroller();
  scan();
  onScroll();
  // Page scripts may inject their own styles after this first pass (DOMContentLoaded / load),
  // so untagged elements are looked at again once the page has settled.
  function rescan() { seen = new WeakSet(); scanSoon(60); }
  doc.addEventListener('DOMContentLoaded', rescan);
  window.addEventListener('load', function () { rescan(); setTimeout(sweep, 2500); });
  setTimeout(rescan, 1600);

  // content revealed by interaction (menus, tabs, accordions, filters) gets tagged too
  ['click', 'keyup', 'change'].forEach(function (t) {
    doc.addEventListener(t, function () { scanSoon(140); setTimeout(scanSoon, 650); }, { passive: true });
  });
  var nav = doc.getElementById('hwnav');
  if (nav) nav.addEventListener('pointerenter', function () { scanSoon(200); }, true);

  if ('MutationObserver' in window) {
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.target === layer || (m.target.closest && m.target.closest('.nb-deco-layer'))) continue;
        if (m.addedNodes && m.addedNodes.length) { scanSoon(300); return; }
      }
    }).observe(body, { childList: true, subtree: true });
  }

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { scan(); sweep(); placeShapes(); }, 250);
  });
  if ('ResizeObserver' in window) {
    var lastH = 0;
    new ResizeObserver(function () {
      var h = root.scrollHeight;
      if (Math.abs(h - lastH) > 40) { lastH = h; placeShapesSoon(); }
    }).observe(body);
  }
})();

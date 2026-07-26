/* PELMA THERAPY — plate behaviour.
   Everything degrades: with JS off every ink pass is already down on the plate. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = !!(mq && mq.matches);

  root.classList.add('js');

  /* --------------------------------------------------------- language ---- */
  /* Greek is the source text. English is applied over it in the browser from
     assets/i18n.js. Anything inside [data-no-i18n] is never touched — that is
     how the reviews stay in the patients' own words in both modes. */
  (function () {
    var DICT = window.PELMA_I18N;
    var btn = doc.querySelector('[data-lang-toggle]');
    if (!DICT || !btn) return;

    var KEY = 'pelma-lang';
    var lang = 'el';
    try { lang = window.localStorage.getItem(KEY) === 'en' ? 'en' : 'el'; } catch (e) {}

    // Collect the text nodes once, skipping excluded subtrees, script/style,
    // and anything with no Greek in it.
    var nodes = [];
    (function walk(el) {
      for (var n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) {
          if (n.nodeValue && DICT[n.nodeValue.trim()]) nodes.push(n);
        } else if (n.nodeType === 1) {
          var tag = n.nodeName.toLowerCase();
          if (tag === 'script' || tag === 'style') continue;
          if (n.hasAttribute && n.hasAttribute('data-no-i18n')) continue;
          walk(n);
        }
      }
    })(doc.body);

    // attributes that carry user-facing prose
    var attrEls = [].filter.call(doc.querySelectorAll('[aria-label]'), function (el) {
      return !el.closest('[data-no-i18n]') && DICT[el.getAttribute('aria-label').trim()];
    });

    var originals = {
      text: nodes.map(function (n) { return n.nodeValue; }),
      attrs: attrEls.map(function (el) { return el.getAttribute('aria-label'); }),
      title: doc.title,
    };

    function apply(to) {
      var en = to === 'en';
      nodes.forEach(function (n, i) {
        var raw = originals.text[i];
        var t = raw.trim();
        if (!en) { n.nodeValue = raw; return; }
        var hit = DICT[t];
        if (hit) n.nodeValue = raw.replace(t, hit);
      });
      attrEls.forEach(function (el, i) {
        var raw = originals.attrs[i];
        el.setAttribute('aria-label', en ? (DICT[raw.trim()] || raw) : raw);
      });
      if (en && DICT[originals.title.trim()]) doc.title = DICT[originals.title.trim()];
      else doc.title = originals.title;

      root.setAttribute('lang', en ? 'en' : 'el');
      // the reviews stay Greek, so say so explicitly for screen readers
      var keep = doc.querySelectorAll('[data-no-i18n]');
      for (var k = 0; k < keep.length; k++) keep[k].setAttribute('lang', 'el');

      btn.setAttribute('aria-pressed', String(en));
      btn.setAttribute('lang', en ? 'el' : 'en');
      var lbl = btn.querySelector('[data-lang-label]');
      if (lbl) lbl.textContent = en ? 'Ελληνικά' : 'English';
      lang = to;
      try { window.localStorage.setItem(KEY, to); } catch (e) {}
    }

    btn.addEventListener('click', function () { apply(lang === 'en' ? 'el' : 'en'); });
    if (lang === 'en') apply('en'); else apply('el');
  })();

  /* ---------------------------------------------------------------- nav ---- */
  var burger = doc.querySelector('.burger');
  var nav = doc.getElementById('nav');
  if (burger && nav) {
    burger.setAttribute('aria-expanded', 'false');
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        burger.focus();
      }
    });
  }

  /* -------------------------------------------------- the layer plate ---- */
  var plate = doc.querySelector('[data-layerplate]');
  if (plate) {
    var layers = [].slice.call(plate.querySelectorAll('.lp-layer'));
    var keyList = doc.querySelector('[data-layerkey]');
    var items = keyList ? [].slice.call(keyList.querySelectorAll('li')) : [];
    var total = layers.length;
    var current = 0;

    function paint(n) {
      current = Math.max(1, Math.min(total, n));
      layers.forEach(function (l, i) {
        l.setAttribute('data-on', i < current ? '1' : '0');
      });
      items.forEach(function (li, i) {
        var state = i + 1 < current ? 'done' : (i + 1 === current ? 'active' : 'pending');
        li.setAttribute('data-state', state);
        var b = li.querySelector('button');
        if (b) b.setAttribute('aria-pressed', String(i + 1 <= current));
      });
    }

    // wire the key items as the plate's controls
    items.forEach(function (li, i) {
      var b = li.querySelector('button');
      if (b) {
        b.addEventListener('click', function () { paint(i + 1); });
        b.addEventListener('mouseenter', function () { if (i + 1 > current) paint(i + 1); });
      }
    });

    /* If the preference is turned on mid-session, drop every pass down at
       once rather than leaving the visitor on an unfinished plate. */
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', function (e) { if (e.matches) paint(total); });
    }

    if (reduce) {
      paint(total);
    } else {
      paint(1);
      // one authored moment: the passes come down in register, once, on arrival
      var fired = false;
      var run = function () {
        if (fired) return;
        fired = true;
        var step = 1;
        var tick = function () {
          step += 1;
          paint(step);
          if (step < total) setTimeout(tick, 780);
        };
        setTimeout(tick, 620);
      };
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) { run(); io.disconnect(); }
          });
        }, { threshold: 0.35 });
        io.observe(plate);
      } else {
        run();
      }
    }
  }

  /* --------------------------------------------- the conditions atlas ---- */
  /* One plate, six sites, one key. Hovering or focusing a key entry brings its
     site to full ink; every other site stays drawn but held back. */
  var atlasKey = doc.querySelector('[data-atlaskey]');
  if (atlasKey) {
    var plate = doc.querySelector('.atlasplate');
    var groups = [].slice.call(doc.querySelectorAll('.sitegroup'));
    var rows = [].slice.call(atlasKey.querySelectorAll('li'));

    /* Opacity is set inline rather than by class so the held-back state is
       unambiguous on an SVG <g>, where the cascade is easy to get wrong and
       hard to inspect. The transition still comes from CSS. */
    function show(n) {
      plate.classList.add('is-reading');
      groups.forEach(function (g) {
        var on = g.getAttribute('data-site') === String(n);
        g.classList.toggle('is-on', on);
        g.style.opacity = on ? '1' : '0.28';
      });
      rows.forEach(function (li) {
        var b = li.querySelector('button');
        var on = b && b.getAttribute('data-site') === String(n);
        if (on) { li.setAttribute('data-on', ''); } else { li.removeAttribute('data-on'); }
        if (b) b.setAttribute('aria-pressed', String(!!on));
      });
    }
    /* At rest the whole plate is at full ink — the same thing a visitor
       without JavaScript sees. */
    function clear() {
      plate.classList.remove('is-reading');
      groups.forEach(function (g) { g.classList.remove('is-on'); g.style.opacity = '1'; });
      rows.forEach(function (li) {
        li.removeAttribute('data-on');
        var b = li.querySelector('button');
        if (b) b.setAttribute('aria-pressed', 'false');
      });
    }

    rows.forEach(function (li) {
      var b = li.querySelector('button');
      if (!b) return;
      b.setAttribute('aria-pressed', 'false');
      var n = b.getAttribute('data-site');
      b.addEventListener('mouseenter', function () { show(n); });
      b.addEventListener('focus', function () { show(n); });
      b.addEventListener('click', function () { show(n); });
    });
    atlasKey.addEventListener('mouseleave', clear);
    atlasKey.addEventListener('focusout', function (e) {
      if (!atlasKey.contains(e.relatedTarget)) clear();
    });
    clear();
  }

  /* ------------------------------------------------- the review rail ----- */
  /* The sliding is native scroll-snap; this only drives the arrows and the
     position readout, and keeps them in step when the user scrolls or swipes
     the track directly. Nothing here is required to read the reviews. */
  var rail = doc.querySelector('[data-reviewrail]');
  if (rail) {
    var track = rail.querySelector('.reviewtrack');
    var prev = rail.querySelector('[data-rail="prev"]');
    var next = rail.querySelector('[data-rail="next"]');
    var fill = rail.querySelector('.railprog span');
    var count = rail.querySelector('.railcount');
    var items = [].slice.call(track.querySelectorAll('.review'));

    function step() {
      // one card plus the 1px rule between them
      return items.length > 1
        ? items[1].getBoundingClientRect().left - items[0].getBoundingClientRect().left
        : track.clientWidth;
    }

    function sync() {
      var max = track.scrollWidth - track.clientWidth;
      var i = Math.round(track.scrollLeft / step());
      i = Math.max(0, Math.min(items.length - 1, i));
      // how many cards are visible at once, so the readout is honest
      var perView = Math.max(1, Math.round(track.clientWidth / step()));
      var last = Math.max(0, items.length - perView);
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max - 2;
      if (fill) {
        var pct = last === 0 ? 100 : Math.min(100, ((Math.min(i, last) + 1) / (last + 1)) * 100);
        fill.style.width = pct + '%';
      }
      if (count) count.textContent = Math.min(i + 1, items.length) + ' / ' + items.length;
    }

    function nudge(dir) {
      track.scrollBy({ left: dir * step(), behavior: reduce ? 'auto' : 'smooth' });
    }

    if (prev) prev.addEventListener('click', function () { nudge(-1); });
    if (next) next.addEventListener('click', function () { nudge(1); });

    var raf = null;
    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = null; sync(); });
    }, { passive: true });

    // the track is focusable, so arrow keys should move it
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); nudge(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-1); }
    });

    window.addEventListener('resize', sync, { passive: true });
    sync();
  }
})();

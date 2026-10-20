(function () {
  'use strict';

  // ---------- Attribution: where did this visitor come from? ----------
  var params = new URLSearchParams(location.search);
  var source = params.get('src') || params.get('utm_source') || params.get('ref') || '';
  var campaign = params.get('utm_campaign') || '';
  try {
    if (source) sessionStorage.setItem('lw_src', source);
    else source = sessionStorage.getItem('lw_src') || '';
    if (campaign) sessionStorage.setItem('lw_campaign', campaign);
    else campaign = sessionStorage.getItem('lw_campaign') || '';
  } catch (e) {}

  var visitorId = '';
  try {
    visitorId = localStorage.getItem('lw_vid') || '';
    if (!visitorId) {
      visitorId = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now());
      localStorage.setItem('lw_vid', visitorId);
    }
  } catch (e) {}

  // ---------- Who's visiting: us, or a bot? ----------
  // Visit with ?internal=1 once (or open /admin) and this browser is marked as "us" from then on.
  // ?internal=0 clears it.
  var internal = false;
  try {
    var ip = params.get('internal');
    if (ip === '1') localStorage.setItem('lw_internal', '1');
    if (ip === '0') localStorage.removeItem('lw_internal');
    internal = localStorage.getItem('lw_internal') === '1';
  } catch (e) {}

  // Signs of an automated browser. Sent along so the server can flag the visit.
  var automation = '';
  try {
    if (navigator.webdriver) automation = 'webdriver';
    else if (/HeadlessChrome|PhantomJS|Puppeteer|Playwright/i.test(navigator.userAgent)) automation = 'headless-ua';
    else if (!navigator.languages || navigator.languages.length === 0) automation = 'no-languages';
    else if (window.outerWidth === 0 || window.outerHeight === 0) automation = 'no-window';
  } catch (e) {}

  // ---------- Lightweight event tracking (stored in our own D1 database) ----------
  function track(name, detail) {
    var body = JSON.stringify({
      name: name,
      detail: detail || '',
      source: source,
      campaign: campaign,
      referrer: document.referrer || '',
      path: location.pathname,
      vid: visitorId,
      internal: internal ? 1 : 0,
      automation: automation
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/event', new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/event', { method: 'POST', body: body, headers: { 'Content-Type': 'application/json' }, keepalive: true });
      }
    } catch (e) {}
  }
  track('page_view');

  // A visitor only counts as a real person once they interact: scroll, tap, click, type or move the mouse.
  // Scanners that load the page and leave never send this.
  var engaged = false;
  var loadedAt = Date.now();
  function markEngaged(e) {
    if (engaged) return;
    if (e.type === 'scroll' && window.scrollY < 40) return;
    if (e.type === 'pointermove' && Date.now() - loadedAt < 400) return;
    engaged = true;
    ['scroll', 'pointerdown', 'pointermove', 'keydown', 'touchstart'].forEach(function (t) {
      window.removeEventListener(t, markEngaged, true);
    });
    track('engaged', e.type + ':' + Math.round((Date.now() - loadedAt) / 1000) + 's');
  }
  ['scroll', 'pointerdown', 'pointermove', 'keydown', 'touchstart'].forEach(function (t) {
    window.addEventListener(t, markEngaged, { capture: true, passive: true });
  });

  // Scroll depth + which sections people actually reach
  var seen = {};
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var id = en.target.id;
        if (en.isIntersecting && id && !seen[id]) { seen[id] = 1; track('section_view', id); }
      });
    }, { threshold: 0.35 });
    ['how', 'history', 'faq', 'signup'].forEach(function (id) {
      var el = document.getElementById(id); if (el) io.observe(el);
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-track]');
    if (t) track('click', t.getAttribute('data-track'));
  });
  document.querySelectorAll('details[data-faq]').forEach(function (d) {
    d.addEventListener('toggle', function () { if (d.open) track('faq_open', d.getAttribute('data-faq')); });
  });

  // ---------- Hero: title vs description example ----------
  var hero = {
    title: {
      name: 'So Many Books So Little Time Mug', field: 'title',
      old: 'So Many Books So Little Time Mug, Funny Book Lover Coffee Cup, Bookish Gift, Librarian Mug',
      pre: 'Book Lover Mug, 11oz Ceramic Coffee Cup, ', mark: 'Gift for Readers', post: ', Bookish Gift for Her',
      after: '2', unit: 'orders', caption: 'One new title. Same listing. More orders.'
    },
    description: {
      name: 'Just One More Chapter Shirt', field: 'description',
      old: 'Soft cotton tee with a fun bookish design. Great for anyone who loves to read!',
      pre: 'A soft, unisex cotton tee for book club nights and library days. An easy ', mark: 'gift for readers, teachers and librarians', post: '. Sizes S–3XL.',
      after: '1', unit: 'order', caption: 'One new description. Same listing. A first order.'
    }
  };
  function setText(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
  function showHero(key) {
    var h = hero[key];
    document.querySelectorAll('[data-hero]').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-hero') === key ? 'true' : 'false');
    });
    setText('hero-name', h.name);
    setText('hero-old', h.old);
    document.querySelectorAll('.hero-field').forEach(function (s) { s.textContent = h.field; });
    var nw = document.getElementById('hero-new');
    nw.textContent = '';
    nw.appendChild(document.createTextNode(h.pre));
    var m = document.createElement('mark'); m.textContent = h.mark; nw.appendChild(m);
    nw.appendChild(document.createTextNode(h.post));
    setText('hero-after', h.after);
    setText('hero-unit', h.unit);
    setText('hero-caption', h.caption);
  }
  document.querySelectorAll('[data-hero]').forEach(function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-hero'); showHero(k); track('hero_toggle', k);
    });
  });

  // ---------- Version history demo ----------
  var versions = [
    { id: 'v3', tag: 'Current', kind: 'Title', date: 'Oct 5', result: 'Better', badge: 'badge-good', current: true,
      removed: 'So Many Books So Little Time Mug, Funny Book Lover Coffee Cup, Bookish Gift, Librarian Mug',
      added: 'Book Lover Mug, 11oz Ceramic Coffee Cup, Gift for Readers, Bookish Gift for Her',
      stats: [['Views', '37', '48'], ['Orders', '0', '2'], ['Revenue', '$0', '$48']],
      verdict: 'More orders from about the same traffic. This version is the one live on Etsy.' },
    { id: 'v2', tag: 'Kept for now', kind: 'Thumbnail photo', date: 'Sep 18', result: 'Inconclusive', badge: 'badge-mid',
      removed: 'First photo (thumbnail): lifestyle shot on a bookshelf',
      added: 'First photo (thumbnail): close-up of the printed design',
      stats: [['Views', '30', '31'], ['Orders', '0', '0'], ['Revenue', '$0', '$0']],
      verdict: 'Too close to call, so the next idea, a new title, was tested on top of it.' },
    { id: 'v1', tag: 'Original', kind: 'Original listing', date: 'Jun 2', result: 'Baseline', badge: 'badge-base',
      verdict: 'The listing exactly as you first published it. You can always go back to it.' }
  ];
  var selected = 'v3', restored = null;
  var list = document.getElementById('vh-list');
  var detail = document.getElementById('vh-detail');

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderVH() {
    list.textContent = '';
    versions.forEach(function (v) {
      var b = el('button', 'vh-item');
      b.type = 'button';
      b.setAttribute('aria-pressed', v.id === selected ? 'true' : 'false');
      var top = el('span', 'vh-item-top');
      top.appendChild(el('span', '', v.id + ' · ' + v.kind));
      top.appendChild(el('span', 'badge ' + v.badge, v.result));
      b.appendChild(top);
      b.appendChild(el('span', 'vh-item-sub', v.date + ' · ' + v.tag));
      b.addEventListener('click', function () { selected = v.id; restored = null; renderVH(); track('version_click', v.id); });
      list.appendChild(b);
    });

    var v = versions.filter(function (x) { return x.id === selected; })[0];
    detail.textContent = '';
    var title = el('div', 'vh-title');
    title.appendChild(el('h3', '', v.id + ': ' + v.kind));
    title.appendChild(el('span', '', 'Changed ' + v.date));
    detail.appendChild(title);

    if (v.removed) {
      var diff = el('div', 'vh-diff');
      var o = el('div', 'diff-old'); var os = el('span', 'sign', '−'); os.setAttribute('aria-label', 'Removed'); o.appendChild(os); o.appendChild(el('span', '', v.removed));
      var n = el('div', 'diff-new'); var ns = el('span', 'sign', '+'); ns.setAttribute('aria-label', 'Added'); n.appendChild(ns); n.appendChild(el('span', '', v.added));
      o.style.textDecoration = 'none';
      o.lastChild.style.textDecoration = 'line-through';
      diff.appendChild(o); diff.appendChild(n);
      detail.appendChild(diff);

      var wrap = el('div', 'table-wrap');
      var t = el('table');
      var thead = el('thead'); var hr = el('tr');
      ['', '14 days before', '14 days with change'].forEach(function (h) { hr.appendChild(el('th', '', h)); });
      thead.appendChild(hr); t.appendChild(thead);
      var tb = el('tbody');
      v.stats.forEach(function (s) {
        var r = el('tr'); s.forEach(function (c) { r.appendChild(el('td', '', c)); }); tb.appendChild(r);
      });
      t.appendChild(tb); wrap.appendChild(t); detail.appendChild(wrap);
    }

    detail.appendChild(el('p', 'vh-verdict', v.verdict));

    var actions = el('div', 'vh-actions');
    if (v.current) {
      actions.appendChild(el('span', 'live', '● Live on Etsy now'));
    } else if (restored === v.id) {
      var msg = el('span', 'restored', '✓ ' + v.id + ' restored. It’s back on Etsy.');
      msg.setAttribute('role', 'status');
      actions.appendChild(msg);
    } else {
      var rb = el('button', 'restore');
      rb.type = 'button';
      rb.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 7a6 6 0 1 1 0 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3 3v4h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      rb.appendChild(document.createTextNode('Restore ' + v.id));
      rb.addEventListener('click', function () { restored = v.id; renderVH(); track('restore_click', v.id); });
      actions.appendChild(rb);
    }
    detail.appendChild(actions);
  }
  if (list && detail) renderVH();

  // ---------- Forms ----------
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  document.querySelectorAll('form[data-form]').forEach(function (form) {
    var kind = form.getAttribute('data-form');
    var msg = form.querySelector('.form-msg');
    var btn = form.querySelector('button[type=submit]');
    var startedAt = Date.now();

    function say(text, ok) {
      msg.textContent = text;
      msg.className = 'form-msg ' + (ok ? 'ok' : 'err');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = String(v).trim(); });

      if (!EMAIL_RE.test(data.email || '')) { say('Please enter a valid email address.', false); form.querySelector('input[type=email]').focus(); return; }
      if (kind === 'contact' && !data.message) { say('Please write a short message.', false); form.querySelector('textarea').focus(); return; }

      data.source = source;
      data.campaign = campaign;
      data.referrer = document.referrer || '';
      data.location = form.getAttribute('data-location') || '';
      data.vid = visitorId;
      data.internal = internal ? 1 : 0;
      data.automation = automation;
      data.elapsed = Date.now() - startedAt;

      btn.disabled = true;
      var label = btn.textContent;
      btn.textContent = 'Sending…';

      fetch(kind === 'contact' ? '/api/contact' : '/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; });
      }).then(function (res) {
        if (!res.ok) throw new Error(res.j.error || 'Something went wrong.');
        form.classList.add('is-done');
        say(kind === 'contact'
          ? 'Thanks! We’ll get back to you soon.'
          : (res.j.already ? 'You’re already on the list. We’ll be in touch.' : 'You’re on the list. We’ll email you when your spot opens.'), true);
      }).catch(function (err) {
        say((err && err.message) || 'Something went wrong. Please try again.', false);
        btn.disabled = false;
        btn.textContent = label;
      });
    });
  });
})();

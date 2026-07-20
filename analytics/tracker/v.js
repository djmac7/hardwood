/* Vantage — cookieless analytics tracker for ad-monetized content sites.
 * ~1KB gzipped, no cookies, no consent banner required.
 *
 * Embed:
 *   <script defer data-site="dunkwise"
 *           data-api="https://vantage.<you>.workers.dev"
 *           src="https://vantage.<you>.workers.dev/v.js"></script>
 *
 * Sends two beacons per pageview:
 *   1. `pv`  — fired immediately on load (so realtime + bounces are counted)
 *   2. `end` — fired on pagehide with engaged time, scroll depth, and Core Web Vitals
 *
 * No persistent identifier is stored on the device. Unique visitors are derived
 * server-side from a daily-rotating hash of IP+UA+site, which resets every day —
 * so nothing here follows a user across days or sites.
 */
(function () {
  var s = document.currentScript;
  if (!s) return;
  var SITE = s.getAttribute('data-site');
  var API = (s.getAttribute('data-api') || '').replace(/\/$/, '');
  if (!SITE || !API) return;

  // Respect Do Not Track. Ad-site owners can drop this line if they prefer.
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  var nav = navigator;
  var loc = location;
  var send = function (type, extra) {
    var body = Object.assign(
      { t: type, s: SITE, u: loc.pathname, h: loc.hostname },
      extra || {}
    );
    var data = JSON.stringify(body);
    // sendBeacon survives page unload; fall back to keepalive fetch.
    if (nav.sendBeacon) {
      nav.sendBeacon(API + '/e', data);
    } else {
      fetch(API + '/e', { method: 'POST', body: data, keepalive: true, mode: 'no-cors' });
    }
  };

  /* ---- session flag (sessionStorage, cleared when the tab closes) ---- */
  var newSession = 0;
  try {
    if (!sessionStorage.getItem('_vg')) {
      sessionStorage.setItem('_vg', '1');
      newSession = 1;
    }
  } catch (e) {}

  /* ---- referrer / campaign (host only — no full URLs, no PII) ---- */
  var ref = '';
  try {
    ref = document.referrer ? new URL(document.referrer).hostname : '';
  } catch (e) {}
  if (ref === loc.hostname) ref = ''; // internal navigation
  var qs = new URLSearchParams(loc.search);
  var utm = qs.get('utm_source') || qs.get('ref') || '';

  /* ---- adblock detection: bait element + a request to an ad-shaped path ---- */
  var adblock = 0;
  var bait = document.createElement('div');
  bait.className = 'ad-placement adsbox ad-banner pub_300x250';
  bait.style.cssText = 'position:absolute;left:-9999px;top:-9999px;height:12px;width:12px';
  document.body.appendChild(bait);
  setTimeout(function () {
    if (bait.offsetHeight === 0 || bait.clientHeight === 0 ||
        getComputedStyle(bait).display === 'none') adblock = 1;
    bait.remove();
  }, 120);

  /* ---- first beacon: pageview ---- */
  send('pv', {
    r: ref,
    c: utm,
    w: innerWidth,
    ns: newSession,
    dpr: (window.devicePixelRatio || 1)
  });

  /* ---- engaged time: count only while the tab is visible ---- */
  var engaged = 0, mark = performance.now(), visible = !document.hidden;
  var tick = function () {
    if (visible) { engaged += performance.now() - mark; }
    mark = performance.now();
  };
  document.addEventListener('visibilitychange', function () {
    tick(); visible = !document.hidden;
  });

  /* ---- scroll depth (max % of page reached) ---- */
  var depth = 0;
  addEventListener('scroll', function () {
    var h = document.documentElement;
    var d = (h.scrollTop + innerHeight) / (h.scrollHeight || 1);
    if (d > depth) depth = d > 1 ? 1 : d;
  }, { passive: true });

  /* ---- Core Web Vitals (compact; no external library) ---- */
  var lcp = 0, cls = 0, inp = 0;
  var obs = function (type, cb, opts) {
    try {
      var po = new PerformanceObserver(cb);
      po.observe(Object.assign({ type: type, buffered: true }, opts || {}));
      return po;
    } catch (e) {}
  };
  obs('largest-contentful-paint', function (l) {
    var e = l.getEntries(); lcp = e[e.length - 1].startTime;
  });
  obs('layout-shift', function (l) {
    l.getEntries().forEach(function (e) { if (!e.hadRecentInput) cls += e.value; });
  });
  // INP approximation: worst interaction latency observed.
  obs('event', function (l) {
    l.getEntries().forEach(function (e) { if (e.duration > inp) inp = e.duration; });
  }, { durationThreshold: 40 });

  /* ---- final beacon on pagehide ---- */
  var sent = false;
  var finish = function () {
    if (sent) return; sent = true;
    tick();
    send('end', {
      e: Math.round(engaged),                 // engaged ms
      d: Math.round(depth * 100),             // scroll depth %
      ab: adblock,
      lcp: Math.round(lcp),
      cls: Math.round(cls * 1000) / 1000,
      inp: Math.round(inp)
    });
  };
  addEventListener('pagehide', finish);
  addEventListener('visibilitychange', function () {
    if (document.hidden) finish();
  });
})();

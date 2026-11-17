/*
 * poi-core.js - shared code for finding points of interest along a track (OpenStreetMap, Overpass API)
 *
 * Used by poi-search.js (GPX map) and elevation-poi.js (elevation page). Load it BEFORE them.
 *
 * What it does
 *   - cuts a track into pieces and asks the Overpass API for places in a corridor around it
 *     (the "around" filter with a polyline), for the kinds of places in CATEGORIES;
 *   - copes with an unstable Overpass server: it tries several servers, tries again when a server is busy or
 *     times out, and does not trust an empty answer until a second answer says the same;
 *   - filters and thins out the results, and returns plain objects with their place along the track.
 *
 * The kinds of places and their OpenStreetMap tags follow the overpass.js of https://www.tobis-page.de/pois/.
 * Data: (c) OpenStreetMap contributors (ODbL). Please use the Overpass servers sparingly.
 */
(function () {
  'use strict';

  const OPTIONS = {
    // Servers are tried in this order (worldwide instances only; a regional or out-of-date mirror would silently
    // return too little).
    endpoints: [
      'https://overpass-api.de/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
    ],
    maxChunkKm: 40,             // one request covers at most this much track ...
    maxVertices: 250,           // ... and at most this many corner points
    pauseMs: 1000,              // pause between two requests
    confirmAbove: 12,           // front ends ask before sending more requests than this
    attempts: 4,                // tries per piece of track (alternating between the servers)
    retryMs: 2000,              // wait before a new try (x the number of the try)
    requestTimeoutMs: 100000,   // give up on a request after this long
    cacheMs: 15 * 60 * 1000     // answers with results are kept this long (a repeated search costs nothing)
  };

  /* ---------- Kinds of places ---------- */
  // q: Overpass statement (r = the "(around:...)" filter); match/ok: checks on the returned tags;
  // thin: places closer together than this (m) are thinned out; score: which one to keep;
  // sym/color: symbol and pin colour on the GPX map; hex/glyph: colour and sign on the elevation page;
  // cpType: type of a FIT course point (values from the FIT SDK profile)
  const NOT_PUBLIC = '[access!~"^(private|no|customers|permissive)$"]';
  const CATEGORIES = [
    { key: 'water', label: 'Drinking water', sym: 'Drinking Water', color: 'blue', hex: '#1a73e8', glyph: '\u{1F4A7}', cpType: 3, thin: 150, kind: 'amenity',
      q: r => `node[amenity~"^(drinking_water|water_point)$"]${NOT_PUBLIC}${r};`,
      match: t => t.amenity === 'drinking_water' || t.amenity === 'water_point',
      ok: t => !(t.drinking_water && t.drinking_water !== 'yes'),
      name: () => 'Water', omit: ['drinking_water'] },
    { key: 'gas', label: '24h gas stations with shop', sym: 'Gas Station', color: 'darkred', hex: '#8b1a1a', glyph: '\u26FD', cpType: 31, thin: 0, kind: 'shop',
      q: r => `nw[amenity=fuel][opening_hours="24/7"][shop!=no]${r};`,
      match: t => t.amenity === 'fuel',
      ok: t => {
        // typical stations that are open 24/7 but have nothing to buy are dropped
        if (t.automated === 'yes') return !!(t.shop || t.car_wash);
        if (t['fuel:cng'] === 'yes' || t['fuel:lpg'] === 'yes') {
          if (t['fuel:diesel'] && t['fuel:diesel'] !== 'no') return true;
          return !!(t.brand || t.shop || t.compressed_air || t.car_wash);
        }
        return t.name !== 'Tankpool24';
      },
      name: t => (t.brand || '24h gas') + ((t.automated === 'yes' || (t.self_service === 'yes' && !t.shop)) ? '?' : ''), omit: ['operator'] },
    { key: 'toilets', label: 'Toilets', sym: 'Restroom', color: 'purple', hex: '#7b1fa2', glyph: '\u{1F6BB}', cpType: 39, thin: 100, kind: 'amenity',
      q: r => `node[amenity=toilets]${NOT_PUBLIC}[!fixme]${r};`,
      match: t => t.amenity === 'toilets', ok: () => true, name: () => 'WC' },
    { key: 'shelter', label: 'Shelters', sym: 'Picnic Area', color: 'green', hex: '#2e7d32', glyph: '\u2602', cpType: 36, thin: 200, kind: 'amenity',
      q: r => `node[amenity=shelter][access!~"^(no|private)$"][shelter_type!~"^(changing_rooms|field_shelter)$"][smoking!=dedicated][!fixme]${r};`,
      match: t => t.amenity === 'shelter', ok: () => true, name: t => t.shelter_type || 'Shelter' },
    { key: 'shops', label: 'Shops (supermarket, convenience, bakery)', sym: 'Shopping Center', color: 'orange', hex: '#ef6c00', glyph: '\u{1F6D2}', cpType: 48, thin: 500, kind: 'shop',
      q: r => `nw[shop~"^(convenience|supermarket|bakery)$"]${r};`,
      match: t => /^(convenience|supermarket|bakery)$/.test(t.shop || ''), ok: () => true,
      score: t => t.opening_hours === '24/7' ? 10 : t.shop === 'supermarket' ? 3 : t.shop === 'convenience' ? 2 : 1,
      name: t => (t.opening_hours === '24/7' ? '24h ' : '') + (t.shop === 'convenience' ? 'Convenience store' : t.shop === 'supermarket' ? 'Supermarket' : 'Bakery') },
    { key: 'food', label: 'Food (restaurant, caf\u00e9, fast food)', sym: 'Restaurant', color: 'red', hex: '#d93025', glyph: '\u{1F374}', cpType: 4, thin: 1000, kind: 'amenity',
      q: r => `node[amenity~"^(biergarten|cafe|fast_food|food_court|restaurant)$"]${r};`,
      match: t => /^(biergarten|cafe|fast_food|food_court|restaurant)$/.test(t.amenity || ''), ok: () => true,
      score: t => t.opening_hours === '24/7' ? 10 : t.amenity === 'fast_food' ? 2 : 1,
      name: t => (t.opening_hours === '24/7' ? '24h ' : '') + ({ biergarten: 'Beer garden', cafe: 'Caf\u00e9', fast_food: 'Fast food', food_court: 'Food court', restaurant: 'Restaurant' }[t.amenity] || 'Food') },
    { key: 'repair', label: 'Bicycle shops', sym: 'Car', color: 'cadetblue', hex: '#00838f', glyph: '\u{1F527}', cpType: 31, thin: 100, kind: 'shop',
      q: r => `node[shop=bicycle]${r};`, match: t => t.shop === 'bicycle', ok: () => true, name: () => 'Bike shop' },
    { key: 'camping', label: 'Camp sites', sym: 'Campground', color: 'darkgreen', hex: '#1b5e20', glyph: '\u26FA', cpType: 27, thin: 0, kind: 'tourism',
      q: r => `nw[tourism=camp_site][tents!=no][group_only!=yes][nudism!=yes][nudism!=designated]${r};`,
      match: t => t.tourism === 'camp_site', ok: () => true, name: () => 'Camping' }
  ];
  const DEFAULT_ON = { water: true, toilets: true, shops: true, food: false, gas: false, shelter: false, repair: false, camping: false };

  /* ---------- Geometry ---------- */
  const rad = Math.PI / 180;
  function haversine(a, b) {                      // a, b: [lat, lon] -> metres
    const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
    return 12742000 * Math.asin(Math.sqrt(s));
  }

  // Douglas-Peucker: keeps the shape of the line within tolM metres
  function simplify(pts, tolM) {
    const n = pts.length;
    if (n < 3) return pts.slice();
    const kx = Math.cos(pts[0][0] * rad) * 111320, ky = 110540;
    const X = pts.map(p => p[1] * kx), Y = pts.map(p => p[0] * ky);
    const keep = new Uint8Array(n);
    keep[0] = keep[n - 1] = 1;
    const stack = [[0, n - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      const dx = X[b] - X[a], dy = Y[b] - Y[a], len2 = dx * dx + dy * dy;
      let maxD = 0, idx = -1;
      for (let i = a + 1; i < b; i++) {
        let t = len2 ? ((X[i] - X[a]) * dx + (Y[i] - Y[a]) * dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(X[i] - (X[a] + t * dx), Y[i] - (Y[a] + t * dy));
        if (d > maxD) { maxD = d; idx = i; }
      }
      if (maxD > tolM && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }

  // cuts every simplified line into pieces of limited length and size (pieces share their end point)
  function buildChunks(lines, radiusM) {
    const tol = Math.max(25, radiusM / 10);
    const chunks = [];
    lines.forEach(line => {
      const s = simplify(line, tol);
      if (!s.length) return;
      let cur = [s[0]], len = 0;
      for (let i = 1; i < s.length; i++) {
        cur.push(s[i]);
        len += haversine(s[i - 1], s[i]);
        if (len >= OPTIONS.maxChunkKm * 1000 || cur.length >= OPTIONS.maxVertices) {
          chunks.push(cur);
          cur = [s[i]]; len = 0;
        }
      }
      if (cur.length > 1 || !chunks.length) chunks.push(cur);
    });
    return chunks;
  }

  // A route for measuring: every line cut into short pieces, with the distance along the track
  function makeRoute(lines) {
    const segs = [];
    let along = 0;
    lines.forEach(line => {
      if (line.length < 2) return;
      const tot = line.reduce((s, p, i) => i ? s + haversine(line[i - 1], p) : 0, 0);
      const step = Math.max(15, tot / 4000);               // at most about 4000 pieces per line
      let last = line[0], acc = 0, lastAlong = along;
      for (let i = 1; i < line.length; i++) {
        acc += haversine(line[i - 1], line[i]);
        if (acc >= step || i === line.length - 1) {
          segs.push({ a: last, b: line[i], from: lastAlong, len: acc });
          lastAlong += acc; acc = 0; last = line[i];
        }
      }
      along = lastAlong;
    });
    return { segs: segs, length: along };
  }

  // how far (m) a place is from the route, and where along the route (m) its nearest point is
  function locate(route, lat, lon) {
    const kx = Math.cos(lat * rad) * 111320, ky = 110540;
    let best = Infinity, bestAlong = 0;
    for (const s of route.segs) {
      const ax = (s.a[1] - lon) * kx, ay = (s.a[0] - lat) * ky, bx = (s.b[1] - lon) * kx, by = (s.b[0] - lat) * ky;
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
      let t = len2 ? -(ax * dx + ay * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < best) { best = d; bestAlong = s.from + t * s.len; }
    }
    return { off: best, along: bestAlong };
  }

  /* ---------- Overpass ---------- */
  function aroundFilter(radiusM, chunk) {
    return '(around:' + radiusM + ',' + chunk.map(p => p[0].toFixed(5) + ',' + p[1].toFixed(5)).join(',') + ')';
  }

  function buildQuery(cats, radiusM, chunk) {
    const r = aroundFilter(radiusM, chunk);
    return '[out:json][timeout:90];\n(\n' + cats.map(c => '  ' + c.q(r)).join('\n') + '\n);\nout center;';
  }

  const sleep = ms => new Promise(res => setTimeout(res, ms));
  const hostOf = url => { try { return new URL(url).host; } catch (e) { return url; } };
  const retryable = msg => { const e = new Error(msg); e.retry = true; return e; };

  // One request to one server. Returns the parsed answer; throws an error with .retry = true when another try
  // (or another server) may help.
  async function request(url, query, signal) {
    const ctl = new AbortController();
    let timedOut = false;
    const onAbort = () => ctl.abort();
    if (signal) {
      if (signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      signal.addEventListener('abort', onAbort);
    }
    // the timeout also ends a request that never settles (so a stuck connection cannot block the search)
    let rejectTimeout;
    const timeoutPromise = new Promise((_, rej) => { rejectTimeout = rej; });
    timeoutPromise.catch(() => {});
    const timer = setTimeout(() => { timedOut = true; ctl.abort(); rejectTimeout(new Error('timed out')); }, OPTIONS.requestTimeoutMs);
    const guard = p => Promise.race([p, timeoutPromise]);
    try {
      let res;
      try {
        const sent = fetch(url, {
          method: 'POST', signal: ctl.signal,
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ data: query })
        });
        sent.catch(() => {});
        res = await guard(sent);
      } catch (e) {
        if (signal && signal.aborted) throw e;
        throw retryable(timedOut ? 'timed out' : 'could not connect (' + e.message + ')');
      }
      if ([429, 502, 503, 504].includes(res.status)) throw retryable('busy (' + res.status + ')');
      if (res.status === 400) {
        const t = await res.text().catch(() => '');
        throw new Error('The Overpass server rejected the query: ' + t.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200));
      }
      if (!res.ok) throw retryable('error ' + res.status);
      let text;
      try { text = await guard(res.text()); }
      catch (e) {
        if (signal && signal.aborted) throw e;
        throw retryable(timedOut ? 'timed out' : 'unreadable answer');
      }
      if (text.trim().charAt(0) === '<') throw retryable('unexpected answer (server overloaded?)');
      let data;
      try { data = JSON.parse(text); } catch (e) { throw retryable('unreadable answer'); }
      const n = (data.elements || []).length;
      if (data.remark && /runtime error|timed out|out of memory|rate_limited/i.test(data.remark)) {
        if (!n) throw retryable(String(data.remark).slice(0, 120));
        data.partial = true;                               // results, but the server stopped early
      }
      return data;
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }

  const cache = new Map();          // query -> { t, elements }
  function clearCache() { cache.clear(); }

  // The elements for one piece of track. An answer with results is used at once. An empty answer is only believed
  // when a second answer (from the other server) is empty too: an unstable server sometimes returns nothing.
  async function fetchChunk(query, signal, stats) {
    const hit = cache.get(query);
    if (hit && Date.now() - hit.t < OPTIONS.cacheMs) { stats.cached++; return hit.elements; }

    const servers = OPTIONS.endpoints;
    let empties = 0, lastError = null;
    for (let attempt = 0; attempt < OPTIONS.attempts; attempt++) {
      const url = servers[attempt % servers.length], host = hostOf(url);
      if (attempt) await sleep(OPTIONS.retryMs * attempt);
      try {
        const data = await request(url, query, signal);
        stats.requests++;
        stats.servers[host] = (stats.servers[host] || 0) + 1;
        if (data.partial) stats.partial++;
        const els = data.elements || [];
        if (els.length) { cache.set(query, { t: Date.now(), elements: els }); return els; }
        empties++;
        if (empties >= Math.min(2, servers.length)) { stats.empty++; return []; }
      } catch (e) {
        if (e.name === 'AbortError' || !e.retry) throw e;
        lastError = e;
        stats.retries++;
        stats.notes.push(host + ': ' + e.message);
      }
    }
    if (empties) { stats.empty++; stats.unverified++; return []; }       // one empty answer, the others failed
    throw new Error('Overpass did not answer: ' + (lastError ? lastError.message : 'unknown error') +
      '. Try again in a minute.');
  }

  /* ---------- Processing the results ---------- */
  const HOURS_CLOSED = t => t.opening_hours === 'closed' || t.opening_hours === 'off';
  const isClosed = s => /abandoned|closed/i.test(s || '');
  function stillOpen(t, kind) {                      // drops places that are tagged as closed / disused
    if (t.abandoned || t['abandoned:' + kind] || t.disused || t['disused:' + kind]) return false;
    if (isClosed(t.description) || isClosed(t.name)) return false;
    return !HOURS_CLOSED(t);
  }

  const DETAIL_KEYS = [['opening_hours', 'Open'], ['phone', 'Phone'], ['contact:phone', 'Phone'], ['website', 'Web'], ['contact:website', 'Web'],
    ['fee', 'Fee'], ['access', 'Access'], ['seasonal', 'Seasonal'], ['cuisine', 'Cuisine'], ['brand', 'Brand'], ['operator', 'Operator'],
    ['wheelchair', 'Wheelchair'], ['description', 'Note'], ['note', 'Note']];

  function describe(cat, t, km, offM) {
    const lines = ['km ' + km.toFixed(1) + ' \u00b7 ' + Math.round(offM / 10) * 10 + ' m from the track'];
    const used = {};
    DETAIL_KEYS.forEach(([k, label]) => {
      if (t[k] && !(cat.omit || []).includes(k) && !used[label]) { lines.push(label + ': ' + t[k]); used[label] = 1; }
    });
    return lines.join('\n');
  }

  // keeps the best place in every group of places that lie closer together than cat.thin metres
  function thinOut(items, cat) {
    if (!cat.thin) return items;
    const score = cat.score || (() => 0);
    const kept = [];
    items.slice().sort((a, b) => score(b.tags) - score(a.tags) || a.along - b.along).forEach(it => {
      if (kept.every(k => haversine([k.lat, k.lon], [it.lat, it.lon]) >= cat.thin)) kept.push(it);
    });
    return kept;
  }

  // elements -> places: { lat, lon, name, desc, sym, color, key, cat, tags, along (m), off (m), id }
  function process(elements, cats, route, radiusM, thin) {
    const byCat = {};
    elements.forEach(e => {
      const tags = e.tags || {};
      const lat = e.center ? e.center.lat : e.lat, lon = e.center ? e.center.lon : e.lon;
      if (typeof lat !== 'number' || typeof lon !== 'number') return;
      const cat = cats.find(c => c.match(tags));
      if (!cat || !stillOpen(tags, cat.kind) || !cat.ok(tags)) return;
      const loc = locate(route, lat, lon);
      if (loc.off > radiusM * 1.1) return;                          // outside the corridor (simplified line)
      (byCat[cat.key] = byCat[cat.key] || []).push({ id: e.type + '/' + e.id, tags: tags, lat: lat, lon: lon, off: loc.off, along: loc.along, cat: cat });
    });
    let out = [];
    cats.forEach(cat => { out = out.concat(thin ? thinOut(byCat[cat.key] || [], cat) : (byCat[cat.key] || [])); });
    out.sort((a, b) => a.along - b.along);
    return out.map(it => {
      const nm = it.cat.name(it.tags), extra = it.tags.name && it.tags.name !== nm ? it.tags.name : '';
      return {
        id: it.id, lat: it.lat, lon: it.lon, along: it.along, off: it.off, tags: it.tags, key: it.cat.key, cat: it.cat,
        label: nm, title: it.tags.name || nm,
        name: nm + (extra ? ' \u2013 ' + extra : ''),
        desc: describe(it.cat, it.tags, it.along / 1000, it.off),
        sym: it.cat.sym, color: it.cat.color
      };
    });
  }

  /* ---------- The whole search ---------- */
  // params: { lines: [[[lat, lon], ...], ...], cats, radiusM, thin, signal, onProgress(info) }
  // returns { pois, stats, route }
  async function search(params) {
    const { lines, cats, radiusM, thin, signal, onProgress } = params;
    const chunks = buildChunks(lines, radiusM);
    const stats = { chunks: chunks.length, requests: 0, cached: 0, empty: 0, unverified: 0, partial: 0, retries: 0, servers: {}, notes: [] };
    const found = new Map();
    for (let i = 0; i < chunks.length; i++) {
      if (onProgress) onProgress({ part: i + 1, parts: chunks.length, stats: stats });
      const before = stats.cached;
      const els = await fetchChunk(buildQuery(cats, radiusM, chunks[i]), signal, stats);
      els.forEach(e => found.set(e.type + '/' + e.id, e));
      if (i < chunks.length - 1 && stats.cached === before) await sleep(OPTIONS.pauseMs);   // no pause after a cached answer
    }
    const route = makeRoute(lines);
    return { pois: process(Array.from(found.values()), cats, route, radiusM, thin), stats: stats, route: route };
  }

  // a short description of what the servers did (for the status line)
  function summary(stats) {
    const s = Object.keys(stats.servers).map(h => h + ' \u00d7' + stats.servers[h]);
    if (stats.cached) s.push('earlier answers \u00d7' + stats.cached);
    const extra = [];
    if (stats.retries) extra.push(stats.retries + ' retr' + (stats.retries === 1 ? 'y' : 'ies'));
    if (stats.empty) extra.push(stats.empty + ' empty answer' + (stats.empty === 1 ? '' : 's'));
    if (stats.partial) extra.push(stats.partial + ' partial');
    return (s.join(', ') || 'no answers') + (extra.length ? ' (' + extra.join(', ') + ')' : '');
  }

  window.PoiCore = {
    options: OPTIONS, CATEGORIES: CATEGORIES, DEFAULT_ON: DEFAULT_ON,
    haversine, simplify, buildChunks, makeRoute, locate, buildQuery, process, search, summary, clearCache
  };
})();

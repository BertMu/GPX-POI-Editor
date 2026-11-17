/*
 * poi-search.js - find points of interest along a track for the GPX map (OpenStreetMap, Overpass API)
 *
 * Load it AFTER gpx-map.js and poi-core.js:
 *   <script src="gpx-map.js"></script>
 *   <script src="poi-core.js"></script>
 *   <script src="poi-search.js"></script>
 *
 * It adds a "Points of interest" section to the panel. Choose a loaded track, a distance and the kinds of
 * places you want (drinking water, 24h gas stations, toilets, shops, food, ...). The result is added as a new
 * file in the list: every place is a waypoint with a symbol, a pin colour per kind, the distance along the
 * track and the distance from the track. You can edit them and export them with the rest.
 * The searching itself (Overpass requests, retries, filtering) is in poi-core.js.
 */
(function () {
  'use strict';

  const G = window.GpxMap, C = window.PoiCore;
  if (!G || !G.addWaypointFile) { console.error('poi-search.js: it needs the updated gpx-map.js (GpxMap.addWaypointFile).'); return; }
  if (!C) { console.error('poi-search.js: load poi-core.js before it.'); return; }
  const CATEGORIES = C.CATEGORIES;

  // icons on the map (Font Awesome 4) for the symbols used here
  G.registerSymbol('Drinking Water', 'tint');
  G.registerSymbol('Gas Station', 'fire');
  G.registerSymbol('Restroom', 'male');
  G.registerSymbol('Picnic Area', 'umbrella');
  G.registerSymbol('Car', 'wrench');

  /* ---------- Panel ---------- */
  const css = document.createElement('style');
  css.textContent = `
    .poi-box { margin-top: 12px; border-top: 1px solid #e3e7eb; padding-top: 8px; }
    .poi-box summary { cursor: pointer; font-weight: bold; }
    .poi-box label { display: block; margin: 6px 0 0; font-size: 13px; }
    .poi-box select, .poi-box input[type=number] { font: inherit; font-size: 13px; padding: 3px 4px; max-width: 100%; box-sizing: border-box; }
    .poi-box input[type=number] { width: 60px; }
    .poi-cats label { margin: 3px 0 0; cursor: pointer; }
    .poi-btns { display: flex; gap: 6px; margin-top: 8px; }
    .poi-status { margin-top: 6px; font-size: 12px; color: #188038; white-space: pre-line; }
    .poi-status.err { color: #b3261e; }
    .poi-note { margin-top: 6px; font-size: 11px; color: #6b7785; }
    .leaflet-popup-content div { white-space: pre-line; }`;
  document.head.appendChild(css);

  const box = document.createElement('details');
  box.className = 'poi-box';
  box.id = 'poiBox';
  box.innerHTML = `
    <summary>Points of interest</summary>
    <label>Track <select id="poiTrack"></select></label>
    <label>Distance from the track <input id="poiDist" type="number" min="0.1" max="5" step="0.1" value="1"> km</label>
    <div class="poi-cats" id="poiCats"></div>
    <label><input type="checkbox" id="poiThin" checked> Thin out places that are close together</label>
    <div class="poi-btns"><button id="poiGo" type="button">Search</button><button id="poiStop" type="button" hidden>Stop</button></div>
    <div class="poi-status" id="poiStatus" role="status"></div>
    <div class="poi-note">Data \u00a9 OpenStreetMap contributors, via the Overpass API.</div>`;
  (document.getElementById('panel') || document.body).appendChild(box);

  const $ = id => document.getElementById(id);
  CATEGORIES.forEach(c => {
    const l = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.value = c.key; cb.checked = !!C.DEFAULT_ON[c.key];
    l.append(cb, ' ' + c.label);
    $('poiCats').appendChild(l);
  });

  const setStatus = (t, err) => { $('poiStatus').textContent = t || ''; $('poiStatus').className = 'poi-status' + (err ? ' err' : ''); };
  const trackFiles = () => G.getFiles().filter(f => f.lines && f.lines.length);

  function fillTracks() {
    const sel = $('poiTrack'), prev = sel.value;
    sel.innerHTML = '';
    const list = trackFiles();
    if (!list.length) { sel.add(new Option('(load a GPX with a track first)', '')); return; }
    list.forEach(f => sel.add(new Option(f.name, f.name)));
    if (list.length > 1) sel.add(new Option('All tracks', '*'));
    if (Array.from(sel.options).some(o => o.value === prev)) sel.value = prev;
  }
  fillTracks();
  G.onChange(fillTracks);

  /* ---------- Search ---------- */
  let running = false, controller = null;

  async function search() {
    if (running) return;
    const cats = CATEGORIES.filter(c => $('poiCats').querySelector('input[value="' + c.key + '"]').checked);
    if (!cats.length) { setStatus('Choose at least one kind of place.', true); return; }
    const which = $('poiTrack').value;
    const src = which === '*' ? trackFiles() : trackFiles().filter(f => f.name === which);
    if (!src.length) { setStatus('Load a GPX file with a track first.', true); return; }
    const radius = Math.round(Math.max(0.1, Math.min(5, parseFloat($('poiDist').value) || 1)) * 1000);
    const lines = [].concat.apply([], src.map(f => f.lines));
    const parts = C.buildChunks(lines, radius).length;
    if (parts > C.options.confirmAbove &&
        !confirm('This track needs ' + parts + ' requests to the Overpass server. Continue?')) return;

    running = true; controller = new AbortController();
    $('poiGo').hidden = true; $('poiStop').hidden = false;
    try {
      const res = await C.search({
        lines: lines, cats: cats, radiusM: radius, thin: $('poiThin').checked, signal: controller.signal,
        onProgress: p => setStatus('Searching part ' + p.part + ' of ' + p.parts + '\u2026')
      });
      const name = 'POIs \u2013 ' + (which === '*' ? 'all tracks' : which);
      if (!res.pois.length) {                       // keep an earlier result: an empty answer may be a hiccup of the server
        setStatus('Nothing found within ' + (radius / 1000) + ' km of the track.\nOverpass: ' + C.summary(res.stats) +
          '\nThe servers are not always reliable. If you expect results, press Search again.');
        return;
      }
      const wpts = res.pois.map(p => G.makeWpt({ lat: p.lat, lon: p.lon, ele: 0, name: p.name, desc: p.desc, sym: p.sym, color: p.color }));
      G.getFiles().filter(f => f.name === name).forEach(f => G.removeFile(f));       // a new search replaces the old result
      G.addWaypointFile(name, wpts, []);
      const counts = {};
      wpts.forEach(w => { counts[w.sym] = (counts[w.sym] || 0) + 1; });
      setStatus(wpts.length + ' places added as "' + name + '"\n' + Object.keys(counts).map(k => k + ' ' + counts[k]).join(' \u00b7 ') +
        '\nOverpass: ' + C.summary(res.stats));
    } catch (e) {
      if (e.name === 'AbortError') setStatus('Search stopped.'); else setStatus(e.message, true);
    } finally {
      running = false; controller = null;
      $('poiGo').hidden = false; $('poiStop').hidden = true;
    }
  }

  $('poiGo').addEventListener('click', search);
  $('poiStop').addEventListener('click', () => { if (controller) controller.abort(); });

  window.PoiSearch = { options: C.options, search: search };
})();

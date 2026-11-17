/* MIT License

Copyright (c) 2026 Bert Muijtstege

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

/*
 * kml-import.js - KML import plugin for the GPX map
 *
 * Load this file AFTER gpx-map.js:
 *   <script src="gpx-map.js"></script>
 *   <script src="kml-import.js"></script>
 *
 * It registers the .kml format with the map, so KML files can be chosen or
 * dragged onto the map exactly like GPX files. Imported KML data is treated
 * like GPX data (edit, show in the legend, export as one GPX).
 *
 * What is imported
 *   - Point              -> waypoint (name, description, elevation)
 *   - LineString         -> line
 *   - Polygon/LinearRing -> outline as a line
 *   - gx:Track           -> line
 *   - ExtendedData       -> Symbol, Street1, Street2, Postalcode, City, Country, Phone, Email
 *                           (the same fields the Google Sheets export writes)
 *   Placemarks in (nested) folders are included.
 *
 * Not imported: KML styles (colours/icons), overlays, network links, KMZ (zipped KML).
 */
(function () {
  'use strict';

  if (!window.GpxMap) {
    console.error('kml-import.js: gpx-map.js must be loaded first.');
    return;
  }

  /* ---------- Options ---------- */
  const OPTIONS = {
    // What to use as the Symbol (= icon) of a point when the KML has no Symbol in its ExtendedData:
    //   'none'   -> leave empty (plain pin)
    //   'folder' -> name of the KML folder the placemark is in (handy for Google My Maps layers)
    //   'style'  -> the styleUrl without '#' (as the Google Sheets import does)
    symbolFallback: 'none'
  };

  /* ---------- Small XML helpers (namespace-independent) ---------- */
  const kids = (el, n) => Array.from(el.children).filter(c => c.localName === n);
  const kid = (el, n) => kids(el, n)[0] || null;
  const all = (el, n) => Array.from(el.getElementsByTagName('*')).filter(e => e.localName === n);
  const childText = (el, n) => { const k = kid(el, n); return k ? k.textContent.trim() : ''; };

  /* "lon,lat[,ele] lon,lat[,ele] ..." -> [{lat, lon, ele}] */
  function parseCoords(s) {
    return String(s || '').trim().split(/\s+/)
      .map(t => t.split(',').map(Number))
      .filter(a => a.length >= 2 && !isNaN(a[0]) && !isNaN(a[1]) && Math.abs(a[1]) <= 90 && Math.abs(a[0]) <= 180)
      .map(a => ({ lon: a[0], lat: a[1], ele: isNaN(a[2]) ? 0 : a[2] }));
  }

  /* KML descriptions are often HTML; reduce them to plain text */
  function htmlToText(s) {
    if (!s) return '';
    if (!/[<&]/.test(s)) return s.trim();
    const d = new DOMParser().parseFromString(s.replace(/<br\s*\/?>/gi, '\n'), 'text/html');
    return (d.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
  }

  function extendedData(pm) {
    const out = {};
    all(pm, 'Data').forEach(d => {
      const n = d.getAttribute('name');
      if (n) out[n.toLowerCase()] = childText(d, 'value');
    });
    all(pm, 'SimpleData').forEach(d => {
      const n = d.getAttribute('name');
      if (n) out[n.toLowerCase()] = d.textContent.trim();
    });
    return out;
  }

  function folderName(pm) {
    for (let p = pm.parentElement; p; p = p.parentElement) {
      if (p.localName === 'Folder') { const n = childText(p, 'name'); if (n) return n; }
    }
    return '';
  }

  /* ---------- Parser ---------- */
  function parseKml(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('This is not a valid KML file.');

    const wpts = [];
    const lines = [];

    all(doc.documentElement, 'Placemark').forEach(pm => {
      const ext = extendedData(pm);

      let sym = ext.symbol || ext.sym || '';
      if (!sym && OPTIONS.symbolFallback === 'folder') sym = folderName(pm);
      if (!sym && OPTIONS.symbolFallback === 'style') sym = childText(pm, 'styleUrl').replace(/^#/, '');

      const base = {
        name: childText(pm, 'name'),
        desc: htmlToText(childText(pm, 'description')),
        sym,
        streets: [ext.street1, ext.street2].filter(Boolean),
        postal: ext.postalcode || ext.postal || ext.postcode || '',
        city: ext.city || '',
        country: ext.country || '',
        phone: ext.phone || '',
        email: ext.email || ''
      };

      // points
      all(pm, 'Point').forEach(pt => {
        const c = parseCoords(childText(pt, 'coordinates'))[0];
        if (c) wpts.push(window.GpxMap.makeWpt(Object.assign({}, base, { lat: c.lat, lon: c.lon, ele: c.ele })));
      });

      // lines and polygon outlines
      all(pm, 'LineString').concat(all(pm, 'LinearRing')).forEach(g => {
        const pts = parseCoords(childText(g, 'coordinates'));
        if (pts.length > 1) lines.push(pts.map(p => [p.lat, p.lon]));
      });

      // Google Earth tracks (gx:Track): <gx:coord>lon lat alt</gx:coord>
      all(pm, 'Track').forEach(t => {
        const pts = kids(t, 'coord')
          .map(c => c.textContent.trim().split(/\s+/).map(Number))
          .filter(a => a.length >= 2 && !isNaN(a[0]) && !isNaN(a[1]))
          .map(a => [a[1], a[0]]);
        if (pts.length > 1) lines.push(pts);
      });
    });

    if (!wpts.length && !lines.length) throw new Error('No points, lines or polygons found in this KML file.');
    return { wpts, lines };
  }

  /* ---------- Register with the map ---------- */
  window.GpxMap.registerFormat({ ext: 'kml', label: 'KML', parse: parseKml });
  window.KmlImport = { options: OPTIONS, parse: parseKml };
})();

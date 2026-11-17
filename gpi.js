/*
MIT License

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


* gpi.js - Garmin GPI (Points of Interest) import and export for the GPX map
 *
 * Load it AFTER gpx-map.js:
 *   <script src="gpx-map.js"></script>
 *   <script src="gpi.js"></script>
 *
 * Import : .gpi files can be chosen or dropped on the map, like .gpx files. Format versions 00 and 01 are read,
 *          including nested areas, obfuscated files (Obfuscation 3/5) and the code page from the header.
 *          Every POI becomes a waypoint; the Garmin category becomes the symbol (<sym>).
 * Export : the button "Exporteer als GPI" writes the waypoints of all loaded files as one GPI file
 *          (format version 00, UTF-8). Tracks cannot be stored in a GPI file and are left out.
 *          The symbol of a waypoint is written as its category.
 *
 * Format description: Herbert Oppmann, "Garmin Points of Interest (POI) File Format".
 * The coding follows GPI.gs / GPI.js of the Google Sheets tool (same field mapping: Street1 = Street,
 * Street2 = House number).
 */
(function (root) {
  'use strict';

  const EXPORT_LOCALE = 'NL';       // language code of the texts in the exported file (EN, NL, DE, FR, ...)
  const MAX_NAME = 80;              // longest short name that is written

  /* ======================================================================
   *  Reading
   * ==================================================================== */

  function codePageLabel(cp) {
    const fixed = { 0x036A: 'windows-874', 0x03A4: 'shift_jis', 0x03A8: 'gb2312', 0x03B5: 'euc-kr',
                    0x03B6: 'big5', 0xFDE9: 'utf-8' };
    if (fixed[cp]) return fixed[cp];
    if (cp >= 1250 && cp <= 1258) return 'windows-' + cp;
    return 'utf-8';
  }

  // Obfuscation: every byte is reduced nibble by nibble (no carry between the nibbles) by a constant that
  // repeats every 4 bytes: 0x48, 0x06, 0xB3, 0x00.
  const OBF = [0x48, 0x06, 0xB3, 0x00];
  function deobfuscate(b, start, end) {
    for (let i = start; i < end; i++) {
      const c = OBF[(i - start) & 3], v = b[i];
      b[i] = ((((v >> 4) - (c >> 4)) & 15) << 4) | (((v & 15) - (c & 15)) & 15);
    }
  }
  function obfuscate(b, start, end) {                 // the reverse (used by the test only)
    for (let i = start; i < end; i++) {
      const c = OBF[(i - start) & 3], v = b[i];
      b[i] = ((((v >> 4) + (c >> 4)) & 15) << 4) | (((v & 15) + (c & 15)) & 15);
    }
  }

  // buffer: ArrayBuffer or Uint8Array. Returns { wpts: [...], lines: [] } for the GPX map.
  function parseGpi(buffer, makeWpt) {
    const src = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let b = src;
    if (b.length < 16) throw new Error('This GPI file is too small or invalid.');

    const u16 = p => (b[p] | (b[p + 1] << 8)) >>> 0;
    const u32 = p => (b[p] + b[p + 1] * 256 + b[p + 2] * 65536 + b[p + 3] * 16777216) >>> 0;
    const i32 = p => { const n = u32(p); return n > 2147483647 ? n - 4294967296 : n; };
    const ascii = (p, n) => String.fromCharCode.apply(null, Array.from(b.subarray(p, p + n)));

    // a list of records inside a limited byte area (limit: stop after that many records)
    function records(start, end, limit) {
      const out = [];
      let pos = start;
      while (pos + 8 <= end && (!limit || out.length < limit)) {
        const type = u16(pos), flags = u16(pos + 2), total = u32(pos + 4);
        let main = total, data = pos + 8;
        if (flags & 8) {
          if (pos + 12 > end) throw new Error('Incomplete GPI record found.');
          main = u32(pos + 8); data = pos + 12;
        }
        if (total > end - data || main > total) throw new Error('Invalid record length in GPI file.');
        out.push({ type, flags, mainStart: data, mainEnd: data + main,
                   extraStart: data + main, extraEnd: data + total, next: data + total });
        pos = data + total;
        if (type === 0xFFFF) break;
      }
      return out;
    }

    // header records (always in plain text)
    const head = records(0, b.length, 2);
    const h1 = head[0], h2 = head[1];
    if (!h1 || h1.type !== 0 || ascii(h1.mainStart, 6) !== 'GRMREC') {
      throw new Error('This file has no recognisable Garmin GPI header.');
    }
    const version = ascii(h1.mainStart + 6, 2);
    if (version !== '00' && version !== '01') {
      throw new Error('GPI format version ' + version + ' is not supported (only 00 and 01).');
    }
    const obf = h1.mainEnd - h1.mainStart > 13 ? b[h1.mainStart + 13] : 0;
    if (obf) {                                    // obfuscation starts right after Header1 and Header2
      if (!h2) throw new Error('GPI header 2 is missing.');
      b = b.slice();                              // do not change the caller's data
      deobfuscate(b, h2.next, b.length);          // what lies behind the End record is not used anyway
    }

    let codePage = 0xFDE9;
    if (h2 && h2.type === 1 && h2.mainEnd - h2.mainStart >= 10) codePage = u16(h2.mainStart + 8);
    let decoder;
    try { decoder = new TextDecoder(codePageLabel(codePage)); } catch (e) { decoder = new TextDecoder('windows-1252'); }
    const text = (s, e) => decoder.decode(b.subarray(s, e)).replace(/\u0000/g, '');

    const pstr = (pos, end) => {
      if (pos + 2 > end) return { value: '', next: end };
      const len = u16(pos); pos += 2;
      const stop = Math.min(end, pos + len);
      return { value: text(pos, stop), next: stop };
    };
    const PREFER = ['NL', 'EN', 'DE'];
    const lstr = (pos, end) => {
      if (pos + 4 > end) return { value: '', next: end };
      const len = u32(pos); pos += 4;
      const stop = Math.min(end, pos + len);
      const found = {}; let firstVal = '';
      while (pos + 2 <= stop) {
        const loc = ascii(pos, 2); pos += 2;
        const it = pstr(pos, stop); pos = it.next;
        if (!(loc in found)) found[loc] = it.value;
        if (!firstVal) firstVal = it.value;
      }
      let value = firstVal;
      for (const l of PREFER) if (found[l]) { value = found[l]; break; }
      return { value, next: stop };
    };

    function address(rec, poi) {
      if (rec.mainStart + 2 > rec.mainEnd) return;
      const flags = u16(rec.mainStart);
      let pos = version === '01' ? rec.mainStart + 2 : rec.extraStart;
      const end = version === '01' ? rec.mainEnd : rec.extraEnd;
      let x;
      if (flags & 1)  { x = lstr(pos, end); poi.city = x.value; pos = x.next; }
      if (flags & 2)  { x = lstr(pos, end); poi.country = x.value; pos = x.next; }
      if (flags & 4)  { x = lstr(pos, end); pos = x.next; }                         // state: no field for it
      if (flags & 8)  { x = pstr(pos, end); poi.postal = x.value; pos = x.next; }
      if (flags & 16) { x = lstr(pos, end); poi.street1 = x.value; pos = x.next; }
      if (flags & 32) { x = pstr(pos, end); poi.street2 = x.value; }
    }
    function contact(rec, poi) {
      if (rec.mainStart + 2 > rec.mainEnd) return;
      const flags = u16(rec.mainStart);
      let pos = version === '01' ? rec.mainStart + 2 : rec.extraStart;
      const end = version === '01' ? rec.mainEnd : rec.extraEnd;
      let x;
      if (flags & 1)  { x = pstr(pos, end); poi.phone = x.value; pos = x.next; }
      if (flags & 2)  { x = pstr(pos, end); pos = x.next; }
      if (flags & 4)  { x = pstr(pos, end); pos = x.next; }
      if (flags & 8)  { x = pstr(pos, end); poi.email = x.value; pos = x.next; }
    }

    function waypoint(rec, cats) {
      let pos = rec.mainStart;
      if (pos + 11 > rec.mainEnd) return null;
      const lat = i32(pos) * 360 / 4294967296; pos += 4;
      const lon = i32(pos) * 360 / 4294967296; pos += 4;
      pos += 3;                                   // Unknown4 (ushort) + Unknown5 (byte)
      const poi = { lat, lon, name: lstr(pos, rec.mainEnd).value, desc: '', category: '',
                    street1: '', street2: '', postal: '', city: '', country: '', phone: '', email: '' };
      records(rec.extraStart, rec.extraEnd).forEach(ex => {
        if (ex.type === 6 && ex.mainStart + 2 <= ex.mainEnd) {
          poi.category = cats[u16(ex.mainStart)] || '';
        } else if (ex.type === 11) address(ex, poi);
        else if (ex.type === 12) contact(ex, poi);
        else if (ex.type === 10) {
          if (!poi.desc) poi.desc = lstr(ex.mainStart, ex.mainEnd).value;
        } else if (ex.type === 14 && ex.mainStart < ex.mainEnd) {
          const t = b[ex.mainStart];
          if (t === 6) poi.desc = pstr(ex.mainStart + 1, ex.mainEnd).value;
          else {
            const d = lstr(ex.mainStart + 1, ex.mainEnd);
            poi.desc = d.value;
            if (t === 7) { const url = pstr(d.next, ex.mainEnd).value; if (url) poi.desc += (poi.desc ? '\n' : '') + url; }
          }
        }
      });
      return poi;
    }

    const pois = [];
    function walkArea(area, cats) {               // areas can be nested (format 01)
      records(area.extraStart, area.extraEnd).forEach(r => {
        if (r.type === 8) walkArea(r, cats);
        else if (r.type === 2) {
          const p = waypoint(r, cats);
          if (p && isFinite(p.lat) && isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180) pois.push(p);
        }
      });
    }

    let top;
    try { top = records(0, b.length); }
    catch (e) { throw new Error(e.message + (obf ? ' (the file is obfuscated; it may be damaged)' : '')); }
    top.forEach(g => {
      if (g.type !== 9) return;
      const afterSource = g.mainStart + 4 + u32(g.mainStart);       // main data starts with an LString (data source)
      if (afterSource > g.mainEnd) throw new Error('Invalid LString length in POI group.');
      const cats = {};
      records(g.extraStart, g.extraEnd).forEach(ex => {
        if (ex.type === 7 && ex.mainStart + 2 <= ex.mainEnd) cats[u16(ex.mainStart)] = lstr(ex.mainStart + 2, ex.mainEnd).value;
      });
      records(afterSource, g.mainEnd).forEach(a => { if (a.type === 8) walkArea(a, cats); });
    });

    const mk = makeWpt || (p => p);
    const wpts = pois.map(p => mk({
      lat: p.lat, lon: p.lon, ele: 0, name: p.name, desc: p.desc, sym: p.category,
      streets: [p.street1, p.street2].filter(Boolean),
      postal: p.postal, city: p.city, country: p.country, phone: p.phone, email: p.email
    }));
    if (!wpts.length) throw new Error('No supported POI waypoints found in this GPI file.');
    return { wpts, lines: [] };
  }

  /* ======================================================================
   *  Writing (format version 00)
   * ==================================================================== */

  const enc = new TextEncoder();
  const utf8 = s => enc.encode(String(s == null ? '' : s));
  const u16 = n => Uint8Array.of(n & 255, (n >>> 8) & 255);
  const u32 = n => { n = Number(n) >>> 0; return Uint8Array.of(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255); };
  function concat(parts) {
    let len = 0;
    parts.forEach(p => { len += p.length; });
    const out = new Uint8Array(len);
    let o = 0;
    parts.forEach(p => { out.set(p, o); o += p.length; });
    return out;
  }
  function pstring(s) {
    let b = utf8(s);
    if (b.length > 65535) b = utf8(String(s).slice(0, 20000));
    return concat([u16(b.length), b]);
  }
  function lstring(locale, s) {
    const entry = concat([utf8(locale), pstring(s)]);
    return concat([u32(entry.length), entry]);
  }
  function coord32(deg) {
    let n = Math.round(deg * 4294967296 / 360);
    if (n > 2147483647) n -= 4294967296;
    if (n < -2147483648) n += 4294967296;
    return u32(n);
  }
  // type, flags, [total length, main length when extra data], main data, extra data
  function record(type, main, extraParts) {
    main = main || new Uint8Array(0);
    const extra = extraParts && extraParts.length ? concat(extraParts) : new Uint8Array(0);
    if (extra.length) return concat([u16(type), u16(8), u32(main.length + extra.length), u32(main.length), main, extra]);
    return concat([u16(type), u16(0), u32(main.length), main]);
  }

  function waypointRecord(p, catId) {
    const name = String(p.name || '').slice(0, MAX_NAME);
    const main = concat([coord32(p.lat), coord32(p.lon), u16(1), Uint8Array.of(0), lstring(EXPORT_LOCALE, name)]);
    const extra = [];
    if (catId !== undefined) extra.push(record(6, u16(catId)));

    let af = 0; const ad = [];                                   // address (format 00: strings in the extra data)
    if (p.city)    { af |= 1;  ad.push(lstring(EXPORT_LOCALE, p.city)); }
    if (p.country) { af |= 2;  ad.push(lstring(EXPORT_LOCALE, p.country)); }
    if (p.postal)  { af |= 8;  ad.push(pstring(p.postal)); }
    if (p.street1) { af |= 16; ad.push(lstring(EXPORT_LOCALE, p.street1)); }
    if (p.street2) { af |= 32; ad.push(pstring(p.street2)); }
    if (af) extra.push(record(11, u16(af), [concat(ad)]));

    let cf = 0; const cd = [];                                   // contact
    if (p.phone) { cf |= 1; cd.push(pstring(p.phone)); }
    if (p.email) { cf |= 8; cd.push(pstring(p.email)); }
    if (cf) extra.push(record(12, u16(cf), [concat(cd)]));

    if (p.desc) extra.push(record(14, concat([Uint8Array.of(6), pstring(p.desc)])));   // type 6 = PString
    return record(2, main, extra);
  }

  // pois: [{ lat, lon, name, desc, sym, street1, street2, postal, city, country, phone, email }]
  function buildGpi(pois, title) {
    if (!pois.length) throw new Error('There are no waypoints to export.');
    title = String(title || 'POI').slice(0, 250);

    const catIds = {}, catNames = [];                            // symbol -> category
    pois.forEach(p => {
      const c = String(p.sym || '').trim();
      if (c && !(c in catIds)) { catIds[c] = catNames.length; catNames.push(c); }
    });

    const gdate = Math.floor((Date.now() - Date.UTC(1989, 11, 31)) / 1000);
    const header1 = record(0, concat([utf8('GRMREC'), utf8('00'), u32(gdate), Uint8Array.of(0, 0), pstring(title)]));
    const header2 = record(1, concat([utf8('POI'), Uint8Array.of(0, 0, 0), utf8('00'), u16(65001), u16(0)]));

    const wpts = pois.map(p => {
      const c = String(p.sym || '').trim();
      return waypointRecord(p, c ? catIds[c] : undefined);
    });
    let maxLat = -Infinity, minLat = Infinity, maxLon = -Infinity, minLon = Infinity;
    pois.forEach(p => {
      if (p.lat > maxLat) maxLat = p.lat; if (p.lat < minLat) minLat = p.lat;
      if (p.lon > maxLon) maxLon = p.lon; if (p.lon < minLon) minLon = p.lon;
    });
    const area = record(8, concat([coord32(maxLat), coord32(maxLon), coord32(minLat), coord32(minLon),
                                   u32(0), u16(1), Uint8Array.of(0)]), wpts);
    const cats = catNames.map((n, i) => record(7, concat([u16(i), lstring(EXPORT_LOCALE, n)])));
    const group = record(9, concat([lstring(EXPORT_LOCALE, title), area]), cats);
    return concat([header1, header2, group, record(0xFFFF)]);
  }

  const api = { parseGpi, buildGpi, deobfuscate, obfuscate };
  root.GpiFormat = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  /* ======================================================================
   *  Connection to the map
   * ==================================================================== */
  const G = root.GpxMap;
  if (!G || typeof document === 'undefined') return;

  G.registerFormat({
    ext: 'gpi', label: 'GPI', binary: true,                      // binary: the parser gets the ArrayBuffer
    parse: buffer => parseGpi(buffer, G.makeWpt)
  });

  const btn = document.createElement('button');
  btn.id = 'exportGpi';
  btn.type = 'button';
  btn.textContent = 'Exporteer als GPI';
  btn.style.marginTop = '10px';
  btn.hidden = true;
  const anchor = document.getElementById('export');
  if (anchor) anchor.insertAdjacentElement('afterend', btn); else document.getElementById('panel').appendChild(btn);

  const count = () => G.getFiles().reduce((n, f) => n + f.wpts.length, 0);
  G.onChange(() => { btn.hidden = count() === 0; });

  btn.addEventListener('click', () => {
    const files = G.getFiles();
    const pois = [];
    files.forEach(f => f.wpts.forEach(w => {
      if (!isFinite(w.lat) || !isFinite(w.lon)) return;
      const s = w.streets || [];
      pois.push({
        lat: w.lat, lon: w.lon, name: w.name || ('POI ' + (pois.length + 1)), desc: w.desc || '', sym: w.sym || '',
        street1: s[0] || '', street2: s[1] || '', postal: w.postal || '', city: w.city || '',
        country: w.country || '', phone: w.phone || '', email: w.email || ''
      });
    }));
    const msgEl = document.getElementById('msg');
    try {
      const title = files.length === 1 ? files[0].name.replace(/\.[a-z0-9]+$/i, '') : 'merged';
      const bytes = buildGpi(pois, title);
      const d = new Date();
      const stamp = String(d.getDate()).padStart(2, '0') + String(d.getMonth() + 1).padStart(2, '0') + d.getFullYear();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
      a.download = 'merged_' + stamp + '.gpi';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      const lines = files.reduce((n, f) => n + f.lines.length, 0);
      if (msgEl) msgEl.textContent = pois.length + ' points exported to GPI' + (lines ? ' (tracks are not stored in GPI files)' : '') + '.';
    } catch (e) {
      if (msgEl) msgEl.textContent = 'GPI export failed: ' + e.message;
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);

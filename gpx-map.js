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

/* ---------- Kaart ---------- */
var map = L.map('map', {
  center: [46.8, 11.5],
  zoom: 7,
  scrollWheelZoom: true,
  tap: false
});

/* ---------- Tile-lagen ---------- */
var outdoors = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
});


var cycle = L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <<a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases" title="CyclOSM - Open Bicycle render">CyclOSM</a> | Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

var hot = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, HOT'
});

var TopPlusOpen_Color = L.tileLayer('https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/WEBMERCATOR/{z}/{y}/{x}.png', {
  maxZoom: 18,
  attribution: 'Map data: &copy; <a href="https://www.govdata.de/dl-de/by-2-0">dl-de/by-2-0</a>'
});

var satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
});

var light = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attribution">CARTO</a>'
});

var topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  maxZoom: 17,
  attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)'
});


    // =====================================
    // OVERLAY-KAARTEN: WAYMARKED TRAILS
    // =====================================

    var hikingTrails = L.tileLayer(
      'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© Waymarked Trails'
      }
    );

    var cyclingTrails = L.tileLayer(
      'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© Waymarked Trails'
      }
    );

  // Basiskaarten: er kan steeds maar één tegelijk actief zijn.
var baseMaps = {
  "OpenStreetMap": outdoors,
  "CycleOSM": cycle,
  "Humanitarian (HOT)": hot,
  "TopPlusOpen Color": TopPlusOpen_Color,
  "Topografisch (OpenTopoMap)": topo,
  "Satellite": satellite
};

    // Overlays: meerdere lagen kunnen tegelijk actief zijn.
    var overlayMaps = {
      "Waymarked Trails - wandelen": hikingTrails,
      "Waymarked Trails - fietsen": cyclingTrails
    };

outdoors.addTo(map);   // standaardlaag
L.control.layers(baseMaps, overlayMaps, {
  position: 'topleft',
  collapsed: true
}).addTo(map);


/* ---------- GPX-logica ---------- */
const COLORS = ['#d93025', '#1a73e8', '#188038', '#e37400', '#9334e6', '#00838f'];
const KEY = 'gpxMapFiles';
let files = [];            // [{name, color, wpts:[], lines:[[[lat,lon],...]], group}]
const changeHooks = [];    // functions from plugins, called whenever the file list changes

const $ = id => document.getElementById(id);
const msg = t => { $('msg').textContent = t || ''; };

/* ---------- Awesome markers: icoon per symbool, kleur per bestand ---------- */
const AWESOME_COLORS = ['red', 'blue', 'green', 'orange', 'purple', 'cadetblue'];   // zelfde volgorde als COLORS
const DEFAULT_ICON = 'map-marker';
// [Symboolnaam in GPX (<sym>), Font Awesome 4-icoon] - hier kun je zelf regels bijvoegen
const SYMBOLS = [
  ['Hotel', 'bed'], ['Lodging', 'bed'], ['Restaurant', 'cutlery'], ['Bar', 'beer'], ['Cafe', 'coffee'],
  ['Campground', 'tree'], ['Summit', 'flag'], ['Scenic Area', 'camera'], ['Parking Area', 'car'],
  ['Gas Station', 'tint'], ['Information', 'info'], ['Shopping Center', 'shopping-cart'],
  ['Museum', 'university'], ['Bike Trail', 'bicycle'], ['Bicycle', 'bicycle'], ['Motorcycle', 'motorcycle'],
  ['Water', 'tint'], ['Flag', 'flag'], ['Pin', 'map-marker']
];
const SYMBOL_ICON = {};
SYMBOLS.forEach(([n, i]) => { SYMBOL_ICON[n.toLowerCase()] = i; });

function iconName(sym) { return SYMBOL_ICON[String(sym || '').trim().toLowerCase()] || DEFAULT_ICON; }
// Kleuren die de plug-in kent: [waarde, label in de zijbalk]
const PIN_COLORS = [
  ['red', 'Rood'], ['darkred', 'Donkerrood'], ['lightred', 'Lichtrood'], ['orange', 'Oranje'], ['beige', 'Beige'],
  ['green', 'Groen'], ['darkgreen', 'Donkergroen'], ['lightgreen', 'Lichtgroen'],
  ['blue', 'Blauw'], ['darkblue', 'Donkerblauw'], ['lightblue', 'Lichtblauw'], ['cadetblue', 'Staalblauw'],
  ['purple', 'Paars'], ['darkpurple', 'Donkerpaars'], ['pink', 'Roze'],
  ['white', 'Wit'], ['lightgray', 'Lichtgrijs'], ['gray', 'Grijs'], ['black', 'Zwart']
];
function markerColor(f, w) {
  if (w && w.color && PIN_COLORS.some(c => c[0] === w.color)) return w.color;   // eigen kleur van het punt
  const i = COLORS.indexOf(f.color);                                            // anders kleur van het bestand
  return AWESOME_COLORS[i >= 0 ? i : 1];
}
function makeIcon(f, w) {
  return L.AwesomeMarkers.icon({
    icon: iconName(w.sym), prefix: 'fa',
    markerColor: markerColor(f, w), iconColor: 'white',
    tooltipAnchor: [1, -34]
  });
}

/* Legenda: welke symbolen staan er op de kaart */
const legend = L.control({ position: 'bottomleft' });
legend.onAdd = function () { return L.DomUtil.create('div', 'sym-legend'); };
legend.addTo(map);

function updateLegend() {
  const el = legend.getContainer();
  const counts = {};
  files.forEach(f => f.wpts.forEach(w => { const s = (w.sym || '').trim(); counts[s] = (counts[s] || 0) + 1; }));
  const keys = Object.keys(counts).sort();
  el.innerHTML = '';
  el.style.display = keys.length ? '' : 'none';
  if (!keys.length) return;
  const t = document.createElement('b');
  t.textContent = 'Symbols';
  el.appendChild(t);
  keys.forEach(k => {
    const row = document.createElement('div');
    const i = document.createElement('i');
    i.className = 'fa fa-' + iconName(k);
    row.append(i, ' ' + (k || 'No symbol') + ' (' + counts[k] + ')');
    el.appendChild(row);
  });
}


/* ---------- Inlezen en parsen ---------- */
function decodeXml(buffer) {
  const head = new TextDecoder('windows-1252').decode(buffer.slice(0, 200));
  const m = head.match(/encoding=["']([^"']+)["']/i);
  let text;
  try { text = new TextDecoder(m ? m[1].toLowerCase() : 'utf-8').decode(buffer); }
  catch (e) { text = new TextDecoder('utf-8').decode(buffer); }
  return text.replace(/^\uFEFF/, '');
}

function childText(el, name) {
  for (const c of el.children) if (c.localName === name) return c.textContent.trim();
  return '';
}
function descendants(el, name) {
  return Array.from(el.getElementsByTagName('*')).filter(e => e.localName === name);
}

function parseGpx(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('This is no valid GPX-file.');
  }

  const first = (el, n) =>
    descendants(el, n)[0]?.textContent.trim() || '';

  // Waypoints
  const wpts = Array.from(doc.getElementsByTagName('wpt')).map(w => {
    const streets = descendants(w, 'StreetAddress')
      .map(e => e.textContent.trim())
      .filter(Boolean);

    const postal = first(w, 'PostalCode');
    const city = first(w, 'City');
    const country = first(w, 'Country');

    const addr = [
      streets.join(', '),
      [postal, city].filter(Boolean).join(' '),
      country
    ].filter(Boolean).join(', ');

    const proximityText = first(w, 'Proximity');

    return {
      lat: parseFloat(w.getAttribute('lat')),
      lon: parseFloat(w.getAttribute('lon')),
      ele: parseFloat(childText(w, 'ele')) || 0,
      name: childText(w, 'name'),
      desc: childText(w, 'desc'),
      sym: childText(w, 'sym'),

      streets,
      postal,
      city,
      country,

      phone: first(w, 'PhoneNumber'),
      email: first(w, 'Email'),
      addr,

      // Garmin waypoint extensions
      displayMode: first(w, 'DisplayMode'),
      proximity: proximityText !== ''
        ? Number(proximityText)
        : null
    };
  }).filter(w => !isNaN(w.lat) && !isNaN(w.lon));

  // Coördinaten omzetten
  const pts = els => els.map(p => [
    parseFloat(p.getAttribute('lat')),
    parseFloat(p.getAttribute('lon'))
  ]).filter(p => !isNaN(p[0]) && !isNaN(p[1]));

  // Tracks
  const lines = [];

  Array.from(doc.getElementsByTagName('trkseg')).forEach(seg => {
    const l = pts(Array.from(seg.getElementsByTagName('trkpt')));
    if (l.length > 1) lines.push(l);
  });

  // Routes met afzonderlijke routepunten
  const routes = [];

  Array.from(doc.getElementsByTagName('rte')).forEach(r => {
    const route = {
      name: childText(r, 'name'),
      points: []
    };

    Array.from(r.children)
      .filter(e => e.localName === 'rtept')
      .forEach(p => {
        const lat = parseFloat(p.getAttribute('lat'));
        const lon = parseFloat(p.getAttribute('lon'));

        if (isNaN(lat) || isNaN(lon)) return;

        const hasViaPoint = descendants(p, 'ViaPoint').length > 0;
        const hasShapingPoint = descendants(p, 'ShapingPoint').length > 0;

        let pointType = '';

        if (hasViaPoint) {
          pointType = 'ViaPoint';
        } else if (hasShapingPoint) {
          pointType = 'ShapingPoint';
        }

        route.points.push({
          lat,
          lon,
          ele: parseFloat(childText(p, 'ele')) || 0,
          name: childText(p, 'name'),
          desc: childText(p, 'desc'),
          type: childText(p, 'type'),
          pointType,
          viaPoint: hasViaPoint,
          shapingPoint: hasShapingPoint
        });
      });

    if (route.points.length) {
      routes.push(route);
    }
  });

  if (!wpts.length && !lines.length && !routes.length) {
    throw new Error('No waypoints, tracks or routes found.');
  }

  return { wpts, lines, routes };
}

/* ---------- Tekenen ---------- */
function popupHtml(w, sourceFile) {
  const div = document.createElement('div');

  const add = (tag, text) => {
    if (text === undefined || text === null || text === '') return;

    const e = document.createElement(tag);
    e.textContent = text;
    div.appendChild(e);
  };

  add('b', w.name);
  add('div', w.desc);
  add('small', w.addr);

  if (w.displayMode) {
    add('div', 'Display mode: ' + w.displayMode);
  }

  if (w.proximity !== undefined && w.proximity !== null) {
    add('div', 'Proximity: ' + w.proximity + ' m');
  }

  if (w.pointType) {
    add('div', 'Route point: ' + w.pointType);
  }

  // Kopieerknop alleen voor gewone POI's
  if (sourceFile && sourceFile.wpts.includes(w)) {
    const btn = document.createElement('button');

    btn.type = 'button';
    btn.textContent = '📋 Copy to Layer…';
    btn.style.cssText =
      'display:block;margin-top:10px;padding:6px 10px;' +
      'cursor:pointer;border:1px solid #aaa;border-radius:4px;' +
      'background:#f5f5f5;';

    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      showCopyDialog(sourceFile, w);
    });

    div.appendChild(btn);
  }
  // Verplaatsknop alleen voor gewone POI's
  if (sourceFile && sourceFile.wpts.includes(w)) {
    const btnMove = document.createElement('button');

    btnMove.type = 'button';
    btnMove.textContent = '📍 Move POI';
    btnMove.style.cssText =
      'display:block;margin-top:6px;padding:6px 10px;' +
      'cursor:pointer;border:1px solid #aaa;border-radius:4px;' +
      'background:#f5f5f5;';

    btnMove.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      startPopupMove(sourceFile, w);
    });

    div.appendChild(btnMove);
  }
  return div;
}

/* =====================================================
   ADD-ON: POI VERPLAATSEN BINNEN DE BESTAANDE LAAG
   ===================================================== */

let movingPoi = null;

function startPopupMove(sourceFile, waypoint) {

  if (!files.includes(sourceFile) ||
      !sourceFile.wpts.includes(waypoint)) {
    msg('POI not found.');
    return;
  }

  movingPoi = {
    file: sourceFile,
    waypoint: waypoint
  };

  setAction('movePoi');

  msg(
    'click on the map for a new position. ' +
    '(Esc = cancel)'
  );

  // Sluit de popup zodat deze de kaart niet bedekt
  map.closePopup();
}

/* =====================================================
   ADD-ON: POI KOPIËREN NAAR EEN ANDERE LAAG
   ===================================================== */

// Toon popup waarin de gebruiker de doellaag kiest
function showCopyDialog(sourceFile, sourceWaypoint) {

  const dialog = document.createElement('dialog');

  dialog.style.cssText =
    'border:1px solid #aaa;border-radius:8px;' +
    'padding:20px;min-width:400px;max-width:90%;' +
    'box-shadow:0 4px 20px rgba(0,0,0,.25);';

  // Titel
  const title = document.createElement('h3');
  title.textContent = 'Copy POI';
  title.style.marginTop = '0';

  // Naam van de POI
  const info = document.createElement('p');
  info.textContent = sourceWaypoint.name || 'Nameless POI';

  // Label
  const label = document.createElement('label');
  label.textContent = 'Layer:';
  label.style.display = 'block';
  label.style.marginBottom = '6px';

  // Selectie
  const select = document.createElement('select');
  select.style.cssText =
    'width:100%;padding:8px;margin-bottom:15px;';

  // Bestaande lagen, behalve de bronlaag
  files.forEach((f, i) => {
    if (f === sourceFile) return;

    select.add(new Option(f.name, String(i)));
  });

  // Optie om een nieuwe laag te maken
  select.add(new Option('＋ Make new layer', 'new'));

  // Knoppen
  const buttons = document.createElement('div');
  buttons.style.cssText =
    'display:flex;justify-content:flex-end;gap:8px;';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancel';

  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.textContent = 'Copy';
  confirm.style.fontWeight = 'bold';

  buttons.append(cancel, confirm);

  dialog.append(title, info, label, select, buttons);
  document.body.appendChild(dialog);

  cancel.addEventListener('click', () => dialog.close());

  confirm.addEventListener('click', () => {

    if (select.value === 'new') {

      const defaultName =
        sourceFile.name.replace(/\.[^.]+$/, '') + '_Copy.gpx';

      const newName = prompt(
        'Name of the new layer:',
        defaultName
      );

      if (newName === null) return;

      if (!newName.trim()) {
        alert('Please enter a name for the new layer.');
        return;
      }

      copyWaypointToNewLayer(
        sourceFile,
        sourceWaypoint,
        newName.trim()
      );

    

    } else {

      const targetFile = files[Number(select.value)];

      if (!targetFile || targetFile === sourceFile) {
        alert('Invalid target layer.');
        return;
      }

      copyWaypointToLayer(
        sourceFile,
        sourceWaypoint,
        targetFile
      );
    }

    dialog.close();
  });

  dialog.addEventListener('close', () => dialog.remove());

  dialog.addEventListener('click', e => {
    if (e.target === dialog) dialog.close();
  });

  dialog.showModal();
}


// Maak een onafhankelijke kopie van een POI
function cloneWaypoint(w) {

  // JSON-kopie neemt ook alle aanvullende eigenschappen mee,
  // waaronder Garmin DisplayMode en Proximity.
  return JSON.parse(JSON.stringify(w));
}


// Kopieer naar een bestaande laag
function copyWaypointToLayer(sourceFile, sourceWaypoint, targetFile) {

  if (!files.includes(sourceFile) || !files.includes(targetFile)) {
    return;
  }

  if (sourceFile === targetFile) {
    alert('Choose a different layer than the source layer.');
    return;
  }

  const copy = cloneWaypoint(sourceWaypoint);

  targetFile.wpts.push(copy);

  // Doellaag opnieuw tekenen
  draw(targetFile);

  // Lijst, legenda en opslag bijwerken
  renderList();
  save();

  msg('POI gekopieerd naar: ' + targetFile.name);
}


// Kopieer naar een nieuwe laag
function copyWaypointToNewLayer(sourceFile, sourceWaypoint, newName) {

  const copy = cloneWaypoint(sourceWaypoint);

  const newFile = {
    name: newName,
    color: COLORS[files.length % COLORS.length],
    wpts: [copy],
    lines: [],
    routes: [],
    group: null
  };

  files.push(newFile);

  draw(newFile);
  renderList();
  save();

  msg('New Layer added: ' + newName);
}



function draw(f) {
  if (f.group) f.group.remove();

  f.group = L.featureGroup().addTo(map);

  // Tracks
  (f.lines || []).forEach(l => {
    L.polyline(l, {
      color: f.color,
      weight: 4,
      opacity: .85
    }).addTo(f.group);
  });

  // Waypoints
  (f.wpts || []).forEach(w => {
    const m = L.marker([w.lat, w.lon], {
      icon: makeIcon(f, w)
    })
      .bindPopup(() => popupHtml(w, f), {
        minWidth: 200,
        maxWidth: 400,
        autoPan: true     })
      .bindTooltip(() => w.name || '', {
        direction: 'top'
      })
      .addTo(f.group);

    m.on('click', () => {
      if (editMode) {
        m.closePopup();
        selectPoint(f, w);
      }
    });
  });

  // Routes
  (f.routes || []).forEach(route => {
    const routeCoords = route.points.map(p => [p.lat, p.lon]);

    // Route als stippellijn
    if (routeCoords.length > 1) {
      L.polyline(routeCoords, {
        color: f.color,
        weight: 4,
        opacity: .9,
        dashArray: '8, 6'
      }).addTo(f.group);
    }

    // Afzonderlijke routepunten
    route.points.forEach(p => {
      let radius = 4;
      let fillColor = f.color;

      if (p.viaPoint) {
        radius = 8;
        fillColor = '#d93025';
      } else if (p.shapingPoint) {
        radius = 4;
        fillColor = '#1a73e8';
      }

      const marker = L.circleMarker([p.lat, p.lon], {
        radius: radius,
        color: '#ffffff',
        weight: 2,
        fillColor: fillColor,
        fillOpacity: 1
      });

      marker
        .bindPopup(() => popupHtml(p), {
          minWidth: 200,
          maxWidth: 400,
          autoPan: true
        })
        .bindTooltip(() => p.name || p.pointType || '', {
          direction: 'top'
        })
        .addTo(f.group);
    });
  });
}

function renderList() {
  const ul = $('list');
  ul.innerHTML = '';
  files.forEach((f, i) => {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:' + f.color;
    const nm = document.createElement('span');
    nm.className = 'nm'; nm.textContent = f.name; nm.title = f.name;
    const ct = document.createElement('span');
   ct.className = 'ct';

    const routePointCount = (f.routes || [])
      .reduce((sum, route) => sum + route.points.length, 0);

    ct.textContent =
      f.wpts.length + ' waypoints' +
      (routePointCount ? ', ' + routePointCount + ' routepoints' : '') +
      (f.lines.length ? ', ' + f.lines.length + ' tracks' : '');
    const rm = document.createElement('button');
    rm.className = 'rm'; rm.textContent = '×'; rm.title = 'Remove';
    rm.onclick = () => { if (selected && selected.f === f) deselect(); f.group && f.group.remove(); files.splice(i, 1); renderList(); save(); };
    nm.onclick = () => f.group && map.fitBounds(f.group.getBounds().pad(.1));
    nm.style.cursor = 'pointer';
    li.append(dot, nm, ct, rm);
    ul.appendChild(li);
  });
  $('clear').hidden = files.length === 0;
  $('export').hidden = files.length === 0;
  fillTargets();
  updateLegend();
  changeHooks.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
}

function fitAll() {
  const g = L.featureGroup(files.map(f => f.group).filter(Boolean));
  if (g.getLayers().length) map.fitBounds(g.getBounds().pad(.1));
}

/* ---------- Bestanden toevoegen ---------- */
/* ---------- Format registry: plugins can add file formats (e.g. kml-import.js) ---------- */
const FORMATS = {
  gpx: { label: 'GPX', parse: text => parseGpx(text) }
};

function registerFormat(fmt) {
  FORMATS[fmt.ext.toLowerCase()] = fmt;
  $('fileInput').accept = Object.keys(FORMATS).map(e => '.' + e).join(',');
}

function formatOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? (FORMATS[m[1].toLowerCase()] || null) : null;
}

/* Complete waypoint object with defaults (used by plugins) */
function makeWpt(p) {
  const w = Object.assign({
    lat: NaN, lon: NaN, ele: 0, name: '', desc: '', sym: '',
    streets: [], postal: '', city: '', country: '', phone: '', email: '', addr: '', displayMode:'', proximity: null
  }, p);
  w.addr = makeAddr(w);
  return w;
}

/* ---------- API for plugins (kml-import.js, poi-search.js, ...) ---------- */
// Adds or changes the icon for a symbol name (Garmin <sym>)
function registerSymbol(name, icon) {
  const key = String(name).toLowerCase();
  const known = SYMBOLS.find(s => s[0].toLowerCase() === key);
  if (known) known[1] = icon; else SYMBOLS.push([name, icon]);
  SYMBOL_ICON[key] = icon;
  const dl = document.getElementById('symList');                      // suggestions in the editing sidebar
  if (dl && !Array.from(dl.options).some(o => o.value.toLowerCase() === key)) dl.appendChild(new Option(name));
  files.forEach(draw);
}

// Adds a ready-made set of waypoints (and lines) as a new file in the list
function addWaypointFile(name, wpts, lines) {
  const f = {
    name,
    color: COLORS[files.length % COLORS.length],
    wpts: wpts || [],
    lines: lines || [],
    routes: [],
    group: null
  };

  files.push(f);
  draw(f);
  renderList();
  save();

  return f;
}

function removeFile(f) {
  const i = files.indexOf(f);
  if (i < 0) return;
  if (selected && selected.f === f) deselect();
  if (f.group) f.group.remove();
  files.splice(i, 1);
  renderList();
  save();
}

window.GpxMap = {
  registerFormat, makeWpt, registerSymbol, addWaypointFile, removeFile,
  getFiles: () => files, map: map, onChange: fn => { changeHooks.push(fn); }
};

function addFile(name, text) {
  const {
    wpts,
    lines,
    routes = []
  } = formatOf(name).parse(text, name);

  const f = {
    name,
    color: COLORS[files.length % COLORS.length],
    wpts,
    lines,
    routes,
    group: null
  };

  files.push(f);
  draw(f);
}

function handleFiles(fileList) {
  msg('');
  const list = Array.from(fileList).filter(f => formatOf(f.name));
  if (!list.length) { msg('Only ' + Object.keys(FORMATS).map(e => '.' + e).join(', ') + ' files are supported.'); return; }
  let pending = list.length;
  list.forEach(file => {
    const r = new FileReader();
    r.onerror = () => { msg('Could not read "' + file.name + '".'); };
    r.onload = () => {
      try { addFile(file.name, formatOf(file.name).binary ? r.result : decodeXml(r.result)); }
      catch (e) { msg(file.name + ': ' + e.message); }
      if (--pending === 0) { renderList(); fitAll(); save(); }
    };
    r.readAsArrayBuffer(file);
  });
}

/* ---------- Opslaan (optioneel) ---------- */
function save() {
  try {
    if ($('persist').checked) {
      localStorage.setItem(KEY, JSON.stringify(
  files.map(({ name, color, wpts, lines, routes }) => ({
    name,
    color,
    wpts,
    lines,
    routes: routes || []
  }))
));
      localStorage.setItem(KEY + ':on', '1');
    } else {
      localStorage.removeItem(KEY);
      localStorage.removeItem(KEY + ':on');
    }
  } catch (e) {
    msg('Saving in the browser failed (most likely too large).');
  }
}

function restore() {
  try {
    if (localStorage.getItem(KEY + ':on') !== '1') return;
    $('persist').checked = true;
    const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
    saved.forEach(s => { const f = { ...s, group: null }; files.push(f); draw(f); });
    renderList(); fitAll();
  } catch (e) { /* storage niet beschikbaar: stil negeren */ }
}

/* ---------- Exporteren als 1 GPX ---------- */
function xmlEsc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}



function buildGpx() {

  let g = '<?xml version="1.0" encoding="utf-8"?>\n';

  g += '<gpx creator="GPX POI Generator" version="1.1"\n';

  // Garmin schema locations
  g += ' xsi:schemaLocation="';
  g += 'http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd ';
  g += 'http://www.garmin.com/xmlschemas/WaypointExtension/v1 http://www8.garmin.com/xmlschemas/WaypointExtensionv1.xsd ';
  g += 'http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www8.garmin.com/xmlschemas/TrackPointExtensionv1.xsd ';
  g += 'http://www.garmin.com/xmlschemas/GpxExtensions/v3 http://www8.garmin.com/xmlschemas/GpxExtensionsv3.xsd ';
  g += 'http://www.garmin.com/xmlschemas/ActivityExtension/v1 http://www8.garmin.com/xmlschemas/ActivityExtensionv1.xsd ';
  g += 'http://www.garmin.com/xmlschemas/AdventuresExtensions/v1 http://www8.garmin.com/xmlschemas/AdventuresExtensionv1.xsd ';
  g += 'http://www.garmin.com/xmlschemas/PressureExtension/v1 http://www8.garmin.com/xmlschemas/PressureExtensionv1.xsd ';
  g += 'http://www.garmin.com/xmlschemas/TripExtensions/v1 http://www8.garmin.com/xmlschemas/TripExtensionsv1.xsd ';
  g += 'http://www.garmin.com/xmlschemas/TripMetaDataExtensions/v1 http://www8.garmin.com/xmlschemas/TripMetaDataExtensionsv1.xsd ';
  g += 'http://www.garmin.com/xmlschemas/ViaPointTransportationModeExtensions/v1 http://www8.garmin.com/xmlschemas/ViaPointTransportationModeExtensionsv1.xsd ';
  g += 'http://www.garmin.com/xmlschemas/CreationTimeExtension/v1 http://www8.garmin.com/xmlschemas/CreationTimeExtensionsv1.xsd ';
  g += 'http://www.garmin.com/xmlschemas/AccelerationExtension/v1 http://www8.garmin.com/xmlschemas/AccelerationExtensionv1.xsd ';
  g += 'http://www.garmin.com/xmlschemas/PowerExtension/v1 http://www8.garmin.com/xmlschemas/PowerExtensionv1.xsd ';
  g += 'http://www.garmin.com/xmlschemas/VideoExtension/v1 http://www8.garmin.com/xmlschemas/VideoExtensionv1.xsd';
  g += '"\n';

  // XML namespaces
  g += ' xmlns="http://www.topografix.com/GPX/1/1"\n';
  g += ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
  g += ' xmlns:wptx1="http://www.garmin.com/xmlschemas/WaypointExtension/v1"\n';
  g += ' xmlns:gpxtrx="http://www.garmin.com/xmlschemas/GpxExtensions/v3"\n';
  g += ' xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"\n';
  g += ' xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3"\n';
  g += ' xmlns:trp="http://www.garmin.com/xmlschemas/TripExtensions/v1"\n';
  g += ' xmlns:adv="http://www.garmin.com/xmlschemas/AdventuresExtensions/v1"\n';
  g += ' xmlns:prs="http://www.garmin.com/xmlschemas/PressureExtension/v1"\n';
  g += ' xmlns:tmd="http://www.garmin.com/xmlschemas/TripMetaDataExtensions/v1"\n';
  g += ' xmlns:vptm="http://www.garmin.com/xmlschemas/ViaPointTransportationModeExtensions/v1"\n';
  g += ' xmlns:ctx="http://www.garmin.com/xmlschemas/CreationTimeExtension/v1"\n';
  g += ' xmlns:gpxacc="http://www.garmin.com/xmlschemas/AccelerationExtension/v1"\n';
  g += ' xmlns:gpxpx="http://www.garmin.com/xmlschemas/PowerExtension/v1"\n';
  g += ' xmlns:vidx1="http://www.garmin.com/xmlschemas/VideoExtension/v1">\n';

  // --------------------------------------------------
  // Hierna volgen de bestaande WAYPOINTS, ROUTES
  // en TRACKS
  // --------------------------------------------------



 // ==================================================
 // 1. WAYPOINTS
 // ==================================================
 files.forEach(f => (f.wpts || []).forEach(w => {

   // Controleer coördinaten
   if (!Number.isFinite(Number(w.lat)) ||
       !Number.isFinite(Number(w.lon))) return;

   // Begin waypoint
   g += '  <wpt lat="' + Number(w.lat).toFixed(7) +
        '" lon="' + Number(w.lon).toFixed(7) + '">\n';

   // Elevation
   if (w.ele !== undefined && w.ele !== null) {
     g += '    <ele>' + (Number(w.ele) || 0) + '</ele>\n';
   }

   // Name
   if (w.name) {
     g += '    <name>' + xmlEsc(w.name) + '</name>\n';
   }

   // Description
   if (w.desc) {
     g += '    <desc>' + xmlEsc(w.desc) + '</desc>\n';
   }

   // Symbol
   if (w.sym) {
     g += '    <sym>' + xmlEsc(w.sym) + '</sym>\n';
   }

   // ==================================================
   // Controleer aanwezige extensies
   // ==================================================

   const hasProximity =
     w.proximity !== undefined &&
     w.proximity !== null &&
     w.proximity !== '' &&
     Number.isFinite(Number(w.proximity));

   const hasDisplayMode = !!w.displayMode;

   const streets = w.streets || [];

   const hasAddr =
     streets.length > 0 ||
     !!w.city ||
     !!w.state ||
     !!w.country ||
     !!w.postal;

   const hasContact =
     !!w.phone || !!w.email;

   const hasExtensions =
     hasProximity ||
     hasDisplayMode ||
     hasAddr ||
     hasContact;

   // ==================================================
   // Garmin extensions
   // Beide namespaces volledig vullen
   // ==================================================

   if (hasExtensions) {

     g += '    <extensions>\n';

     // Functie om een volledige Garmin WaypointExtension
     // op te bouwen met de opgegeven namespace.
     function appendWaypointExtension(prefix) {

       g += '      <' + prefix + ':WaypointExtension>\n';

       // Proximity
       if (hasProximity) {
         g += '        <' + prefix + ':Proximity>' +
              Number(w.proximity) +
              '</' + prefix + ':Proximity>\n';
       }

       // DisplayMode
       if (hasDisplayMode) {
         g += '        <' + prefix + ':DisplayMode>' +
              xmlEsc(w.displayMode) +
              '</' + prefix + ':DisplayMode>\n';
       }

       // Address
       if (hasAddr) {

         g += '        <' + prefix + ':Address>\n';

         // StreetAddress
         streets.forEach(s => {
           g += '          <' + prefix + ':StreetAddress>' +
                xmlEsc(s) +
                '</' + prefix + ':StreetAddress>\n';
         });

         // City
         if (w.city) {
           g += '          <' + prefix + ':City>' +
                xmlEsc(w.city) +
                '</' + prefix + ':City>\n';
         }

         // State (optioneel)
         if (w.state) {
           g += '          <' + prefix + ':State>' +
                xmlEsc(w.state) +
                '</' + prefix + ':State>\n';
         }

         // Country
         if (w.country) {
           g += '          <' + prefix + ':Country>' +
                xmlEsc(w.country) +
                '</' + prefix + ':Country>\n';
         }

         // PostalCode
         if (w.postal) {
           g += '          <' + prefix + ':PostalCode>' +
                xmlEsc(w.postal) +
                '</' + prefix + ':PostalCode>\n';
         }

         g += '        </' + prefix + ':Address>\n';
       }

       // Phone
       if (w.phone) {
         g += '        <' + prefix + ':PhoneNumber Category="Phone">' +
              xmlEsc(w.phone) +
              '</' + prefix + ':PhoneNumber>\n';
       }

       // Email
       if (w.email) {
         g += '        <' + prefix + ':Email>' +
              xmlEsc(w.email) +
              '</' + prefix + ':Email>\n';
       }

       g += '      </' + prefix + ':WaypointExtension>\n';
     }

     // 1. GpxExtensions v3
     appendWaypointExtension('gpxx');

     // 2. WaypointExtension v1
     appendWaypointExtension('wptx1');

     g += '    </extensions>\n';
   }

   // Einde waypoint
   g += '  </wpt>\n';

 }));



  // ==================================================
  // 2. ROUTES MET ROUTEPOINTS
  // ==================================================
  files.forEach(f => (f.routes || []).forEach(route => {

    if (!route.points || !route.points.length) return;

    g += '  <rte>\n';

    if (route.name) {
      g += '    <name>' + xmlEsc(route.name) + '</name>\n';
    }

    route.points.forEach(p => {

      if (!Number.isFinite(Number(p.lat)) ||
          !Number.isFinite(Number(p.lon))) return;

      g += '    <rtept lat="' + Number(p.lat).toFixed(7) +
           '" lon="' + Number(p.lon).toFixed(7) + '">\n';

      if (p.ele !== undefined && p.ele !== null) {
        g += '      <ele>' + (Number(p.ele) || 0) + '</ele>\n';
      }

      if (p.name) {
        g += '      <name>' + xmlEsc(p.name) + '</name>\n';
      }

      if (p.desc) {
        g += '      <desc>' + xmlEsc(p.desc) + '</desc>\n';
      }

      if (p.type) {
        g += '      <type>' + xmlEsc(p.type) + '</type>\n';
      }

      // Garmin routepoint extensions
      if (p.viaPoint || p.shapingPoint) {
        g += '      <extensions>\n';

        if (p.viaPoint) {
          g += '        <trp:ViaPoint/>\n';
        } else if (p.shapingPoint) {
          g += '        <trp:ShapingPoint/>\n';
        }

        g += '      </extensions>\n';
      }

      g += '    </rtept>\n';
    });

    g += '  </rte>\n';
  }));

  // ==================================================
  // 3. TRACKS
  // ==================================================
  files.forEach(f => {

    if (!f.lines || !f.lines.length) return;

    g += '  <trk>\n';

    g += '    <name>' +
         xmlEsc(f.name.replace(/\.[a-z0-9]+$/i, '')) +
         '</name>\n';

    f.lines.forEach(l => {

      if (!l || l.length < 2) return;

      g += '    <trkseg>\n';

      l.forEach(p => {
        if (!Number.isFinite(Number(p[0])) ||
            !Number.isFinite(Number(p[1]))) return;

        g += '      <trkpt lat="' + Number(p[0]).toFixed(7) +
             '" lon="' + Number(p[1]).toFixed(7) + '"></trkpt>\n';
      });

      g += '    </trkseg>\n';
    });

    g += '  </trk>\n';
  });

  return g + '</gpx>\n';
}


function exportGpx() {
  if (!files.length) return;
  const d = new Date();
  const stamp = String(d.getDate()).padStart(2, '0') + String(d.getMonth() + 1).padStart(2, '0') + d.getFullYear();
  const blob = new Blob([buildGpx()], { type: 'application/gpx+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'merged_' + stamp + '.gpx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Bewerken (zijbalk) ---------- */
let editMode = false;
let selected = null;       // { f: bestand, w: waypoint }
let mapAction = null;      // null | 'add' | 'move'

const FIELDS = [
  { k: 'name',    l: 'Name' },
  { k: 'desc',    l: 'Description', area: true },
  { k: 'sym',     l: 'Symbol' },
  { k: 'lat',     l: 'Latitude' },
  { k: 'lon',     l: 'Longitude' },
  { k: 'ele',     l: 'Elevation' },
  { k: 'proximity', l: 'Proximity (m)' },
  { k: 'street1', l: 'Street1' },
  { k: 'street2', l: 'Street2' },
  { k: 'postal',  l: 'Postalcode' },
  { k: 'city',    l: 'City' },
  { k: 'country', l: 'Country' },
  { k: 'phone',   l: 'Phone' },
  { k: 'email',   l: 'Email' }
];

const selMark = L.circleMarker([0, 0], { radius: 10, color: '#f9ab00', weight: 3, fill: false, interactive: false });

function buildForm() {
  const box = $('edFields');
  FIELDS.forEach(fd => {
    const lab = document.createElement('label');
    lab.textContent = fd.l;
    const inp = document.createElement(fd.area ? 'textarea' : 'input');
    if (fd.area) {
      inp.rows = 2;
    } else {
      inp.type = fd.k === 'proximity' ? 'number' : 'text';

      if (fd.k === 'proximity') {
        inp.min = 0;
        inp.step = 1;
      }
}
    inp.id = 'ed_' + fd.k;
    if (fd.k === 'sym') inp.setAttribute('list', 'symList');
    lab.appendChild(inp);
    box.appendChild(lab);
  });
  const clab = document.createElement('label');
  clab.textContent = 'Pin color';
  const csel = document.createElement('select');
  csel.id = 'ed_color';
  csel.add(new Option('(color of the file)', ''));
  PIN_COLORS.forEach(([v, l]) => csel.add(new Option(l, v)));
  clab.appendChild(csel);
  box.appendChild(clab);
  const dl = document.createElement('datalist');
  dl.id = 'symList';
  SYMBOLS.forEach(([n]) => dl.appendChild(new Option(n)));
  box.appendChild(dl);
}

function getVal(w, k) {
  if (k === 'street1') return (w.streets && w.streets[0]) || '';
  if (k === 'street2') return (w.streets && w.streets[1]) || '';
  return w[k] === undefined || w[k] === null ? '' : w[k];
}

function fillForm(w) {
  FIELDS.forEach(fd => { $('ed_' + fd.k).value = getVal(w, fd.k); });
  $('ed_color').value = PIN_COLORS.some(c => c[0] === w.color) ? w.color : '';
}

function makeAddr(w) {
  return [
    (w.streets || []).join(', '),
    [w.postal, w.city].filter(Boolean).join(' '),
    w.country
  ].filter(Boolean).join(', ');
}

function edMsg(t, err) { const e = $('edMsg'); e.textContent = t || ''; e.className = err ? 'err' : ''; }

function showSel() {
  if (!selected) return;
  selMark.setLatLng([selected.w.lat, selected.w.lon]);
  if (!map.hasLayer(selMark)) selMark.addTo(map);
}

function selectPoint(f, w) {
  selected = { f, w };
  setAction(null);
  fillForm(w);
  $('edHint').hidden = true;
  $('edForm').hidden = false;
  edMsg('');
  showSel();
  const ll = L.latLng(w.lat, w.lon);
  if (!map.getBounds().contains(ll)) map.panTo(ll);
}

function deselect() {
  selected = null;
  selMark.remove();
  $('edForm').hidden = true;
  $('edHint').hidden = false;
}

function setAction(a) {
  mapAction = a;
  $('map').classList.toggle('picking', !!a);
}

function applyForm() {
  if (!selected) return;
  const num = s => parseFloat(String(s).trim().replace(',', '.'));
  const lat = num($('ed_lat').value), lon = num($('ed_lon').value);
  if (isNaN(lat) || lat < -90 || lat > 90)   { edMsg('Latitude must be a number between -90 and 90.', true); return; }
  if (isNaN(lon) || lon < -180 || lon > 180) { edMsg('Longitude must be a number between -180 and 180.', true); return; }

  const v = k => $('ed_' + k).value.trim();
  const w = selected.w;
  w.lat = lat;
  w.lon = lon;
  w.ele = num(v('ele')) || 0;

  // Garmin Proximity
  const proximityText = v('proximity');
  const proximity = proximityText === '' ? null : num(proximityText);

  if (proximity !== null && (!Number.isFinite(proximity) || proximity < 0)) {
    edMsg('Proximity must be a valid non-negative number.', true);
    return;
  }

  w.proximity = proximity;

  w.name = v('name');
  w.desc = v('desc');
  w.sym = v('sym');
  w.streets = [v('street1'), v('street2')].filter(Boolean);
  w.postal = v('postal'); w.city = v('city'); w.country = v('country');
  w.phone = v('phone'); w.email = v('email');
  w.color = $('ed_color').value;
  w.addr = makeAddr(w);

  draw(selected.f);
  renderList();
  showSel();
  save();
  edMsg('Saved.');
}

function deletePoint() {
  if (!selected) return;
  if (!confirm('Delete this point?')) return;
  const { f, w } = selected;
  f.wpts.splice(f.wpts.indexOf(w), 1);
  deselect();
  draw(f);
  renderList();
  save();
}

function fillTargets() {
  const sel = $('edTarget');
  const prev = sel.value;
  sel.innerHTML = '';
  if (!files.length) {
    sel.add(new Option('New file', '-1'));
  } else {
    files.forEach((f, i) => sel.add(new Option(f.name, String(i))));
    if (prev && Number(prev) < files.length) sel.value = prev;
  }
}

function onMapClickEdit(e) {
  if ( !mapAction) return;
    // POI verplaatsen vanuit de popup
  if (mapAction === 'movePoi' && movingPoi) {
    const { file, waypoint } = movingPoi;

    if (!files.includes(file) || !file.wpts.includes(waypoint)) {
      movingPoi = null;
      setAction(null);
      msg('POI niet meer gevonden.');
      return;
    }

    waypoint.lat = +e.latlng.lat.toFixed(6);
    waypoint.lon = +e.latlng.lng.toFixed(6);

    // Verwijder de tijdelijke verplaatsstatus
    movingPoi = null;
    setAction(null);

    // Laag opnieuw tekenen en gegevens opslaan
    draw(file);
    renderList();
    save();

    msg('POI succesvol verplaatst.');
    return;
  }

  // De overige kaartacties alleen in de bewerkmodus
  if (!editMode) return;
  const lat = +e.latlng.lat.toFixed(6), lon = +e.latlng.lng.toFixed(6);

  if (mapAction === 'add') {
    let f = files[Number($('edTarget').value)];
    if (!f) {
      f = { name: 'New points.gpx', color: COLORS[files.length % COLORS.length], wpts: [], lines: [], routes:[], group: null };
      files.push(f);
    }
    const w = { lat, lon, ele: 0, name: 'New point', desc: '', sym: '', streets: [], postal: '', city: '', country: '', phone: '', email: '', addr: '' };
    f.wpts.push(w);
    draw(f);
    renderList();
    save();
    selectPoint(f, w);
  } else if (mapAction === 'move' && selected) {
    selected.w.lat = lat; selected.w.lon = lon;
    fillForm(selected.w);
    draw(selected.f);
    showSel();
    save();
    setAction(null);
    edMsg('Point moved.');
  }
}

/* ---------- Adres uit coordinaten (Nominatim / OpenStreetMap) ---------- */
const NOMINATIM_LANG = 'en';   // taal van plaats- en provincienamen (bijv. 'nl', 'de', 'it')

async function addressFromPosition() {
  const num = s => parseFloat(String(s).trim().replace(',', '.'));
  const lat = num($('ed_lat').value), lon = num($('ed_lon').value);
  if (isNaN(lat) || isNaN(lon)) { edMsg('Please enter valid Latitude and Longitude.', true); return; }

  const btn = $('edGeo');
  btn.disabled = true;
  edMsg('Looking up address…');
  try {
    const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18' +
      '&accept-language=' + encodeURIComponent(NOMINATIM_LANG) +
      '&lat=' + lat + '&lon=' + lon;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Server returned status ' + res.status);
    const data = await res.json();
    if (data.error || !data.address) { edMsg('No address found for this position.', true); return; }

    const a = data.address;
    const road = a.road || a.pedestrian || a.footway || a.path || a.cycleway || a.hamlet || '';
    const street = [road, a.house_number].filter(Boolean).join(' ');
    const place = a.city || a.town || a.village || a.municipality || a.hamlet || '';
    const region = a.state || a.region || '';
    const city = place + (region ? (place ? ' ' : '') + '(' + region + ')' : '');

    $('ed_street1').value = street;
    $('ed_street2').value = '';
    $('ed_postal').value = a.postcode || '';
    $('ed_city').value = city;
    $('ed_country').value = (a.country_code || '').toUpperCase();
    edMsg('Address filled in. Click Save to store it.');
  } catch (e) {
    edMsg('Failed to look up address: ' + e.message, true);
  } finally {
    btn.disabled = false;
  }
}

/* Bewerken-knop in de kaart */
const EditControl = L.Control.extend({
  options: { position: 'topleft' },
  onAdd: function () {
    const b = L.DomUtil.create('button', 'leaflet-bar edit-toggle');
    b.type = 'button';
    b.textContent = '✏️ Edit';
    L.DomEvent.disableClickPropagation(b);
    L.DomEvent.on(b, 'click', () => setEdit(!editMode));
    this._btn = b;
    return b;
  }
});
const editControl = new EditControl().addTo(map);

function setEdit(on) {
  editMode = on;
  document.body.classList.toggle('editing', on);
  editControl._btn.classList.toggle('on', on);
  if (!on) { setAction(null); deselect(); edMsg(''); }
  map.invalidateSize();
}

buildForm();
fillTargets();
map.on('click', onMapClickEdit);
$('edSave').addEventListener('click', applyForm);
$('edGeo').addEventListener('click', addressFromPosition);
$('edDel').addEventListener('click', deletePoint);
$('edMove').addEventListener('click', () => { setAction('move'); edMsg('Click on the map for the new position (Esc = cancel).'); });
$('edAdd').addEventListener('click', () => { setAction('add'); edMsg('Click on the map to place a new point (Esc = cancel).'); });
$('edClose').addEventListener('click', () => setEdit(false));
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && mapAction) {
    movingPoi = null;
    setAction(null);
    msg('');
    edMsg('');
  }
});

/* ---------- Events ---------- */
$('persist').addEventListener('change', save);
$('export').addEventListener('click', exportGpx);
$('pick').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });
$('clear').addEventListener('click', () => {
  files.forEach(f => f.group && f.group.remove());
  files = []; deselect(); renderList(); save(); msg('');
});

let depth = 0;
window.addEventListener('dragenter', e => { e.preventDefault(); depth++; $('overlay').classList.add('on'); });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('dragleave', e => { e.preventDefault(); if (--depth <= 0) { depth = 0; $('overlay').classList.remove('on'); } });
window.addEventListener('drop', e => {
  e.preventDefault(); depth = 0; $('overlay').classList.remove('on');
  handleFiles(e.dataTransfer.files);
});

restore();

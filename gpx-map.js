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

/* ---------- Lagen-popup ---------- */
var baseMaps = {
  "Humanitarian (HOT)": hot,
  "TopPlusOpen Color": TopPlusOpen_Color,
  "Topografisch (OpenTopoMap)": topo,
  "Satellite": satellite
};

hot.addTo(map);   // standaardlaag
L.control.layers(baseMaps, null, {
  position: 'topleft',
  collapsed: true
}).addTo(map);

/* ---------- GPX-logica ---------- */
const COLORS = ['#d93025', '#1a73e8', '#188038', '#e37400', '#9334e6', '#00838f'];
const KEY = 'gpxMapFiles';
let files = [];            // [{name, color, wpts:[], lines:[[[lat,lon],...]], group}]

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
  if (doc.querySelector('parsererror')) throw new Error('This is no valid GPX-file.');

  const first = (el, n) => descendants(el, n)[0]?.textContent.trim() || '';
  const wpts = Array.from(doc.getElementsByTagName('wpt')).map(w => {
    const streets = descendants(w, 'StreetAddress').map(e => e.textContent.trim()).filter(Boolean);
    const postal = first(w, 'PostalCode');
    const city = first(w, 'City');
    const country = first(w, 'Country');
    const addr = [
      streets.join(', '),
      [postal, city].filter(Boolean).join(' '),
      country
    ].filter(Boolean).join(', ');
    return {
      lat: parseFloat(w.getAttribute('lat')),
      lon: parseFloat(w.getAttribute('lon')),
      ele: parseFloat(childText(w, 'ele')) || 0,
      name: childText(w, 'name'),
      desc: childText(w, 'desc'),
      sym: childText(w, 'sym'),
      streets, postal, city, country,
      phone: first(w, 'PhoneNumber'),
      email: first(w, 'Email'),
      addr
    };
  }).filter(w => !isNaN(w.lat) && !isNaN(w.lon));

  const pts = els => els.map(p => [parseFloat(p.getAttribute('lat')), parseFloat(p.getAttribute('lon'))])
                        .filter(p => !isNaN(p[0]) && !isNaN(p[1]));
  const lines = [];
  Array.from(doc.getElementsByTagName('trkseg')).forEach(seg => {
    const l = pts(Array.from(seg.getElementsByTagName('trkpt')));
    if (l.length > 1) lines.push(l);
  });
  Array.from(doc.getElementsByTagName('rte')).forEach(r => {
    const l = pts(Array.from(r.getElementsByTagName('rtept')));
    if (l.length > 1) lines.push(l);
  });

  if (!wpts.length && !lines.length) throw new Error('No waypoints, tracks or routes found.');
  return { wpts, lines };
}

/* ---------- Tekenen ---------- */
function popupHtml(w) {
  const div = document.createElement('div');
  const add = (tag, text) => { if (!text) return; const e = document.createElement(tag); e.textContent = text; div.appendChild(e); };
  add('b', w.name);
  add('div', w.desc);
  add('small', w.addr);
  return div;
}

function draw(f) {
  if (f.group) f.group.remove();
  f.group = L.featureGroup().addTo(map);
  f.lines.forEach(l => L.polyline(l, { color: f.color, weight: 4, opacity: .85 }).addTo(f.group));
  f.wpts.forEach(w => {
    const m = L.marker([w.lat, w.lon], {
      icon: makeIcon(f, w)
    }).bindPopup(() => popupHtml(w)).bindTooltip(() => w.name || '', { direction: 'top' }).addTo(f.group);
    m.on('click', () => { if (editMode) { m.closePopup(); selectPoint(f, w); } });
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
    ct.className = 'ct'; ct.textContent = f.wpts.length + ' points' + (f.lines.length ? ', ' + f.lines.length + ' lines' : '');
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
}

function fitAll() {
  const g = L.featureGroup(files.map(f => f.group).filter(Boolean));
  if (g.getLayers().length) map.fitBounds(g.getBounds().pad(.1));
}

/* ---------- Bestanden toevoegen ---------- */
function addFile(name, text) {
  const { wpts, lines } = parseGpx(text);
  const f = { name, color: COLORS[files.length % COLORS.length], wpts, lines, group: null };
  files.push(f);
  draw(f);
}

function handleFiles(fileList) {
  msg('');
  const list = Array.from(fileList).filter(f => /\.gpx$/i.test(f.name));
  if (!list.length) { msg('Only .gpx files are supported.'); return; }
  let pending = list.length;
  list.forEach(file => {
    const r = new FileReader();
    r.onerror = () => { msg('Could not read "' + file.name + '".'); };
    r.onload = () => {
      try { addFile(file.name, decodeXml(r.result)); }
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
      localStorage.setItem(KEY, JSON.stringify(files.map(({ name, color, wpts, lines }) => ({ name, color, wpts, lines }))));
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
  let g = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n';
  g += '<gpx xmlns="http://www.topografix.com/GPX/1/1" ' +
       'xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3" ' +
       'creator="GPX POI Editor" version="1.1">\n';

  // eerst alle waypoints van alle bestanden
  files.forEach(f => f.wpts.forEach(w => {
    g += '  <wpt lat="' + w.lat.toFixed(6) + '" lon="' + w.lon.toFixed(6) + '">\n';
    g += '    <ele>' + (w.ele || 0) + '</ele>\n';
    if (w.name) g += '    <name>' + xmlEsc(w.name) + '</name>\n';
    if (w.desc) g += '    <desc>' + xmlEsc(w.desc) + '</desc>\n';
    if (w.sym)  g += '    <sym>' + xmlEsc(w.sym) + '</sym>\n';

    const streets = w.streets || [];
    const hasAddr = streets.length || w.postal || w.city || w.country;
    if (hasAddr || w.phone || w.email) {
      g += '    <extensions>\n      <gpxx:WaypointExtension>\n';
      if (hasAddr) {
        g += '        <gpxx:Address>\n';
        streets.forEach(s => { g += '          <gpxx:StreetAddress>' + xmlEsc(s) + '</gpxx:StreetAddress>\n'; });
        if (w.postal)  g += '          <gpxx:PostalCode>' + xmlEsc(w.postal) + '</gpxx:PostalCode>\n';
        if (w.city)    g += '          <gpxx:City>' + xmlEsc(w.city) + '</gpxx:City>\n';
        if (w.country) g += '          <gpxx:Country>' + xmlEsc(w.country) + '</gpxx:Country>\n';
        g += '        </gpxx:Address>\n';
      }
      if (w.phone) g += '        <gpxx:PhoneNumber Category="Phone">' + xmlEsc(w.phone) + '</gpxx:PhoneNumber>\n';
      if (w.email) g += '        <gpxx:Email>' + xmlEsc(w.email) + '</gpxx:Email>\n';
      g += '      </gpxx:WaypointExtension>\n    </extensions>\n';
    }
    g += '  </wpt>\n';
  }));

  // daarna de tracks: per bestand één <trk>, elke lijn een <trkseg>
  files.forEach(f => {
    if (!f.lines.length) return;
    g += '  <trk>\n    <name>' + xmlEsc(f.name.replace(/\.gpx$/i, '')) + '</name>\n';
    f.lines.forEach(l => {
      g += '    <trkseg>\n';
      l.forEach(p => { g += '      <trkpt lat="' + p[0] + '" lon="' + p[1] + '"></trkpt>\n'; });
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
    if (fd.area) inp.rows = 2; else inp.type = 'text';
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
  w.lat = lat; w.lon = lon;
  w.ele = num(v('ele')) || 0;
  w.name = v('name'); w.desc = v('desc'); w.sym = v('sym');
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
  if (!editMode || !mapAction) return;
  const lat = +e.latlng.lat.toFixed(6), lon = +e.latlng.lng.toFixed(6);

  if (mapAction === 'add') {
    let f = files[Number($('edTarget').value)];
    if (!f) {
      f = { name: 'New points.gpx', color: COLORS[files.length % COLORS.length], wpts: [], lines: [], group: null };
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
    if (!res.ok) throw new Error('Server gavestatus ' + res.status);
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
window.addEventListener('keydown', e => { if (e.key === 'Escape' && mapAction) { setAction(null); edMsg(''); } });

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

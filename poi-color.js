
/* =====================================================
   POI COLOR ADD-ON
   Automatische kleurtoekenning aan bekende waypoints
   ===================================================== */

(function () {
  'use strict';

  const STORAGE_KEY = 'gpxMapAutoPinColors';

  // Kleuren per bekend GPX-symbool
  const SYMBOL_COLORS = {
    'hotel': 'blue',
    'lodging': 'blue',
    'restaurant': 'red',
    'bar': 'darkred',
    'cafe': 'orange',
    'campground': 'darkgreen',
    'summit': 'darkpurple',
    'scenic area': 'purple',
    'parking area': 'gray',
    'gas station': 'darkred',
    'information': 'cadetblue',
    'shopping center': 'orange',
    'museum': 'purple',
    'bike trail': 'green',
    'bicycle': 'green',
    'motorcycle': 'darkblue',
    'water': 'blue',
    'drinking water': 'blue',
    'flag': 'red',
    'pin': 'cadetblue',
    'restroom': 'purple',
    'picnic area': 'green',
    'car': 'cadetblue'
  };

  // Woorden waarop gezocht wordt als het symbool onbekend is
  const NAME_RULES = [
    { words: ['restaurant', 'food', 'eetcafe'], color: 'red' },
    { words: ['hotel', 'lodging', 'hostel'], color: 'blue' },
    { words: ['camping', 'campground'], color: 'darkgreen' },
    { words: ['museum'], color: 'purple' },
    { words: ['parking', 'parkplatz'], color: 'gray' },
    { words: ['gas station', 'fuel', 'tankstation'], color: 'darkred' },
    { words: ['cafe', 'coffee', 'bakery', 'bakkerij'], color: 'orange' },
    { words: ['bar', 'pub'], color: 'darkred' },
    { words: ['water', 'drinking water'], color: 'blue' },
    { words: ['toilet', 'restroom', 'wc'], color: 'purple' },
    { words: ['bicycle', 'bike shop', 'fietsenmaker'], color: 'green' },
    { words: ['shopping', 'supermarket', 'supermarkt'], color: 'orange' },
    { words: ['viewpoint', 'scenic', 'uitzicht'], color: 'purple' },
    { words: ['information', 'info'], color: 'cadetblue' },
    { words: ['shelter', 'picnic'], color: 'green' }
  ];

  let enabled = false;

  function normalize(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function isKnownColor(color) {
    return GpxMap.getPinColors().includes(color);
  }

  function getAutomaticColor(w) {

    // 1. Eerst het GPX-symbool controleren
    const sym = normalize(w.sym);

    if (sym && SYMBOL_COLORS[sym]) {
      return SYMBOL_COLORS[sym];
    }

    // 2. Als het symbool onbekend is: de naam controleren
    const name = normalize(w.name);

    for (const rule of NAME_RULES) {
      if (rule.words.some(word => name.includes(normalize(word)))) {
        return rule.color;
      }
    }

    // 3. Niet herkend: geen eigen kleur instellen
    return null;
  }

  function colorWaypoints(wpts, source) {

    if (!enabled) return;

    wpts.forEach(w => {

      // Bestaande kleur behouden.
      // Dit is belangrijk voor de kleuren uit POI Search.
      if (w.color && isKnownColor(w.color)) return;

      const color = getAutomaticColor(w);

      if (color && isKnownColor(color)) {
        w.color = color;
      }
    });
  }

  // Optie naast Remember in this Browser plaatsen
  function createOption() {

    const persist = document.getElementById('persist');

    if (!persist || document.getElementById('autoPinColors')) return;

    const oldLabel = persist.closest('label') || persist.parentElement;

    const label = document.createElement('label');
    label.style.display = 'inline-flex';
    label.style.alignItems = 'center';
    label.style.gap = '5px';
    label.style.marginLeft = '10px';
    label.style.cursor = 'pointer';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'autoPinColors';
    checkbox.checked = enabled;

    const text = document.createElement('span');
    text.textContent = 'Color known symbols';

    label.append(checkbox, text);
    oldLabel.insertAdjacentElement('afterend', label);

    checkbox.addEventListener('change', () => {
      enabled = checkbox.checked;

      try {
        localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
      } catch (e) {
        console.warn('Could not save color preference.', e);
      }
    });
  }

  // Instelling onafhankelijk van Remember in this Browser laden
  try {
    enabled = localStorage.getItem(STORAGE_KEY) === '1';
  } catch (e) {
    enabled = false;
  }

  // Registreren bij de GPX-kaart
  if (!window.GpxMap || !GpxMap.onWaypointsAdded) {
    console.error('POI Color: GpxMap API not available.');
    return;
  }

  GpxMap.onWaypointsAdded(colorWaypoints);

  createOption();

})();

# GPX-POI-Editor

A simple web page (Leaflet) for viewing, editing and exporting GPX files. You load one or more GPX files, see the waypoints, tracks and routes on the map, edit points in a sidebar, and export everything as one new GPX file.

Everything runs locally in your browser. No server is needed and your files are not sent anywhere (except for the optional address lookup, see [Address from coordinates](#address-from-coordinates)).

> **Note:** the page's interface is in Dutch. Button and label names are shown below exactly as they appear on screen, with the English meaning in parentheses where it helps.

## Files

| File | Contents |
|---|---|
| `gpx_leaflet_map.html` | The page itself: structure, panel and sidebar |
| `gpx-map.css` | All styling |
| `gpx-map.js` | All logic: map, loading, editing, exporting |
| LICENSE | MIT License |
|README | This File | 

Put the three files in the same folder and open `gpx_leaflet_map.html` in your browser. Double-clicking (`file://`) works.

**An internet connection is required** for Leaflet, Font Awesome, the Awesome Markers plugin and the map tiles. They are loaded from external servers.

## Quick start

1. Open `gpx_leaflet_map.html`.
2. Click **Choose file…** or drag one or more `.gpx` files onto the map.
3. The map zooms to your data.
4. Click **✏️ Edit** to change points, or **Export as 1 GPX** (Export as 1 GPX) to save everything.

## Loading GPX files

- You can select or drag several files at once. Each file gets its own colour (the first six colours repeat in turn).
- **Waypoints** (`<wpt>`), **tracks** (`<trk>`/`<trkseg>`) and **routes** (`<rte>`) are supported.
- The character encoding (for example ISO-8859-1 or UTF-8) is read from the XML header, so characters such as ä, ö, ü and è stay intact.
- Garmin address data (`gpxx:WaypointExtension`: street, postal code, city, country, phone, email) is read and shown in the popup and the sidebar.
- An invalid file, or a file without points or lines, produces a message in the panel. Other files loaded at the same time are still processed.

## The panel (top right)

| Element | What it does |
|---|---|
| **Choose file…** | Opens the file picker (multiple files allowed) |
| **Remember in this browser** (Remember in this browser) | Stores the loaded data in the browser, see [Browser storage](#browser-storage) |
| **File list** | Per file: colour, name, number of points and lines. Click the name to zoom to that file. Click **×** to remove the file from the map |
| **Export as 1 GPX** | Merges everything and downloads it, see [Exporting](#exporting) |
| **Clear all** | Removes all files from the map |

The **Export as 1 GPX** and **Clear all** buttons only appear once at least one file is loaded.

## Map layers

At the top left there is a layers button (below the zoom buttons). Use it to choose the background map:

- **Humanitarian (HOT)**: default layer
- **TopPlusOpen Color**
- **Topografisch (OpenTopoMap)**: handy for cycling and mountain routes
- **Satellite** (Esri)

To add a layer, create an `L.tileLayer(...)` in `gpx-map.js` under `/* ---------- Tile-lagen ---------- */` and include it in `baseMaps`.

## Pins, icons and legend

Points are shown as pins (Leaflet Awesome Markers):

- **The icon** comes from the point's **Symbol** field. For example `Hotel` gives a bed. An unknown or empty symbol gives a plain pin.
- **The colour** comes from the file, unless you pick your own colour for a point (see [Edit mode](#edit-mode)).
- Hovering over a pin shows its name. Clicking it (outside edit mode) opens a popup with name, description and address.

**Legend** (bottom left): shows the symbols present on the map, with the number of points per symbol, for example `Hotel (40)`. The legend updates with every change. It does not show colours; you can see those in the panel.

### Known symbols

| Symbol | Icon | Symbol | Icon |
|---|---|---|---|
| Hotel, Lodging | bed | Museum | university |
| Restaurant | cutlery | Bike Trail, Bicycle | bicycle |
| Bar | beer | Motorcycle | motorcycle |
| Cafe | coffee | Water | tint |
| Campground | tree | Flag | flag |
| Summit | flag | Pin | map-marker |
| Scenic Area | camera | Gas Station | tint |
| Parking Area | car | Information | info |
| Shopping Center | shopping-cart | | |

Case does not matter (`hotel` works too).

## Edit mode

Click **✏️ Edit** at the top left. The button turns blue and a sidebar slides open on the left. Click the button again (or the **×** in the sidebar) to close edit mode.

While edit mode is on, clicking a pin does not open a popup but selects the point. The selected point gets a yellow ring around the tip of the pin.

### Fields

| Field | Meaning |
|---|---|
| Name | Name of the point |
| Description | Description |
| Symbol | Determines the icon (with suggestions in a dropdown) |
| Latitude / Longitude | Position in decimal degrees (comma or dot, for example `46,286468`) |
| Elevation | Elevation in metres (empty becomes `0`) |
| Street1 / Street2 | Street and house number (and optionally a second line) |
| Postalcode, City, Country | Postal code, city, country |
| Phone, Email | Contact details |
| Kleur van de pin (Pin colour) | A colour of its own for this point, or "(kleur van het bestand)" (colour of the file) |

Changes are only applied when you click **Save**. Latitude must be between -90 and 90 and Longitude between -180 and 180, otherwise an error message appears.

### Sidebar buttons

| Button | What it does |
|---|---|
| **➕ New Point** | Then click on the map to place a point. Choose the file in the dropdown next to it. If no file is loaded yet, a new file is created |
| **Save** | Applies the fields to the point |
| **🏷️ Address from coordinates** | Fills in the address automatically, see below |
| **📍 Move on map** | Then click on the map for the new position |
| **Delete** | Deletes the point (with confirmation) |
| **Esc** (key) | Cancels "New point" or "Move" |

### Address from coordinates

The **🏷️ Address from coordinate** button reads Latitude and Longitude from the sidebar and looks up the address through **Nominatim** (OpenStreetMap):

- Street1 becomes street plus house number, for example `Via Templari 51`.
- Street2 is cleared.
- City gets the province or state in brackets, for example `Panchià (Trentino-Alto Adige)`.
- Country becomes the two-letter country code, for example `IT`, `AT` or `DE`.

The fields are only filled in, not saved. Check the result and then click **Save**.

Please note:

- This is the only function that sends data out: the coordinates go to `nominatim.openstreetmap.org`.
- Nominatim allows ordinary use per point, but no more than one request per second and no bulk processing.
- The language of place and province names is set with `NOMINATIM_LANG` in `gpx-map.js` (default `'en'`, for example `'de'`, `'it'` or `'nl'`).
- At places without an address (forest, lake) you get the message "Geen adres gevonden voor deze positie" (No address found for this position). For remote locations the house number may be missing.

## Exporting

The **Export as 1 GPX** button merges all loaded files into one file named `samengevoegd_DDMMYYYY.gpx` (with today's date; *samengevoegd* means merged).

- **Waypoints**: all waypoints from all files, with name, description, symbol, elevation and the Garmin address data.
- **Tracks**: one `<trk>` per file, with the file name as its name. Each line is a `<trkseg>`.
- **Routes** from an input file become tracks in the export.
- The file is UTF-8.
- Files you removed from the map are not in the export. Changes made in edit mode are.
- The **custom pin colour** is not in the export, because GPX has no standard field for it. After loading the file again, pins are coloured per file again.

## Browser storage

With **Remember in browser**, the page stores the loaded data in your browser's `localStorage`, so it is still there after closing the page.

- Per file, the name, colour, points (including edits and custom pin colour) and lines are stored, not the original GPX file.
- If you untick the box, everything that was stored is deleted again.
- The storage only applies to this browser on this device and is tied to the address of the page. Another device, another browser or a private window will not see it.
- The limit is about 5 MB. With too much data you get the message "Opslaan in de browser is niet gelukt" (Saving in the browser failed).
- Clearing site data in your browser also removes this storage.
- Data stored with an older version of the page lacks the separate address fields. Load such files again once.

## Customising

Everything below is in `gpx-map.js`.

| What | Where |
|---|---|
| Add or remove map layers | `/* ---------- Tile-lagen ---------- */` and `baseMaps` |
| Start position and zoom of the map | `L.map('map', { center: ..., zoom: ... })` |
| Symbols and icons | `SYMBOLS` (name and [Font Awesome 4](https://fontawesome.com/v4/icons/) icon) |
| Colours per file | `COLORS` (panel) and `AWESOME_COLORS` (pins), in the same order |
| Address language | `NOMINATIM_LANG` |

Adjust the look in `gpx-map.css`.

## Limitations

- Only waypoints can be edited. Tracks and routes can be loaded, shown and exported, but not changed.
- A point cannot be moved to another file.
- The sidebar fields are plain text fields with no validation of, for example, postal codes or symbol names.
- Font Awesome 4 has a limited icon set. There is no mountain or tent, for example.
- Heavy use of the map tiles is subject to the providers' usage policies (for example OpenStreetMap). For intensive or public use, your own tile provider or an API key is recommended.

## Libraries used

- [Leaflet](https://leafletjs.com/) 1.9.4
- [Leaflet.awesome-markers](https://github.com/lvoogdt/Leaflet.awesome-markers) 2.0.2
- [Font Awesome](https://fontawesome.com/v4/) 4.7.0
- Map data: OpenStreetMap, OpenTopoMap, Esri, and TopPlusOpen (BKG)
- Address lookup: [Nominatim](https://nominatim.org/)

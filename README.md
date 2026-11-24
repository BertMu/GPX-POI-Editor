# GPX POI Editor

A browser-based Leaflet application for viewing, editing and exporting GPX files. You can load multiple GPX files, view waypoints, tracks and routes on the map, edit waypoints in a sidebar and export the supported data as one GPX file.

<<<<<<< HEAD
Most processing takes place locally in the browser. The optional reverse address lookup sends coordinates to the Nominatim service; map tiles and JavaScript libraries are also loaded from external servers.

> **Implementation note:** this README was checked against the available `gpx-map(1).js` source version. Some recently discussed improvements (editing and exporting Garmin Proximity, and exporting route points) are not yet present in that source version. They are identified below rather than described as completed features.
=======
Everything runs locally in your browser. No server is needed and your files are not sent anywhere (except for the optional address lookup, see [Address from coordinates](#address-from-coordinates)), and getting the POI from the Overpass API.
>>>>>>> a7a256361879b045569512f6d67969565321d18f

## Files

The application consists of an HTML page, a stylesheet and the main JavaScript file:

| File | Contents |
|---|---|
<<<<<<< HEAD
| `gpx_leaflet_map.html` | Page structure, map container, panel and editing sidebar |
| `gpx-map.css` | Styling for the map, panel, legend and sidebar |
| `gpx-map.js` | Map layers, GPX parsing, drawing, editing, browser storage and GPX export |

The main JavaScript file also exposes an API (`window.GpxMap`) that can be used by add-on scripts to register additional formats, symbols and waypoint collections.
=======
| `index.html` | The page itself: structure, panel and sidebar |
| `gpx-map.css` | All styling |
| `gpx-map.js` | All logic: map, loading, editing, exporting |
| 'kml-import.js'| All logic: importing KML files |
| 'poi-core.js'| Core file for POI handeling |
| 'poi-search " | Poi searchin logic |

Put the  files in the same folder and open `index.html` in your browser. Double-clicking (`file://`) works.
>>>>>>> a7a256361879b045569512f6d67969565321d18f

Keep the files in the arrangement expected by the HTML page. Open the HTML page in a modern browser. An internet connection is required for Leaflet, Leaflet Awesome Markers, Font Awesome, map tiles and the optional Nominatim lookup.

## Quick start

<<<<<<< HEAD
1. Open `index.html`.
2. Select one or more `.gpx` files with the file picker, or drag the files onto the map.
3. The map zooms to the loaded data.
4. Click a waypoint to view its popup.
5. Enable **Edit** to add, move, change or delete waypoints.
6. Use **Export as 1 GPX** to download the supported data as one GPX file.
=======
1. Open `gpx_leaflet_map.html`.
2. Click **Choose file…** or drag one or morefiles o nto the map.
3. The map zooms to your data.
4. Click **✏️ Edit** to change points, or **Export as 1 GPX** to save everything.
>>>>>>> a7a256361879b045569512f6d67969565321d18f

## Loading GPX -KML or GPI files

- Multiple GPX files can be selected or dragged onto the map.
- Each loaded file gets its own colour. The six file colours are reused in sequence.
- The parser recognises:
  - Waypoints: `<wpt>`
  - Tracks and track segments: `<trk>`, `<trkseg>` and `<trkpt>`
  - Routes and route points: `<rte>` and `<rtept>`
- The XML character encoding is read from the XML declaration where possible. UTF-8 is used as the fallback.
- Garmin waypoint address fields are read from `gpxx:WaypointExtension`, including street address, postal code, city, country, phone number and email address.
- Garmin waypoint `DisplayMode` and `Proximity` values are read from extensions. They are shown in the waypoint popup when present.
- Route point extensions are checked for `ViaPoint` and `ShapingPoint`. These route point types are retained in the loaded route data and are displayed differently on the map.
- A file that cannot be parsed produces an error message. Other files selected at the same time can still be processed.

## The panel

The panel lists the loaded files.

| Element | What it does |
|---|---|
<<<<<<< HEAD
| File picker | Selects one or more supported files |
| Remember in this browser | Stores loaded data in the browser's `localStorage` |
| File list | Shows each file's colour, name and counts for waypoints, route points and tracks |
| File name | Click to zoom the map to that file |
| `×` | Removes that file from the map |
| Export as 1 GPX | Exports the supported data from all loaded files |
| Clear all | Removes all loaded files from the map |

The export and clear buttons are only available when files have been loaded.
=======
| **Choose file** | Opens the file picker (multiple files allowed) |
| **Remember in this browser** (Remember in this browser) | Stores the loaded data in the browser, see [Browser storage](#browser-storage) |
| **File list** | Per file: colour, name, number of points and lines. Click the name to zoom to that file. Click **×** to remove the file from the map |
| **Export als 1 GPX** | Merges everything and downloads it, see [Exporting](#exporting) |
| **Export as GPI** | Downloads the POI as a Garmin GPI file
| **Clear all** | Removes all files from the map |

The **Export al 1 GPX**, **Export as GPI** and **clear all** buttons only appear once at least one file is loaded.
>>>>>>> a7a256361879b045569512f6d67969565321d18f

## Map layers

Use the layers control in the top-left corner of the map. It separates base maps from overlays.

<<<<<<< HEAD
### Base maps
=======
- **Outdoors (OSM)**: default layer
- **CycleOSM**: handy for cycling and mountain routes
- **Humanitarian (HOT)**
- **TopPlusOpen Color**
- **Topografisch (OpenTopoMap)**
- **Satellite** (Esri)

Two overlay maps Waymarked Trails can be used with the basemaps

- **Waymarked Trails - Hiking**
- **Waymarked Trails - Cycling**
>>>>>>> a7a256361879b045569512f6d67969565321d18f

- **OpenStreetMap** — standard map and default layer
- **CycleOSM** — cycling-oriented map
- **Humanitarian (HOT)** — humanitarian OpenStreetMap style
- **TopPlusOpen Color** — TopPlusOpen map
- **Topografisch (OpenTopoMap)** — topographic map
- **Satellite** — Esri satellite imagery

Only one base map can be active at a time.

### Overlays

- **Waymarked Trails - wandelen** — hiking route network
- **Waymarked Trails - fietsen** — cycling route network

Overlays can be switched on independently and can be combined with a base map. They are map overlays; they do not change the GPX data.

To add or change layers, edit the tile-layer definitions and the `baseMaps` / `overlayMaps` objects in `gpx-map.js`, in the `Tile-lagen` section.

## Waypoints, icons and legend

Waypoints are displayed using Leaflet Awesome Markers.

- **Icon:** based on the waypoint's GPX `<sym>` value. Known symbols are mapped to Font Awesome 4 icons. Unknown or empty symbols use a standard map marker.
- **Colour:** uses the colour assigned to the loaded file unless the waypoint has its own pin colour.
- **Tooltip:** hovering over a waypoint displays its name.
- **Popup:** clicking a waypoint displays available name, description and address information. Garmin `DisplayMode` and `Proximity` values are also shown when present.

### Route points

Route points are drawn separately from ordinary waypoints:

- The route itself is drawn as a dashed line.
- A `ViaPoint` is shown as a larger red circle.
- A `ShapingPoint` is shown as a smaller blue circle.
- Other route points use the file colour.

Clicking a route point opens its popup. Route points are not edited through the waypoint editing sidebar.

### Legend

The legend in the bottom-left corner lists the waypoint symbols found in the loaded files and shows the number of waypoints for each symbol. It updates when the loaded data changes. It does not show file colours.

### Known waypoint symbols

| GPX symbol | Icon |
|---|---|
| Hotel, Lodging | bed |
| Restaurant | cutlery |
| Bar | beer |
| Cafe | coffee |
| Campground | tree |
| Summit, Flag | flag |
| Scenic Area | camera |
| Parking Area | car |
| Gas Station, Water | tint |
| Information | info |
| Shopping Center | shopping-cart |
| Museum | university |
| Bike Trail, Bicycle | bicycle |
| Motorcycle | motorcycle |
| Pin | map-marker |

Symbol matching is case-insensitive. Additional symbols can be registered by an add-on script using `GpxMap.registerSymbol(name, icon)`.

## Edit mode

<<<<<<< HEAD
Click the **Edit** control on the map to open the editing sidebar. Click it again, or use the close control in the sidebar, to leave edit mode.
=======
Click **✏️ Edit** at the top left. The button turns blue and a sidebar slides open on the left. Click the button again (or the **×** in the sidebar) to close edit mode.
>>>>>>> a7a256361879b045569512f6d67969565321d18f

When edit mode is active, clicking an ordinary waypoint selects it instead of opening its normal popup. The selected waypoint is marked with a yellow ring.

### Waypoint fields

The available fields in the checked source version are:

| Field | Meaning |
|---|---|
<<<<<<< HEAD
| Name | Waypoint name |
| Description | Waypoint description |
| Symbol | GPX symbol; suggestions are available |
| Latitude / Longitude | Position in decimal degrees; comma or dot can be used as decimal separator |
| Elevation | Elevation in metres |
| Street1 / Street2 | One or two address lines |
| Postalcode | Postal code |
| City | City or place |
| Country | Country |
| Phone / Email | Contact details |
| Pin color | Own marker colour, or the file colour |

Latitude must be between -90 and 90. Longitude must be between -180 and 180. Changes to the fields are applied when Save is clicked.
=======
| Name | Name of the point |
| Description | Description |
| Symbol | Determines the icon (with suggestions in a dropdown) |
| Latitude / Longitude | Position in decimal degrees (comma or dot, for example `46,286468`) |
| Elevation | Elevation in metres (empty becomes `0`) |
| Street1 / Street2 | Street and house number (and optionally a second line) |
| Postalcode, City, Country | Postal code, city, country |
| Phone, Email | Contact details |
| Pin colour | A colour of its own for this point, or "colour of the file" |

Changes are only applied when you click **Save**. Latitude must be between -90 and 90 and Longitude between -180 and 180, otherwise an error message appears.
>>>>>>> a7a256361879b045569512f6d67969565321d18f

**Garmin Proximity status:** the GPX parser can read Proximity and the popup can display it. However, the checked source version does not yet include Proximity in the editable sidebar or write it during GPX export. Add those code changes before documenting Proximity as editable/exportable functionality.

<<<<<<< HEAD
### Sidebar actions
=======
| Button | What it does |
|---|---|
| **➕ New POI** | Then click on the map to place a point. Choose the file in the dropdown next to it. If no file is loaded yet, a new file is created |
| **Save** | Applies the fields to the point |
| **🏷️ Address from coordinates** | Fills in the address automatically, see below |
| **📍 Move on the map** | Then click on the map for the new position |
| **Delete** | Deletes the point (with confirmation) |
| **Esc** (key) | Cancels "New point" or "Move" |
>>>>>>> a7a256361879b045569512f6d67969565321d18f

- **New point:** choose the target file and click the map to place a new waypoint. If no file exists, a new points file is created.
- **Save:** applies the edited field values to the selected waypoint.
- **Address from coordinates:** looks up an address for the coordinates entered in the sidebar.
- **Move on map:** click the map to move the selected waypoint to a new position.
- **Delete:** removes the selected waypoint after confirmation.
- **Esc:** cancels the active new-point or move action.

<<<<<<< HEAD
A waypoint cannot be moved to another loaded file using the current editing controls.
=======
The **🏷️ Address from coordinates** button reads Latitude and Longitude from the sidebar and looks up the address through **Nominatim** (OpenStreetMap):
>>>>>>> a7a256361879b045569512f6d67969565321d18f

## Address from coordinates

The address lookup uses the Nominatim reverse-geocoding service provided by OpenStreetMap.

It reads the latitude and longitude from the sidebar and fills in the address fields:

- Street1 is filled with the street and house number when available.
- Street2 is cleared.
- Postalcode is filled when available.
- City is filled with the place name and, where available, the region in brackets.
- Country is filled with the two-letter country code.

The lookup only fills the fields. Click **Save** to apply the address to the selected waypoint.

Important points:

- This is the function that sends the waypoint coordinates to an external address service.
- The language is configured by `NOMINATIM_LANG` in `gpx-map.js` (the checked source version uses `en`).
- A result is not guaranteed for remote places or locations without an address.
- Follow the Nominatim usage policy, including its request-rate restrictions. Do not use this interactive feature for bulk geocoding.

## Exporting

<<<<<<< HEAD
The export function combines the supported waypoint and track data into one GPX 1.1 file. The filename used by the checked source version is:
=======
The **Export al 1 GPX** button merges all loaded files into one file named `merged_DDMMYYYY.gpx` (with today's date merged).
>>>>>>> a7a256361879b045569512f6d67969565321d18f

`merged_DDMMYYYY.gpx`

### Waypoints

The export writes waypoints with:

- Latitude and longitude
- Elevation
- Name
- Description
- Symbol
- Garmin address fields, when present
- Phone number and email address, when present

The custom pin colour is not written because it is not part of the GPX fields currently exported.

**Garmin extension limitation:** although `DisplayMode` and `Proximity` are read when a GPX file is loaded, the checked `buildGpx()` function does not currently write these two values back to the exported GPX file. Proximity export needs the additional `gpxx:Proximity` element in the Garmin `WaypointExtension`.

### Tracks

- Each loaded file containing track lines is exported as one `<trk>`.
- The source filename (without its extension) is used as the track name.
- Each loaded line is written as a separate `<trkseg>`.

### Routes — current limitation

Routes (`<rte>`) are parsed, drawn on the map and included in browser storage. However, the checked `buildGpx()` function only writes waypoints and track lines. It does **not** currently write `<rte>` elements or convert route points into tracks.

Therefore, route data from an input file is not included in the exported GPX file in this source version. If route export is required, `buildGpx()` must be extended to write the route points and their relevant Garmin extensions.

Files removed from the map are not exported. Waypoint changes made in edit mode are included.

## Browser storage

<<<<<<< HEAD
When **Remember in this browser** is enabled, the application stores the loaded data in `localStorage`.
=======
With **Remember in this browser**, the page stores the loaded data in your browser's `localStorage`, so it is still there after closing the page.
>>>>>>> a7a256361879b045569512f6d67969565321d18f

The stored data includes:

- File name and colour
- Waypoints and their editable data
- Track lines
- Parsed routes and route points

The storage is local to the current browser and device. It is not shared with another browser, another device or a private browsing session.

If browser storage becomes full or unavailable, the application displays a save error. Clearing the browser's site data also removes the stored map data.

## Customising

The main map and GPX logic are in `gpx-map.js`.

| What | Where |
|---|---|
| Initial map centre and zoom | `L.map('map', { center: ..., zoom: ... })` |
| Base maps and overlays | `Tile-lagen`, `baseMaps` and `overlayMaps` |
| File colours | `COLORS` and `AWESOME_COLORS` |
| Waypoint symbols and icons | `SYMBOLS` |
| Available pin colours | `PIN_COLORS` |
| Address lookup language | `NOMINATIM_LANG` |
| Editing sidebar fields | `FIELDS` |
| GPX import | `parseGpx()` |
| GPX export | `buildGpx()` and `exportGpx()` |
| Browser storage | `save()` and `restore()` |

The visual appearance is controlled by `gpx-map.css`.

The main script provides a small API for add-on scripts:

- `GpxMap.registerFormat(...)` — register another file format.
- `GpxMap.makeWpt(...)` — create a waypoint object with standard defaults.
- `GpxMap.registerSymbol(name, icon)` — register or change a symbol icon.
- `GpxMap.addWaypointFile(name, wpts, lines)` — add a waypoint collection as a file.
- `GpxMap.removeFile(file)` — remove a loaded file.
- `GpxMap.getFiles()` — access the loaded file data.
- `GpxMap.onChange(callback)` — run a callback when the file list changes.

## Limitations

The checked source version has the following limitations:

- Only ordinary waypoints can be edited. Tracks and route points can be viewed but not edited.
- A waypoint cannot be transferred to another file using the editing sidebar.
- Route data is parsed, displayed and stored, but is not included in the current GPX export.
- Garmin `DisplayMode` and `Proximity` are read and displayed in popups, but are not editable or exported by the checked source version.
- Custom pin colours are a display setting and are not included in the GPX export.
- Address lookup depends on Nominatim availability and its usage policy.
- Map tiles and external JavaScript libraries depend on their providers and internet connectivity.

## Libraries and map data

The application uses:

- [Leaflet](https://leafletjs.com/)
- [Leaflet.awesome-markers](https://github.com/lvoogdt/Leaflet.awesome-markers)
- [Font Awesome 4](https://fontawesome.com/v4/)
- OpenStreetMap map data
- CycleOSM
- Humanitarian OpenStreetMap
- TopPlusOpen
- OpenTopoMap
- Esri World Imagery
- Waymarked Trails
- [Nominatim](https://nominatim.org/) for reverse address lookup

# Exoplanet Explorer — NASA Exoplanet Archive

An interactive 3D deep-space visualization of **5,000+ confirmed exoplanets** sourced from the NASA Exoplanet Archive, featuring procedural planet rendering, habitable zone calculations, Earth Similarity Index scoring, discovery method animations, and a glassmorphic scientific telemetry UI.

## Quick Start

```bash
# One command — no build tools required
node serve.js
```

Then open **http://127.0.0.1:3000**

Health check: **http://127.0.0.1:3000/healthcheck.html**

### Alternative Startup Methods

| Method | Command |
|--------|---------|
| **Node.js (recommended)** | `node serve.js` |
| Python 3 | `python -m http.server 3000` |
| npx serve | `npx serve . -p 3000` |
| VS Code Live Server | Right-click `index.html` → Open with Live Server |

> **Note:** Opening `index.html` directly (file://) will NOT work due to ES module CORS restrictions. You must use an HTTP server.

## Features

### Data Pipeline (NASA Exoplanet Archive)
- **Live data** from the NASA Exoplanet Archive TAP API (`pscomppars` table)
- 24-hour localStorage cache with 7-day stale data fallback
- Automatic background refresh when cache is stale
- Graceful degradation to built-in curated catalog (120 real + 4,900 procedural planets) when API is unavailable
- Data provenance: source, fetch timestamp, and validation report visible in UI
- Field validation and quality checks on all incoming records

### Habitable Zone Calculations
- **Kopparapu et al. (2013, 2014)** model for conservative and optimistic boundaries
- Conservative: runaway greenhouse → maximum greenhouse
- Optimistic: recent Venus → early Mars
- Interactive HZ diagram showing planet orbital position relative to zone boundaries
- Caveats displayed when data is incomplete or model assumptions may not hold

### Earth Similarity Index (ESI)
- **Schulze-Makuch et al. (2011)** four-component model
- Components: radius, bulk density, escape velocity, surface temperature
- Global ESI score with per-component breakdown
- Confidence notes when measurements are estimated

### Observer Utilities
- Right Ascension / Declination display (sexagesimal format)
- Constellation identification (simplified IAU regions)
- Apparent magnitude guidance for amateur astronomers
- Best viewing season/month/hemisphere recommendations
- Equipment recommendations based on host star magnitude

### Discovery Method Education
- 6 animated micro-visualizations (canvas-based):
  - **Transit** — lightcurve dip animation
  - **Radial Velocity** — stellar wobble Doppler animation
  - **Direct Imaging** — coronagraph/scattered light
  - **Microlensing** — gravitational bending amplification
  - **Timing** — pulse arrival variation
  - **Astrometry** — stellar position shift
- Full educational descriptions with physics, strengths, limitations
- Discovery facility and year for each planet
- Low-power mode toggle to reduce animation overhead

### 3D Visualization
- **Procedural planet rendering** — GLSL shader-driven with oceans, continents, volcanism, bioluminescence
- **Host star** — Spectral-type-appropriate color and glow
- **Ring system** — With planet shadow casting
- **Orbital path** — Pulsing trajectory visualization
- **Warp travel** — Animated transition between planets with particle tunnel
- **Post-processing** — Unreal Bloom for ethereal glow effects

### Catalog & Search
- Full-text search across planet names, systems, types, discovery methods, constellations
- Quick filter presets: Habitable, Nearby, Earth-like, Giants, Hot, Cold, In HZ, High ESI
- Discovery method dropdown filter
- Sort by: name, distance, habitability, radius, temperature, ESI, discovery year
- Infinite scroll with 50-planet pages
- Detailed planet cards with HZ/ESI badges

## Tech Stack

- **Three.js r163** (CDN via import map — no npm install needed)
- **Custom GLSL Shaders** (vertex + fragment for planet, atmosphere, rings, star, orbit)
- **NASA TAP API** (Exoplanet Archive ADQL queries)
- **HTML5 Canvas 2D** (UI graphs, animations, HZ diagrams, discovery method micro-animations)
- **CSS Glassmorphism** (backdrop-filter blur + translucent panels)
- **localStorage** (NASA data caching with versioned schema)
- Zero build tools, zero dependencies (beyond Node.js for the dev server)

## Project Structure

```
exoplanet-explorer/
├── index.html              # Entry point
├── serve.js                # One-command Node.js dev server
├── healthcheck.html        # Automated health check page
├── README.md
├── css/
│   └── style.css           # Glassmorphic UI styles (all components)
└── js/
    ├── app.js              # Main Three.js scene, render loop, panel integration
    ├── nasa-data.js        # NASA Exoplanet Archive API pipeline & cache
    ├── science.js          # HZ calculations, ESI, observer utils, discovery methods
    ├── discovery-animations.js  # Canvas micro-animations for discovery methods
    ├── database.js         # Planet catalog, search/filter, classification
    ├── catalog-ui.js       # Catalog panel, cards, detail view, filters
    ├── travel.js           # Warp travel animation system
    ├── shaders.js          # All GLSL shader source code
    └── ui.js               # 2D canvas UI animations (gauges, graphs, spectrum)
```

## Controls

| Input | Action |
|-------|--------|
| Left-click + drag | Rotate camera |
| Scroll wheel | Zoom in/out |
| Shift + drag | Pan |
| Auto | Slow auto-rotation |
| ☰ CATALOG button | Toggle planet catalog panel |
| Planet card click | Open detail panel |
| ▸ button / Travel button | Warp to planet |

## Data Sources & References

| Source | Usage |
|--------|-------|
| [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/) | Primary planet data (TAP API, `pscomppars` table) |
| Kopparapu et al. (2013, 2014) | Habitable zone boundary model |
| Schulze-Makuch et al. (2011) | Earth Similarity Index formula |
| IAU constellation boundaries | Simplified sky region lookup |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Blank page / console errors about modules | Use an HTTP server (`node serve.js`), not `file://` |
| "Port 3000 in use" | `set PORT=3001 && node serve.js` (Windows) or `PORT=3001 node serve.js` (Mac/Linux) |
| NASA data not loading | Check internet connection; app falls back to built-in data automatically |
| Planets show "—" for HZ/ESI | Host star data missing for that planet; caveats will explain |
| Slow performance | Enable "⚡ LOW POWER" toggle in bottom-right corner |
| Three.js not loading | Check that cdn.jsdelivr.net is reachable (not blocked by firewall/proxy) |
| Fonts not loading | Check that fonts.googleapis.com is reachable |

## License

MIT

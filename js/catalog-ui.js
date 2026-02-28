// ═══════════════════════════════════════════════
// EXOPLANET EXPLORER — CATALOG UI
// Searchable, filterable planet catalog
// ═══════════════════════════════════════════════

import {
  PLANET_CATALOG,
  searchPlanets,
  PlanetType,
  getCatalogStats,
  getSystemPlanets,
  createVisualProfile,
} from './database.js';

import {
  DISCOVERY_METHODS,
  GLOSSARY,
  formatRADec,
} from './science.js';

import {
  ANIMATION_MAP,
  animateCanvas,
  drawHZDiagram,
  setLowPowerMode,
} from './discovery-animations.js';

let currentResults = [];
let currentPage = 0;
const PAGE_SIZE = 50;
let onSelectPlanet = null;
let currentFilters = {};
let catalogVisible = false;
let selectedPlanetId = null;
let discoveryAnimCleanup = null;

// ── Initialize Catalog ───────────────────────
export function initCatalog(onSelect) {
  onSelectPlanet = onSelect;
  bindEvents();
  updateStats();
  performSearch();
}

// ── Toggle Catalog Visibility ────────────────
export function toggleCatalog() {
  catalogVisible = !catalogVisible;
  const panel = document.getElementById('catalog-panel');
  const toggleBtn = document.getElementById('catalog-toggle');
  if (panel) {
    panel.classList.toggle('visible', catalogVisible);
  }
  if (toggleBtn) {
    toggleBtn.classList.toggle('active', catalogVisible);
    toggleBtn.textContent = catalogVisible ? '✕ CATALOG' : '☰ CATALOG';
  }
}

export function showCatalog() {
  catalogVisible = true;
  const panel = document.getElementById('catalog-panel');
  const toggleBtn = document.getElementById('catalog-toggle');
  if (panel) panel.classList.add('visible');
  if (toggleBtn) {
    toggleBtn.classList.add('active');
    toggleBtn.textContent = '✕ CATALOG';
  }
}

export function hideCatalog() {
  catalogVisible = false;
  const panel = document.getElementById('catalog-panel');
  const toggleBtn = document.getElementById('catalog-toggle');
  if (panel) panel.classList.remove('visible');
  if (toggleBtn) {
    toggleBtn.classList.remove('active');
    toggleBtn.textContent = '☰ CATALOG';
  }
}

// ── Bind Events ──────────────────────────────
function bindEvents() {
  // Search input
  const searchInput = document.getElementById('catalog-search');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentPage = 0;
        performSearch();
      }, 200);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        performSearch();
      }
    });
  }

  // Filter buttons
  document.querySelectorAll('.catalog-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const filterType = btn.dataset.filter;
      const filterValue = btn.dataset.value;

      // Toggle active state
      if (btn.classList.contains('active')) {
        btn.classList.remove('active');
        delete currentFilters[filterType];
      } else {
        // Deactivate siblings
        btn.parentElement.querySelectorAll('.catalog-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilters[filterType] = filterValue === 'number' ? parseFloat(filterValue) : filterValue;
      }

      currentPage = 0;
      performSearch();
    });
  });

  // Sort control
  const sortSelect = document.getElementById('catalog-sort');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      currentPage = 0;
      performSearch();
    });
  }

  // Toggle button
  const toggleBtn = document.getElementById('catalog-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleCatalog);
  }

  // Quick filter chips
  document.querySelectorAll('.quick-filter').forEach(chip => {
    chip.addEventListener('click', () => {
      applyQuickFilter(chip.dataset.preset);
    });
  });

  // Habitable only toggle
  const habToggle = document.getElementById('hab-filter-toggle');
  if (habToggle) {
    habToggle.addEventListener('change', () => {
      if (habToggle.checked) {
        currentFilters.minHabitability = 0.6;
      } else {
        delete currentFilters.minHabitability;
      }
      currentPage = 0;
      performSearch();
    });
  }

  // Discovery method filter
  const methodFilter = document.getElementById('discovery-method-filter');
  if (methodFilter) {
    methodFilter.addEventListener('change', () => {
      if (methodFilter.value) {
        currentFilters.discoveryMethod = methodFilter.value;
      } else {
        delete currentFilters.discoveryMethod;
      }
      currentPage = 0;
      performSearch();
    });
  }

  // Low-power mode toggle
  const lowPowerToggle = document.getElementById('low-power-toggle');
  if (lowPowerToggle) {
    lowPowerToggle.addEventListener('change', () => {
      setLowPowerMode(lowPowerToggle.checked);
    });
  }

  // Scroll load more
  const resultsList = document.getElementById('catalog-results');
  if (resultsList) {
    resultsList.addEventListener('scroll', () => {
      if (resultsList.scrollTop + resultsList.clientHeight >= resultsList.scrollHeight - 100) {
        loadMore();
      }
    });
  }

  // Close detail panel
  const closeDetail = document.getElementById('close-detail');
  if (closeDetail) {
    closeDetail.addEventListener('click', () => {
      document.getElementById('planet-detail-panel')?.classList.remove('visible');
    });
  }
}

// ── Quick Filter Presets ─────────────────────
function applyQuickFilter(preset) {
  const searchInput = document.getElementById('catalog-search');

  // Clear existing
  currentFilters = {};
  document.querySelectorAll('.catalog-filter-btn').forEach(b => b.classList.remove('active'));
  if (searchInput) searchInput.value = '';

  const habToggle = document.getElementById('hab-filter-toggle');

  switch (preset) {
    case 'habitable':
      currentFilters.minHabitability = 0.6;
      if (habToggle) habToggle.checked = true;
      break;
    case 'nearby':
      currentFilters.maxDistance = 50;
      currentFilters.sortBy = 'distance';
      currentFilters.sortDir = 'asc';
      break;
    case 'earthlike':
      currentFilters.minRadius = 0.7;
      currentFilters.maxRadius = 1.5;
      currentFilters.minTemp = 200;
      currentFilters.maxTemp = 320;
      break;
    case 'giants':
      currentFilters.minRadius = 8;
      break;
    case 'hot':
      currentFilters.minTemp = 1000;
      currentFilters.sortBy = 'eqTemp';
      currentFilters.sortDir = 'desc';
      break;
    case 'cold':
      currentFilters.maxTemp = 150;
      currentFilters.sortBy = 'eqTemp';
      currentFilters.sortDir = 'asc';
      break;
    case 'inHZ':
      currentFilters.inHZ = 'optimistic';
      break;
    case 'highESI':
      currentFilters.minESI = 0.7;
      currentFilters.sortBy = 'esi';
      currentFilters.sortDir = 'desc';
      break;
  }

  // Highlight active chip
  document.querySelectorAll('.quick-filter').forEach(c => {
    c.classList.toggle('active', c.dataset.preset === preset);
  });

  currentPage = 0;
  performSearch();
}

// ── Perform Search ───────────────────────────
function performSearch() {
  const searchInput = document.getElementById('catalog-search');
  const query = searchInput ? searchInput.value : '';

  const sortSelect = document.getElementById('catalog-sort');
  if (sortSelect) {
    const [sortBy, sortDir] = sortSelect.value.split('-');
    currentFilters.sortBy = sortBy;
    currentFilters.sortDir = sortDir;
  }

  currentResults = searchPlanets(query, currentFilters);
  renderResults(false);
  updateResultCount();
}

// ── Render Results ───────────────────────────
function renderResults(append = false) {
  const container = document.getElementById('catalog-results');
  if (!container) return;

  const start = append ? currentPage * PAGE_SIZE : 0;
  const end = (currentPage + 1) * PAGE_SIZE;
  const pageResults = currentResults.slice(start, end);

  if (!append) {
    container.innerHTML = '';
  }

  if (currentResults.length === 0) {
    container.innerHTML = `
      <div class="no-results">
        <span class="no-results-icon">🔭</span>
        <span class="no-results-text">NO PLANETS FOUND</span>
        <span class="no-results-hint">Try adjusting your search or filters</span>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  pageResults.forEach(planet => {
    const card = createPlanetCard(planet);
    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

// ── Create Planet Card ───────────────────────
function createPlanetCard(planet) {
  const card = document.createElement('div');
  card.className = `planet-card ${planet.id === selectedPlanetId ? 'selected' : ''}`;
  card.dataset.planetId = planet.id;

  const typeColor = getTypeColor(planet.type);
  const habColor = getHabColor(planet.habitability);
  const safeHab = Number.isFinite(planet.habitability) ? planet.habitability : 0;
  const habPct = Math.round(safeHab * 100);

  // HZ / ESI badges
  const hzBadge = planet.hzStatus && planet.hzStatus.conservative
    ? '<span class="badge badge-hz-c" title="In Conservative Habitable Zone">CHZ</span>'
    : planet.hzStatus && planet.hzStatus.optimistic
      ? '<span class="badge badge-hz-o" title="In Optimistic Habitable Zone">OHZ</span>'
      : '';
  const esiBadge = planet.esi && Number.isFinite(planet.esi.global) && planet.esi.global >= 0.7
    ? `<span class="badge badge-esi" title="ESI ${planet.esi.global.toFixed(2)}">${planet.esi.global.toFixed(2)}</span>`
    : '';
  const methodTag = planet.discoveryMethod
    ? `<span class="card-method">${planet.discoveryMethod}</span>`
    : '';

  // Mini planet preview color
  const profile = createVisualProfile(planet);
  const pColor = `rgb(${Math.round(profile.primaryColor[0]*255)},${Math.round(profile.primaryColor[1]*255)},${Math.round(profile.primaryColor[2]*255)})`;
  const sColor = `rgb(${Math.round(profile.secondaryColor[0]*255)},${Math.round(profile.secondaryColor[1]*255)},${Math.round(profile.secondaryColor[2]*255)})`;

  card.innerHTML = `
    <div class="planet-card__preview" style="background: radial-gradient(circle at 35% 35%, ${sColor}, ${pColor} 70%, #000);">
      ${profile.hasRings ? '<div class="mini-ring"></div>' : ''}
    </div>
    <div class="planet-card__info">
      <div class="planet-card__name">${planet.name} ${hzBadge}${esiBadge}</div>
      <div class="planet-card__type" style="color: ${typeColor}">${planet.type} ${methodTag}</div>
      <div class="planet-card__stats">
        <span title="Distance">${formatDistance(planet.distance)}</span>
        <span title="Radius">${formatNumeric(planet.radius, 2)} R⊕</span>
        <span title="Temperature">${Number.isFinite(planet.eqTemp) ? planet.eqTemp : '—'} K</span>
      </div>
    </div>
    <div class="planet-card__hab">
      <svg class="hab-ring" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="2.5"/>
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="${habColor}" stroke-width="2.5"
          stroke-dasharray="${habPct} ${100 - habPct}" stroke-dashoffset="25"
          stroke-linecap="round"/>
      </svg>
      <span class="hab-ring-value" style="color: ${habColor}">${habPct}</span>
    </div>
    <button class="planet-card__travel" title="Travel to ${planet.name}">▸</button>
  `;

  // Click to show detail
  card.addEventListener('click', (e) => {
    if (e.target.closest('.planet-card__travel')) {
      selectAndTravel(planet);
    } else {
      showPlanetDetail(planet);
    }
  });

  return card;
}

// ── Show Planet Detail Panel ─────────────────
function showPlanetDetail(planet) {
  selectedPlanetId = planet.id;

  // Update selected state on cards
  document.querySelectorAll('.planet-card').forEach(c => {
    c.classList.toggle('selected', parseInt(c.dataset.planetId) === planet.id);
  });

  const panel = document.getElementById('planet-detail-panel');
  if (!panel) return;

  const profile = createVisualProfile(planet);
  const habColor = getHabColor(planet.habitability);
  const typeColor = getTypeColor(planet.type);
  const systemPlanets = getSystemPlanets(planet.system);

  panel.innerHTML = `
    <button class="detail-close" id="close-detail">✕</button>
    <div class="detail-header">
      <h2 class="detail-name">${planet.name}</h2>
      <span class="detail-type" style="color: ${typeColor}">${planet.type}</span>
    </div>

    <div class="detail-preview">
      <div class="detail-planet-orb" style="background: radial-gradient(circle at 30% 30%,
        rgb(${profile.secondaryColor.map(c=>Math.round(c*255)).join(',')}),
        rgb(${profile.primaryColor.map(c=>Math.round(c*255)).join(',')}),
        #000 85%);">
        <div class="detail-atmo-glow" style="box-shadow: 0 0 30px 10px rgba(${profile.atmosColor.map(c=>Math.round(c*255)).join(',')}, 0.3)"></div>
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-stat">
        <span class="detail-stat-label">DISTANCE</span>
        <span class="detail-stat-value">${planet.distance.toFixed(1)} <small>LY</small></span>
      </div>
      <div class="detail-stat">
        <span class="detail-stat-label">RADIUS</span>
        <span class="detail-stat-value">${planet.radius.toFixed(2)} <small>R⊕</small></span>
      </div>
      <div class="detail-stat">
        <span class="detail-stat-label">MASS</span>
        <span class="detail-stat-value">${planet.mass.toFixed(2)} <small>M⊕</small></span>
      </div>
      <div class="detail-stat">
        <span class="detail-stat-label">TEMPERATURE</span>
        <span class="detail-stat-value">${planet.eqTemp} <small>K</small></span>
      </div>
      <div class="detail-stat">
        <span class="detail-stat-label">PERIOD</span>
        <span class="detail-stat-value">${planet.period.toFixed(1)} <small>days</small></span>
      </div>
      <div class="detail-stat">
        <span class="detail-stat-label">SEMI-MAJOR</span>
        <span class="detail-stat-value">${planet.semiMajorAxis.toFixed(4)} <small>AU</small></span>
      </div>
    </div>

    <div class="detail-section">
      <h3 class="detail-section-title">HABITABILITY</h3>
      <div class="detail-hab-bar">
        <div class="detail-hab-fill" style="width: ${planet.habitability * 100}%; background: ${habColor}"></div>
      </div>
      <span class="detail-hab-score" style="color: ${habColor}">${(planet.habitability * 100).toFixed(0)}%</span>
    </div>

    ${planet.atmosphere ? `
    <div class="detail-section">
      <h3 class="detail-section-title">ATMOSPHERE</h3>
      <div class="detail-atmo-bars">
        ${planet.atmosphere.map(a => `
          <div class="detail-atmo-row">
            <span class="detail-atmo-gas">${a.gas}</span>
            <div class="detail-atmo-track">
              <div class="detail-atmo-fill" style="width: ${a.pct}%; background: ${getGasColor(a.gas)}"></div>
            </div>
            <span class="detail-atmo-pct">${a.pct}%</span>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <div class="detail-section">
      <h3 class="detail-section-title">HOST STAR: ${planet.system}</h3>
      <div class="detail-grid compact">
        <div class="detail-stat">
          <span class="detail-stat-label">TYPE</span>
          <span class="detail-stat-value">${planet.starType || 'Unknown'}</span>
        </div>
        <div class="detail-stat">
          <span class="detail-stat-label">TEMP</span>
          <span class="detail-stat-value">${planet.starTemp ? planet.starTemp.toLocaleString() : '?'} <small>K</small></span>
        </div>
      </div>
    </div>

    ${systemPlanets.length > 1 ? `
    <div class="detail-section">
      <h3 class="detail-section-title">SYSTEM — ${systemPlanets.length} PLANETS</h3>
      <div class="system-planets-list">
        ${systemPlanets.map(sp => `
          <button class="system-planet-chip ${sp.id === planet.id ? 'current' : ''}"
            data-planet-name="${sp.name}">
            ${sp.name.split(' ').pop()}
            <small>${sp.radius.toFixed(1)} R⊕</small>
          </button>
        `).join('')}
      </div>
    </div>
    ` : ''}

    ${buildHZSection(planet)}
    ${buildESISection(planet)}
    ${buildObserverSection(planet)}
    ${buildDiscoverySection(planet)}

    <button class="detail-travel-btn" id="detail-travel-btn">
      <span class="travel-icon">◈</span> TRAVEL TO ${planet.name.toUpperCase()}
    </button>
  `;

  panel.classList.add('visible');

  // Rebind close button
  document.getElementById('close-detail')?.addEventListener('click', () => {
    panel.classList.remove('visible');
  });

  // Travel button
  document.getElementById('detail-travel-btn')?.addEventListener('click', () => {
    selectAndTravel(planet);
  });

  // System planet chips
  panel.querySelectorAll('.system-planet-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const name = chip.dataset.planetName;
      const target = PLANET_CATALOG.find(p => p.name === name);
      if (target) showPlanetDetail(target);
    });
  });

  // HZ diagram in detail panel
  const hzCanvas = panel.querySelector('#detail-hz-canvas');
  if (hzCanvas && planet.hzStatus && planet.hzStatus.hz) {
    const ctx = hzCanvas.getContext('2d');
    drawHZDiagram(ctx, hzCanvas.width, hzCanvas.height, planet);
  }

  // Discovery animation in detail panel
  if (discoveryAnimCleanup) { discoveryAnimCleanup.stop(); discoveryAnimCleanup = null; }
  const discCanvas = panel.querySelector('#detail-disc-canvas');
  if (discCanvas && planet.discoveryMethod) {
    const methodKey = planet.discoveryMethod.toLowerCase().replace(/\s+/g, '_');
    const drawFn = ANIMATION_MAP[methodKey] || ANIMATION_MAP['transit'];
    if (drawFn) {
      discoveryAnimCleanup = animateCanvas(discCanvas, drawFn, 8000);
    }
  }

  // Glossary tooltips
  panel.querySelectorAll('[data-glossary]').forEach(el => {
    el.addEventListener('mouseenter', showGlossaryTooltip);
    el.addEventListener('mouseleave', hideGlossaryTooltip);
  });
}

// ── Select & Travel ──────────────────────────
function selectAndTravel(planet) {
  if (onSelectPlanet) {
    onSelectPlanet(planet);
  }
  // Close detail panel
  document.getElementById('planet-detail-panel')?.classList.remove('visible');
}

// ── Load More (infinite scroll) ──────────────
function loadMore() {
  const maxPage = Math.ceil(currentResults.length / PAGE_SIZE) - 1;
  if (currentPage >= maxPage) return;
  currentPage++;
  renderResults(true);
}

// ── Update Stats ─────────────────────────────
function updateStats() {
  const stats = getCatalogStats();
  const countEl = document.getElementById('catalog-total-count');
  if (countEl) {
    countEl.textContent = stats.total.toLocaleString();
  }
}

function updateResultCount() {
  const countEl = document.getElementById('catalog-result-count');
  if (countEl) {
    countEl.textContent = `${currentResults.length.toLocaleString()} planets`;
  }
}

// ── Utility Functions ────────────────────────
function formatDistance(ly) {
  if (!Number.isFinite(ly)) return '—';
  if (ly < 100) return `${ly.toFixed(1)} LY`;
  if (ly < 1000) return `${Math.round(ly)} LY`;
  return `${(ly / 1000).toFixed(1)}K LY`;
}

function formatNumeric(value, digits = 2, fallback = '—') {
  return Number.isFinite(value) ? value.toFixed(digits) : fallback;
}

function getTypeColor(type) {
  const colors = {
    [PlanetType.HOT_JUPITER]: '#ff6b35',
    [PlanetType.WARM_JUPITER]: '#ff9f43',
    [PlanetType.COLD_JUPITER]: '#48dbfb',
    [PlanetType.HOT_NEPTUNE]: '#0abde3',
    [PlanetType.WARM_NEPTUNE]: '#0984e3',
    [PlanetType.SUPER_EARTH]: '#00d2d3',
    [PlanetType.ROCKY_TERRESTRIAL]: '#10ac84',
    [PlanetType.SUB_EARTH]: '#c8d6e5',
    [PlanetType.LAVA_WORLD]: '#ff4757',
    [PlanetType.ICE_GIANT]: '#74b9ff',
    [PlanetType.WATER_WORLD]: '#0652DD',
    [PlanetType.DESERT_WORLD]: '#e17055',
    [PlanetType.GAS_DWARF]: '#a29bfe',
  };
  return colors[type] || '#ffffff';
}

function getHabColor(score) {
  if (score >= 0.7) return '#00e676';
  if (score >= 0.4) return '#ffd740';
  if (score >= 0.2) return '#ff9100';
  return '#ff1744';
}

function getGasColor(gas) {
  const colors = {
    'CO₂': '#ffd740',
    'H₂O': '#00e5ff',
    'N₂': '#b388ff',
    'O₂': '#69f0ae',
    'H₂': '#ff8a65',
    'He': '#fff9c4',
    'CH₄': '#aed581',
    'NH₃': '#ce93d8',
    'SiO₂': '#ff7043',
    'Na': '#ffeb3b',
    'SO₂': '#ef5350',
    'O₃': '#4dd0e1',
  };
  return colors[gas] || '#90a4ae';
}

// ── Update current planet in catalog ─────────
export function setCurrentPlanet(planet) {
  selectedPlanetId = planet.id;
  document.querySelectorAll('.planet-card').forEach(c => {
    c.classList.toggle('selected', parseInt(c.dataset.planetId) === planet.id);
  });
}

// ── Refresh catalog after NASA data loaded ───
export function refreshCatalog() {
  updateStats();
  currentPage = 0;
  performSearch();
}

// ── Build HZ Detail Section ──────────────────
function buildHZSection(planet) {
  if (!planet.hzStatus || !planet.hzStatus.hz) return '';
  const hz = planet.hzStatus;
  const badgeClass = hz.conservative ? 'badge-hz-c' : hz.optimistic ? 'badge-hz-o' : 'badge-hz-out';
  return `
    <div class="detail-section">
      <h3 class="detail-section-title"><span data-glossary="habitable_zone">◎ HABITABLE ZONE</span></h3>
      <canvas id="detail-hz-canvas" width="320" height="100" class="detail-canvas"></canvas>
      <div class="detail-hz-status">
        <span class="badge ${badgeClass}">${hz.label}</span>
      </div>
      <div class="detail-grid compact">
        <div class="detail-stat">
          <span class="detail-stat-label" data-glossary="conservative_hz">CONSERVATIVE</span>
          <span class="detail-stat-value">${hz.hz.conservativeInner.toFixed(3)} – ${hz.hz.conservativeOuter.toFixed(3)} <small>AU</small></span>
        </div>
        <div class="detail-stat">
          <span class="detail-stat-label" data-glossary="optimistic_hz">OPTIMISTIC</span>
          <span class="detail-stat-value">${hz.hz.optimisticInner.toFixed(3)} – ${hz.hz.optimisticOuter.toFixed(3)} <small>AU</small></span>
        </div>
        <div class="detail-stat">
          <span class="detail-stat-label">PLANET ORBIT</span>
          <span class="detail-stat-value">${planet.semiMajorAxis ? planet.semiMajorAxis.toFixed(4) + ' AU' : '—'}</span>
        </div>
      </div>
      ${hz.caveat ? `<div class="detail-caveat">${hz.caveat}</div>` : ''}
    </div>
  `;
}

// ── Build ESI Detail Section ─────────────────
function buildESISection(planet) {
  if (!planet.esi) return '';
  const esi = planet.esi;
  const esiColor = esi.global >= 0.8 ? '#00e676' : esi.global >= 0.6 ? '#ffd740' : esi.global >= 0.4 ? '#ff9100' : '#ff1744';
  const comps = esi.components || {};
  return `
    <div class="detail-section">
      <h3 class="detail-section-title"><span data-glossary="esi">⊕ EARTH SIMILARITY INDEX</span></h3>
      <div class="detail-esi-score" style="color: ${esiColor}">${esi.global.toFixed(3)}</div>
      <div class="detail-esi-bars">
        ${['radius', 'density', 'escapeVelocity', 'surfaceTemp'].map(key => {
          const val = comps[key] !== undefined ? comps[key] : 0;
          const label = key === 'escapeVelocity' ? 'ESC VEL' : key === 'surfaceTemp' ? 'TEMP' : key.toUpperCase();
          return `
            <div class="detail-atmo-row">
              <span class="detail-atmo-gas">${label}</span>
              <div class="detail-atmo-track">
                <div class="detail-atmo-fill" style="width: ${val * 100}%; background: ${esiColor}"></div>
              </div>
              <span class="detail-atmo-pct">${(val).toFixed(2)}</span>
            </div>
          `;
        }).join('')}
      </div>
      ${esi.confidence ? `<div class="detail-caveat">${esi.confidence}</div>` : ''}
    </div>
  `;
}

// ── Build Observer Detail Section ────────────
function buildObserverSection(planet) {
  if (!planet.ra && !planet.dec) return '';
  const parts = [];
  if (planet.coords) {
    parts.push(`<div class="detail-stat"><span class="detail-stat-label" data-glossary="right_ascension">RA / DEC</span><span class="detail-stat-value">${planet.coords.ra} / ${planet.coords.dec}</span></div>`);
  }
  if (planet.constellation) {
    parts.push(`<div class="detail-stat"><span class="detail-stat-label" data-glossary="constellation">CONSTELLATION</span><span class="detail-stat-value">${planet.constellation.name} (${planet.constellation.abbreviation})</span></div>`);
  }
  if (planet.vMag != null) {
    parts.push(`<div class="detail-stat"><span class="detail-stat-label" data-glossary="apparent_magnitude">APP. MAG (V)</span><span class="detail-stat-value">${planet.vMag.toFixed(1)}</span></div>`);
  }
  if (planet.observability) {
    const obs = planet.observability;
    parts.push(`<div class="detail-stat"><span class="detail-stat-label">BEST SEASON</span><span class="detail-stat-value">${obs.bestMonth} (${obs.seasonLabel})</span></div>`);
    parts.push(`<div class="detail-stat"><span class="detail-stat-label">HEMISPHERE</span><span class="detail-stat-value">${obs.hemisphere}</span></div>`);
  }
  if (planet.magnitudeGuidance) {
    parts.push(`<div class="detail-stat"><span class="detail-stat-label">EQUIPMENT</span><span class="detail-stat-value">${planet.magnitudeGuidance.label}</span></div>`);
  }
  if (parts.length === 0) return '';
  return `
    <div class="detail-section">
      <h3 class="detail-section-title">🔭 OBSERVER DATA</h3>
      <div class="detail-grid compact">${parts.join('')}</div>
      ${planet.magnitudeGuidance ? `<div class="detail-caveat">${planet.magnitudeGuidance.guidance}</div>` : ''}
    </div>
  `;
}

// ── Build Discovery Detail Section ───────────
function buildDiscoverySection(planet) {
  if (!planet.discoveryMethod) return '';
  const methodInfo = DISCOVERY_METHODS[planet.discoveryMethod] || null;
  return `
    <div class="detail-section">
      <h3 class="detail-section-title">🔬 DISCOVERY: ${planet.discoveryMethod.toUpperCase()}</h3>
      <canvas id="detail-disc-canvas" width="320" height="160" class="detail-canvas"></canvas>
      ${methodInfo ? `<div class="detail-discovery-desc">${methodInfo.shortDesc}</div>` : ''}
      <div class="detail-grid compact">
        <div class="detail-stat">
          <span class="detail-stat-label">YEAR</span>
          <span class="detail-stat-value">${planet.discovered || '—'}</span>
        </div>
        <div class="detail-stat">
          <span class="detail-stat-label">FACILITY</span>
          <span class="detail-stat-value">${planet.discoveryFacility || '—'}</span>
        </div>
      </div>
      ${methodInfo ? `
        <details class="detail-discovery-more">
          <summary>Learn more about ${planet.discoveryMethod}</summary>
          <p>${methodInfo.fullDesc}</p>
          <p><strong>Physics:</strong> ${methodInfo.physics}</p>
          <p><strong>Strengths:</strong> ${methodInfo.strengths}</p>
          <p><strong>Limitations:</strong> ${methodInfo.limitations}</p>
          ${methodInfo.missions ? `<p><strong>Key missions:</strong> ${methodInfo.missions.join(', ')}</p>` : ''}
        </details>
      ` : ''}
    </div>
  `;
}

// ── Glossary Tooltip ─────────────────────────
function showGlossaryTooltip(e) {
  const key = e.target.dataset.glossary;
  const def = GLOSSARY[key];
  if (!def) return;
  const tooltip = document.getElementById('glossary-tooltip');
  if (!tooltip) return;
  tooltip.textContent = def;
  tooltip.style.display = 'block';
  const rect = e.target.getBoundingClientRect();
  tooltip.style.left = rect.left + 'px';
  tooltip.style.top = (rect.bottom + 6) + 'px';
}

function hideGlossaryTooltip() {
  const tooltip = document.getElementById('glossary-tooltip');
  if (tooltip) tooltip.style.display = 'none';
}

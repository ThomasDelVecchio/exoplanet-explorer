// ═══════════════════════════════════════════════
// EXOPLANET EXPLORER — NASA EXOPLANET ARCHIVE DATA PIPELINE
// Primary source: NASA Exoplanet Archive TAP API
// Provides real confirmed planet data with caching,
// fallback, validation, and incremental loading.
// ═══════════════════════════════════════════════

const NASA_TAP_URL = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';

// Fields we request from the NASA Exoplanet Archive (Planetary Systems Composite table)
const NASA_COLUMNS = [
  'pl_name',          // planet name
  'hostname',         // host star name
  'sy_dist',          // distance (pc)
  'pl_rade',          // planet radius (Earth radii)
  'pl_bmasse',        // planet mass (Earth masses)
  'pl_orbper',        // orbital period (days)
  'pl_orbsmax',       // semi-major axis (AU)
  'pl_eqt',           // equilibrium temperature (K)
  'st_spectype',      // stellar spectral type
  'st_teff',          // stellar effective temperature (K)
  'st_mass',          // stellar mass (solar)
  'st_lum',           // stellar luminosity (log solar)
  'disc_year',        // discovery year
  'discoverymethod',  // discovery method
  'disc_facility',    // discovery facility/telescope
  'ra',               // right ascension (deg)
  'dec',              // declination (deg)
  'sy_vmag',          // V-band magnitude
  'sy_kmag',          // K-band magnitude
  'pl_orbeccen',      // orbital eccentricity
  'pl_orbincl',       // orbital inclination (deg)
  'disc_refname',     // discovery reference
  'pl_controv_flag',  // controversial flag
  'soltype',          // solution type
  'default_flag',     // default parameter set flag
].join(',');

// ADQL query for confirmed planets (default_flag=1 gets the default solution)
const ADQL_QUERY = `SELECT ${NASA_COLUMNS} FROM pscomppars WHERE default_flag = 1 ORDER BY pl_name`;

// Cache configuration
const CACHE_KEY = 'exoplanet_nasa_cache';
const CACHE_META_KEY = 'exoplanet_nasa_cache_meta';
const CACHE_VERSION = 2;
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_STALE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Cache Management ─────────────────────────
function getCacheMeta() {
  try {
    const raw = localStorage.getItem(CACHE_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function setCacheMeta(meta) {
  try {
    localStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
  } catch (e) {
    console.warn('[NASA-Data] Could not write cache meta:', e.message);
  }
}

function getCachedData() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function setCachedData(data, meta) {
  try {
    const json = JSON.stringify(data);
    // Check size limit (~5MB for localStorage)
    if (json.length > 4.5 * 1024 * 1024) {
      // Truncate to keep under limit
      const trimmed = data.slice(0, Math.floor(data.length * 0.8));
      localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
      meta.truncated = true;
      meta.cachedCount = trimmed.length;
    } else {
      localStorage.setItem(CACHE_KEY, json);
      meta.truncated = false;
      meta.cachedCount = data.length;
    }
    setCacheMeta(meta);
  } catch (e) {
    console.warn('[NASA-Data] Could not write cache:', e.message);
  }
}

function isCacheFresh() {
  const meta = getCacheMeta();
  if (!meta || meta.version !== CACHE_VERSION) return false;
  const age = Date.now() - meta.fetchedAt;
  return age < CACHE_MAX_AGE_MS;
}

function isCacheUsable() {
  const meta = getCacheMeta();
  if (!meta || meta.version !== CACHE_VERSION) return false;
  const age = Date.now() - meta.fetchedAt;
  return age < CACHE_STALE_AGE_MS;
}

// ── NASA API Fetch ───────────────────────────
export async function fetchNASAData(onProgress) {
  const url = new URL(NASA_TAP_URL);
  url.searchParams.set('query', ADQL_QUERY);
  url.searchParams.set('format', 'json');

  if (onProgress) onProgress({ phase: 'fetching', message: 'Querying NASA Exoplanet Archive...' });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`NASA API returned ${response.status}: ${response.statusText}`);
    }

    const rawData = await response.json();
    if (onProgress) onProgress({ phase: 'parsing', message: `Received ${rawData.length} records from NASA...` });

    return rawData;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('NASA API request timed out (30s)');
    }
    throw err;
  }
}

// ── Field Mapping: NASA → Internal Schema ────
// Converts parsecs to light-years, log-luminosity to linear, etc.
const PARSEC_TO_LY = 3.26156;

export function mapNASARecord(raw) {
  const distance = raw.sy_dist != null ? raw.sy_dist * PARSEC_TO_LY : null;
  const starLumLog = raw.st_lum; // NASA gives log10(L/L☉)
  const starLum = starLumLog != null ? Math.pow(10, starLumLog) : null;

  return {
    // Planet identifiers
    name: raw.pl_name || 'Unknown',
    system: raw.hostname || raw.pl_name?.replace(/\s[b-i]$/i, '') || 'Unknown',

    // Physical properties (Earth units)
    distance: distance,                           // light-years
    radius: raw.pl_rade,                          // Earth radii
    mass: raw.pl_bmasse,                          // Earth masses
    period: raw.pl_orbper,                        // days
    semiMajorAxis: raw.pl_orbsmax,                // AU
    eqTemp: raw.pl_eqt != null ? Math.round(raw.pl_eqt) : null, // Kelvin
    eccentricity: raw.pl_orbeccen,                // dimensionless
    inclination: raw.pl_orbincl,                  // degrees

    // Host star
    starType: raw.st_spectype || null,
    starTemp: raw.st_teff != null ? Math.round(raw.st_teff) : null,     // Kelvin
    starMass: raw.st_mass,                        // Solar masses
    starLum: starLum,                             // Solar luminosities (linear)
    starLumLog: starLumLog,                       // log10(L/L☉) - original

    // Discovery
    discovered: raw.disc_year,
    discoveryMethod: raw.discoverymethod || null,
    discoveryFacility: raw.disc_facility || null,
    discoveryRef: raw.disc_refname || null,

    // Observer coordinates
    ra: raw.ra,                                   // degrees
    dec: raw.dec,                                  // degrees
    vMag: raw.sy_vmag,                            // V-band apparent magnitude
    kMag: raw.sy_kmag,                            // K-band apparent magnitude

    // Provenance
    controversial: raw.pl_controv_flag === 1,
    source: 'NASA Exoplanet Archive',
    nasaRaw: true,
  };
}

// ── Data Quality Checks ──────────────────────
export function validateAndClean(planets) {
  const report = {
    totalInput: planets.length,
    nullFields: { distance: 0, radius: 0, mass: 0, eqTemp: 0, period: 0, semiMajorAxis: 0 },
    badValues: [],
    duplicates: [],
    controversial: 0,
    cleaned: 0,
    passed: 0,
  };

  // Detect duplicate names
  const nameCounts = {};
  planets.forEach(p => {
    const key = p.name;
    nameCounts[key] = (nameCounts[key] || 0) + 1;
  });
  report.duplicates = Object.entries(nameCounts)
    .filter(([, count]) => count > 1)
    .map(([name, count]) => ({ name, count }));

  const cleaned = [];
  const seenNames = new Set();

  for (const p of planets) {
    // Skip duplicates (keep first occurrence)
    if (seenNames.has(p.name)) {
      report.cleaned++;
      continue;
    }
    seenNames.add(p.name);

    // Count null fields
    if (p.distance == null) report.nullFields.distance++;
    if (p.radius == null) report.nullFields.radius++;
    if (p.mass == null) report.nullFields.mass++;
    if (p.eqTemp == null) report.nullFields.eqTemp++;
    if (p.period == null) report.nullFields.period++;
    if (p.semiMajorAxis == null) report.nullFields.semiMajorAxis++;

    if (p.controversial) report.controversial++;

    // Bad value checks
    let bad = false;
    if (p.radius != null && (p.radius <= 0 || p.radius > 100)) {
      report.badValues.push({ name: p.name, field: 'radius', value: p.radius });
      bad = true;
    }
    if (p.mass != null && (p.mass <= 0 || p.mass > 100000)) {
      report.badValues.push({ name: p.name, field: 'mass', value: p.mass });
      bad = true;
    }
    if (p.distance != null && p.distance <= 0) {
      report.badValues.push({ name: p.name, field: 'distance', value: p.distance });
      bad = true;
    }
    if (p.eqTemp != null && (p.eqTemp < 2 || p.eqTemp > 10000)) {
      report.badValues.push({ name: p.name, field: 'eqTemp', value: p.eqTemp });
    }

    // Provide reasonable defaults for missing key display fields
    if (p.distance == null) p.distance = 0;
    if (p.radius == null) p.radius = 1.0; // assume Earth-like if unknown
    if (p.mass == null) p.mass = p.radius > 4 ? p.radius * 5 : Math.pow(p.radius, 2.5);
    if (p.eqTemp == null) {
      // Estimate from star luminosity and semi-major axis
      if (p.starLum != null && p.semiMajorAxis != null && p.semiMajorAxis > 0) {
        p.eqTemp = Math.round(278 * Math.pow(p.starLum, 0.25) / Math.sqrt(p.semiMajorAxis));
      } else {
        p.eqTemp = 300; // neutral default
      }
      p.eqTempEstimated = true;
    }
    if (p.period == null) p.period = 0;
    if (p.semiMajorAxis == null) p.semiMajorAxis = 0;

    if (!bad) {
      cleaned.push(p);
      report.passed++;
    } else {
      cleaned.push(p); // still include, just flagged
      report.passed++;
    }
  }

  report.totalOutput = cleaned.length;
  return { planets: cleaned, report };
}

// ── Compute Validation Summary Stats ─────────
export function computeValidationReport(planets, report) {
  const withRadius = planets.filter(p => p.radius > 0);
  const withMass = planets.filter(p => p.mass > 0);
  const withTemp = planets.filter(p => p.eqTemp > 0 && !p.eqTempEstimated);
  const withDist = planets.filter(p => p.distance > 0);

  const median = arr => {
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };

  return {
    ...report,
    stats: {
      medianRadius: withRadius.length > 0 ? median(withRadius.map(p => p.radius)).toFixed(2) : 'N/A',
      medianMass: withMass.length > 0 ? median(withMass.map(p => p.mass)).toFixed(2) : 'N/A',
      medianTemp: withTemp.length > 0 ? median(withTemp.map(p => p.eqTemp)).toFixed(0) : 'N/A',
      medianDist: withDist.length > 0 ? median(withDist.map(p => p.distance)).toFixed(1) : 'N/A',
      discoveryMethods: [...new Set(planets.map(p => p.discoveryMethod).filter(Boolean))],
      yearRange: {
        min: Math.min(...planets.map(p => p.discovered).filter(Boolean)),
        max: Math.max(...planets.map(p => p.discovered).filter(Boolean)),
      },
    },
  };
}

// ── Main Data Loading Pipeline ───────────────
// Returns { planets, report, source, fetchedAt, fromCache }
export async function loadNASAPlanets(onProgress) {
  // 1. Check cache first for fast boot
  if (isCacheFresh()) {
    const cached = getCachedData();
    const meta = getCacheMeta();
    if (cached && cached.length > 0) {
      if (onProgress) onProgress({ phase: 'cache-hit', message: `Loaded ${cached.length} planets from cache` });
      return {
        planets: cached,
        report: meta.report || null,
        source: 'cache (fresh)',
        fetchedAt: meta.fetchedAt,
        fromCache: true,
      };
    }
  }

  // 2. Try fetching from NASA API
  try {
    const rawData = await fetchNASAData(onProgress);

    if (onProgress) onProgress({ phase: 'mapping', message: 'Mapping NASA fields to internal schema...' });
    const mapped = rawData.map(mapNASARecord);

    if (onProgress) onProgress({ phase: 'validating', message: 'Running data quality checks...' });
    const { planets, report } = validateAndClean(mapped);

    const fullReport = computeValidationReport(planets, report);

    const fetchedAt = Date.now();
    // Cache the cleaned data
    setCachedData(planets, {
      version: CACHE_VERSION,
      fetchedAt,
      recordCount: planets.length,
      report: fullReport,
    });

    if (onProgress) onProgress({
      phase: 'complete',
      message: `Pipeline complete: ${planets.length} confirmed planets loaded`,
    });

    return {
      planets,
      report: fullReport,
      source: 'NASA Exoplanet Archive (live)',
      fetchedAt,
      fromCache: false,
    };
  } catch (err) {
    console.warn('[NASA-Data] API fetch failed:', err.message);

    // 3. Fall back to stale cache if available
    if (isCacheUsable()) {
      const cached = getCachedData();
      const meta = getCacheMeta();
      if (cached && cached.length > 0) {
        if (onProgress) onProgress({
          phase: 'fallback-cache',
          message: `API unavailable. Using cached data (${cached.length} planets, age: ${formatAge(meta.fetchedAt)})`,
        });
        return {
          planets: cached,
          report: meta.report || null,
          source: `cache (stale, ${formatAge(meta.fetchedAt)} old)`,
          fetchedAt: meta.fetchedAt,
          fromCache: true,
          error: err.message,
        };
      }
    }

    // 4. Ultimate fallback: signal to use built-in curated data
    if (onProgress) onProgress({
      phase: 'fallback-builtin',
      message: 'NASA API unavailable and no cache. Using built-in curated catalog.',
    });
    return {
      planets: null, // signals caller to use built-in
      report: null,
      source: 'built-in fallback',
      fetchedAt: null,
      fromCache: false,
      error: err.message,
    };
  }
}

// ── Background Refresh ───────────────────────
// Fetches fresh data without blocking the UI
export async function backgroundRefresh(onComplete) {
  if (isCacheFresh()) return; // No need

  try {
    const rawData = await fetchNASAData();
    const mapped = rawData.map(mapNASARecord);
    const { planets, report } = validateAndClean(mapped);
    const fullReport = computeValidationReport(planets, report);

    const fetchedAt = Date.now();
    setCachedData(planets, {
      version: CACHE_VERSION,
      fetchedAt,
      recordCount: planets.length,
      report: fullReport,
    });

    if (onComplete) onComplete({ planets, report: fullReport, fetchedAt });
  } catch (err) {
    console.warn('[NASA-Data] Background refresh failed:', err.message);
  }
}

// ── Utilities ────────────────────────────────
function formatAge(timestamp) {
  const ms = Date.now() - timestamp;
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return 'less than 1 hour';
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''}`;
}

export function getLastUpdated() {
  const meta = getCacheMeta();
  if (!meta) return null;
  return {
    timestamp: meta.fetchedAt,
    formatted: new Date(meta.fetchedAt).toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
    age: formatAge(meta.fetchedAt),
    recordCount: meta.recordCount || meta.cachedCount || 0,
  };
}

export function clearCache() {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_META_KEY);
}

// ── Print validation report to console ───────
export function printValidationReport(report) {
  if (!report) return;
  console.group('%c[NASA Data] Validation Report', 'color: #00e5ff; font-weight: bold');
  console.log(`Input records:  ${report.totalInput}`);
  console.log(`Output records: ${report.totalOutput}`);
  console.log(`Cleaned/deduped: ${report.cleaned}`);
  console.log(`Controversial:  ${report.controversial}`);
  console.log('Null fields:', report.nullFields);
  if (report.badValues.length > 0) {
    console.warn('Bad values:', report.badValues.slice(0, 10));
  }
  if (report.duplicates.length > 0) {
    console.warn('Duplicate names:', report.duplicates.slice(0, 10));
  }
  if (report.stats) {
    console.log('Core stats:', report.stats);
  }
  console.groupEnd();
}

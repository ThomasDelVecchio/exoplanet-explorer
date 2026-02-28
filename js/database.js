// ═══════════════════════════════════════════════
// EXOPLANET EXPLORER — PLANET DATABASE
// Real NASA data backbone with curated + procedural fallback
// ═══════════════════════════════════════════════

import { loadNASAPlanets, printValidationReport, getLastUpdated, backgroundRefresh } from './nasa-data.js';
import { enrichPlanet } from './science.js';

// ── Data source state ────────────────────────
let dataSource = 'built-in'; // 'nasa', 'cache', 'built-in'
let dataFetchedAt = null;
let dataReport = null;
let catalogReady = false;
let catalogReadyCallbacks = [];

export function getDataSource() { return dataSource; }
export function getDataFetchedAt() { return dataFetchedAt; }
export function getDataReport() { return dataReport; }
export function isCatalogReady() { return catalogReady; }

export function onCatalogReady(fn) {
  if (catalogReady) { fn(); return; }
  catalogReadyCallbacks.push(fn);
}

function notifyCatalogReady() {
  catalogReady = true;
  catalogReadyCallbacks.forEach(fn => fn());
  catalogReadyCallbacks = [];
}

// ── Planet Classification Types ──────────────
export const PlanetType = {
  HOT_JUPITER: 'Hot Jupiter',
  WARM_JUPITER: 'Warm Jupiter',
  COLD_JUPITER: 'Cold Jupiter',
  HOT_NEPTUNE: 'Hot Neptune',
  WARM_NEPTUNE: 'Warm Neptune',
  SUPER_EARTH: 'Super-Earth',
  ROCKY_TERRESTRIAL: 'Rocky Terrestrial',
  SUB_EARTH: 'Sub-Earth',
  LAVA_WORLD: 'Lava World',
  ICE_GIANT: 'Ice Giant',
  WATER_WORLD: 'Water World',
  DESERT_WORLD: 'Desert World',
  GAS_DWARF: 'Gas Dwarf',
};

// ── Star Spectral Types ─────────────────────
export const StarType = {
  O: 'O-type Blue Supergiant',
  B: 'B-type Blue Giant',
  A: 'A-type White Star',
  F: 'F-type Yellow-White',
  G: 'G-type Yellow Dwarf',
  K: 'K-type Orange Dwarf',
  M: 'M-type Red Dwarf',
  L: 'L-type Brown Dwarf',
};

// ── Visual Profile (drives procedural rendering) ──
// Each planet's visual profile controls shader parameters
export function createVisualProfile(planet) {
  const t = planet.eqTemp || 300;
  const r = planet.radius || 1.0;
  const type = planet.type;

  let profile = {
    // Surface colors
    primaryColor: [0.35, 0.22, 0.08],     // land
    secondaryColor: [0.05, 0.15, 0.55],   // ocean
    tertiaryColor: [0.7, 0.25, 0.02],     // volcanic
    // Atmosphere
    atmosColor: [0.2, 0.5, 0.9],
    atmosIntensity: 1.0,
    atmosDensity: 0.5,
    // Surface
    oceanLevel: 0.02,
    noiseScale: 2.5,
    bioLuminescence: 0.0,
    hasRings: false,
    ringComplexity: 0,
    // Star parameters
    starColor: [0.9, 0.8, 0.4],
    starSize: 0.4,
    starGlowIntensity: 1.5,
    starGlowColor: [1.0, 0.9, 0.5],
  };

  // Type-based visual profiles
  switch (type) {
    case PlanetType.HOT_JUPITER:
      profile.primaryColor = [0.6, 0.3, 0.1];
      profile.secondaryColor = [0.8, 0.4, 0.1];
      profile.tertiaryColor = [1.0, 0.5, 0.0];
      profile.atmosColor = [0.8, 0.4, 0.15];
      profile.atmosIntensity = 2.0;
      profile.atmosDensity = 0.9;
      profile.oceanLevel = -1;
      profile.noiseScale = 1.5;
      profile.hasRings = Math.random() > 0.7;
      profile.ringComplexity = Math.random() > 0.5 ? 2 : 1;
      break;

    case PlanetType.WARM_JUPITER:
      profile.primaryColor = [0.5, 0.35, 0.15];
      profile.secondaryColor = [0.6, 0.45, 0.2];
      profile.tertiaryColor = [0.8, 0.6, 0.1];
      profile.atmosColor = [0.6, 0.4, 0.2];
      profile.atmosIntensity = 1.8;
      profile.atmosDensity = 0.85;
      profile.oceanLevel = -1;
      profile.noiseScale = 1.8;
      profile.hasRings = Math.random() > 0.5;
      profile.ringComplexity = 2;
      break;

    case PlanetType.COLD_JUPITER:
      profile.primaryColor = [0.3, 0.25, 0.2];
      profile.secondaryColor = [0.4, 0.5, 0.6];
      profile.tertiaryColor = [0.5, 0.4, 0.3];
      profile.atmosColor = [0.3, 0.4, 0.6];
      profile.atmosIntensity = 1.6;
      profile.atmosDensity = 0.9;
      profile.oceanLevel = -1;
      profile.noiseScale = 1.2;
      profile.hasRings = Math.random() > 0.3;
      profile.ringComplexity = 3;
      break;

    case PlanetType.HOT_NEPTUNE:
      profile.primaryColor = [0.1, 0.3, 0.6];
      profile.secondaryColor = [0.2, 0.5, 0.8];
      profile.tertiaryColor = [0.4, 0.2, 0.6];
      profile.atmosColor = [0.15, 0.4, 0.8];
      profile.atmosIntensity = 1.5;
      profile.atmosDensity = 0.75;
      profile.oceanLevel = -1;
      profile.noiseScale = 2.0;
      break;

    case PlanetType.WARM_NEPTUNE:
      profile.primaryColor = [0.1, 0.2, 0.5];
      profile.secondaryColor = [0.15, 0.4, 0.7];
      profile.tertiaryColor = [0.3, 0.15, 0.5];
      profile.atmosColor = [0.1, 0.35, 0.7];
      profile.atmosIntensity = 1.4;
      profile.atmosDensity = 0.7;
      profile.oceanLevel = -1;
      profile.noiseScale = 2.2;
      profile.hasRings = Math.random() > 0.7;
      break;

    case PlanetType.SUPER_EARTH:
      profile.primaryColor = [0.3, 0.25, 0.12];
      profile.secondaryColor = [0.08, 0.2, 0.5];
      profile.tertiaryColor = [0.5, 0.2, 0.05];
      profile.atmosColor = [0.2, 0.45, 0.85];
      profile.atmosIntensity = 1.2;
      profile.atmosDensity = 0.5;
      profile.oceanLevel = 0.01;
      profile.noiseScale = 2.8;
      profile.bioLuminescence = t > 200 && t < 350 ? 0.4 : 0;
      break;

    case PlanetType.ROCKY_TERRESTRIAL:
      profile.primaryColor = [0.35, 0.22, 0.08];
      profile.secondaryColor = [0.05, 0.15, 0.55];
      profile.tertiaryColor = [0.7, 0.25, 0.02];
      profile.atmosColor = [0.2, 0.5, 0.9];
      profile.atmosIntensity = 1.2;
      profile.atmosDensity = 0.4;
      profile.oceanLevel = 0.02;
      profile.noiseScale = 2.5;
      profile.bioLuminescence = t > 180 && t < 330 ? 0.8 : 0;
      break;

    case PlanetType.LAVA_WORLD:
      profile.primaryColor = [0.15, 0.05, 0.02];
      profile.secondaryColor = [0.9, 0.2, 0.0];
      profile.tertiaryColor = [1.0, 0.6, 0.0];
      profile.atmosColor = [0.8, 0.2, 0.05];
      profile.atmosIntensity = 1.8;
      profile.atmosDensity = 0.6;
      profile.oceanLevel = 0.04;
      profile.noiseScale = 3.0;
      break;

    case PlanetType.ICE_GIANT:
      profile.primaryColor = [0.6, 0.7, 0.8];
      profile.secondaryColor = [0.3, 0.5, 0.7];
      profile.tertiaryColor = [0.4, 0.55, 0.65];
      profile.atmosColor = [0.4, 0.6, 0.9];
      profile.atmosIntensity = 1.3;
      profile.atmosDensity = 0.8;
      profile.oceanLevel = -1;
      profile.noiseScale = 1.5;
      profile.hasRings = Math.random() > 0.5;
      break;

    case PlanetType.WATER_WORLD:
      profile.primaryColor = [0.02, 0.08, 0.3];
      profile.secondaryColor = [0.0, 0.12, 0.45];
      profile.tertiaryColor = [0.05, 0.2, 0.5];
      profile.atmosColor = [0.1, 0.4, 0.85];
      profile.atmosIntensity = 1.3;
      profile.atmosDensity = 0.55;
      profile.oceanLevel = 0.5;
      profile.noiseScale = 2.0;
      profile.bioLuminescence = t > 260 && t < 320 ? 1.0 : 0;
      break;

    case PlanetType.DESERT_WORLD:
      profile.primaryColor = [0.6, 0.4, 0.2];
      profile.secondaryColor = [0.5, 0.35, 0.15];
      profile.tertiaryColor = [0.7, 0.5, 0.25];
      profile.atmosColor = [0.6, 0.4, 0.25];
      profile.atmosIntensity = 0.8;
      profile.atmosDensity = 0.25;
      profile.oceanLevel = -0.5;
      profile.noiseScale = 3.5;
      break;

    case PlanetType.GAS_DWARF:
      profile.primaryColor = [0.3, 0.3, 0.4];
      profile.secondaryColor = [0.4, 0.35, 0.5];
      profile.tertiaryColor = [0.25, 0.2, 0.35];
      profile.atmosColor = [0.35, 0.3, 0.55];
      profile.atmosIntensity = 1.5;
      profile.atmosDensity = 0.7;
      profile.oceanLevel = -1;
      profile.noiseScale = 1.8;
      break;

    case PlanetType.SUB_EARTH:
      profile.primaryColor = [0.4, 0.35, 0.3];
      profile.secondaryColor = [0.35, 0.3, 0.25];
      profile.tertiaryColor = [0.45, 0.4, 0.35];
      profile.atmosColor = [0.3, 0.3, 0.35];
      profile.atmosIntensity = 0.5;
      profile.atmosDensity = 0.15;
      profile.oceanLevel = -0.8;
      profile.noiseScale = 4.0;
      break;
  }

  // Temperature-based color adjustments
  if (t > 1500) {
    // Ultra-hot: shift toward white/blue
    profile.primaryColor = lerpColor(profile.primaryColor, [0.9, 0.85, 0.9], 0.3);
    profile.atmosColor = lerpColor(profile.atmosColor, [0.7, 0.6, 0.9], 0.4);
  } else if (t > 800) {
    // Hot: warm orange tint
    profile.primaryColor = lerpColor(profile.primaryColor, [0.8, 0.4, 0.1], 0.2);
  } else if (t < 100) {
    // Ultra-cold: blue/white frost
    profile.primaryColor = lerpColor(profile.primaryColor, [0.7, 0.8, 0.95], 0.3);
    profile.secondaryColor = lerpColor(profile.secondaryColor, [0.5, 0.6, 0.8], 0.3);
  }

  // Star type visual adjustments
  if (planet.starType) {
    const st = planet.starType[0];
    switch (st) {
      case 'O': profile.starColor = [0.5, 0.6, 1.0]; profile.starGlowColor = [0.4, 0.5, 1.0]; profile.starSize = 1.2; break;
      case 'B': profile.starColor = [0.6, 0.7, 1.0]; profile.starGlowColor = [0.5, 0.6, 1.0]; profile.starSize = 0.9; break;
      case 'A': profile.starColor = [0.85, 0.88, 1.0]; profile.starGlowColor = [0.8, 0.85, 1.0]; profile.starSize = 0.7; break;
      case 'F': profile.starColor = [1.0, 0.95, 0.8]; profile.starGlowColor = [1.0, 0.95, 0.7]; profile.starSize = 0.6; break;
      case 'G': profile.starColor = [1.0, 0.9, 0.5]; profile.starGlowColor = [1.0, 0.85, 0.4]; profile.starSize = 0.5; break;
      case 'K': profile.starColor = [1.0, 0.6, 0.2]; profile.starGlowColor = [1.0, 0.5, 0.15]; profile.starSize = 0.4; break;
      case 'M': profile.starColor = [0.9, 0.12, 0.05]; profile.starGlowColor = [0.9, 0.15, 0.05]; profile.starSize = 0.3; break;
      case 'L': profile.starColor = [0.5, 0.05, 0.02]; profile.starGlowColor = [0.5, 0.08, 0.02]; profile.starSize = 0.2; break;
    }
  }

  profile.primaryColor = calibrateSurfaceColor(profile.primaryColor, 0.58, 0.92);
  profile.secondaryColor = calibrateSurfaceColor(profile.secondaryColor, 0.62, 0.88);
  profile.tertiaryColor = calibrateSurfaceColor(profile.tertiaryColor, 0.5, 0.86);
  profile.atmosColor = calibrateSurfaceColor(profile.atmosColor, 0.55, 0.9);
  profile.bioLuminescence = Math.min(profile.bioLuminescence * 0.18, 0.22);
  profile.atmosIntensity = clamp01(0.45 + profile.atmosIntensity * 0.4) * 1.8;

  return profile;
}

function lerpColor(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function calibrateSurfaceColor(color, saturation, valueScale) {
  const lum = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
  return [
    clamp01((lum + (color[0] - lum) * saturation) * valueScale),
    clamp01((lum + (color[1] - lum) * saturation) * valueScale),
    clamp01((lum + (color[2] - lum) * saturation) * valueScale),
  ];
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

// ── Habitability Score Calculator ────────────
export function calculateHabitability(planet) {
  let score = 0;
  const t = planet.eqTemp || 0;
  const r = planet.radius || 0;
  const m = planet.mass || 0;

  // Temperature: ideal 200-310K
  if (t >= 200 && t <= 310) score += 0.35;
  else if (t >= 150 && t <= 400) score += 0.15;
  else score += 0.02;

  // Size: Earth-like 0.5-2.5 R⊕
  if (r >= 0.5 && r <= 2.0) score += 0.25;
  else if (r >= 0.3 && r <= 3.0) score += 0.1;
  else score += 0.01;

  // Mass: Earth-like
  if (m > 0) {
    if (m >= 0.3 && m <= 5.0) score += 0.15;
    else if (m >= 0.1 && m <= 10.0) score += 0.05;
  } else {
    score += 0.05; // unknown mass, neutral
  }

  // Star type bonus
  if (planet.starType) {
    const s = planet.starType[0];
    if (s === 'G' || s === 'K') score += 0.15;
    else if (s === 'F' || s === 'M') score += 0.08;
    else score += 0.02;
  } else {
    score += 0.05;
  }

  // Orbital period / semi-major axis (habitable zone proximity)
  if (planet.semiMajorAxis) {
    const a = planet.semiMajorAxis;
    if (a >= 0.5 && a <= 2.0) score += 0.1;
    else if (a >= 0.1 && a <= 5.0) score += 0.04;
  } else {
    score += 0.03;
  }

  return Math.min(Math.round(score * 100) / 100, 1.0);
}

// ── Classify planet type from properties ─────
function classifyPlanet(radius, mass, eqTemp) {
  const r = radius || 1;
  const m = mass || (r > 4 ? r * 5 : r * 1.5);

  if (eqTemp > 1500 && r < 2) return PlanetType.LAVA_WORLD;
  if (r > 8) {
    if (eqTemp > 1000) return PlanetType.HOT_JUPITER;
    if (eqTemp > 400) return PlanetType.WARM_JUPITER;
    return PlanetType.COLD_JUPITER;
  }
  if (r > 3.5) {
    if (eqTemp > 800) return PlanetType.HOT_NEPTUNE;
    if (eqTemp > 200) return PlanetType.WARM_NEPTUNE;
    return PlanetType.ICE_GIANT;
  }
  if (r > 1.6) {
    if (eqTemp > 500) return PlanetType.SUPER_EARTH;
    if (eqTemp > 200) return PlanetType.WATER_WORLD;
    return PlanetType.SUPER_EARTH;
  }
  if (r < 0.5) return PlanetType.SUB_EARTH;
  if (eqTemp > 600) return PlanetType.LAVA_WORLD;
  if (eqTemp < 180) return PlanetType.DESERT_WORLD;
  return PlanetType.ROCKY_TERRESTRIAL;
}

// ── Generate atmosphere composition ──────────
function generateAtmosphere(type, eqTemp) {
  const atmo = [];
  switch (type) {
    case PlanetType.HOT_JUPITER:
    case PlanetType.WARM_JUPITER:
      atmo.push({ gas: 'H₂', pct: 75 + Math.random() * 15 });
      atmo.push({ gas: 'He', pct: 10 + Math.random() * 10 });
      atmo.push({ gas: 'CH₄', pct: Math.random() * 3 });
      break;
    case PlanetType.COLD_JUPITER:
      atmo.push({ gas: 'H₂', pct: 80 + Math.random() * 10 });
      atmo.push({ gas: 'He', pct: 8 + Math.random() * 8 });
      atmo.push({ gas: 'NH₃', pct: Math.random() * 2 });
      break;
    case PlanetType.HOT_NEPTUNE:
    case PlanetType.WARM_NEPTUNE:
      atmo.push({ gas: 'H₂', pct: 50 + Math.random() * 20 });
      atmo.push({ gas: 'He', pct: 15 + Math.random() * 15 });
      atmo.push({ gas: 'H₂O', pct: 5 + Math.random() * 10 });
      break;
    case PlanetType.LAVA_WORLD:
      atmo.push({ gas: 'SiO₂', pct: 40 + Math.random() * 20 });
      atmo.push({ gas: 'Na', pct: 10 + Math.random() * 15 });
      atmo.push({ gas: 'SO₂', pct: 5 + Math.random() * 10 });
      break;
    case PlanetType.WATER_WORLD:
      atmo.push({ gas: 'H₂O', pct: 40 + Math.random() * 30 });
      atmo.push({ gas: 'N₂', pct: 15 + Math.random() * 20 });
      atmo.push({ gas: 'CO₂', pct: 5 + Math.random() * 10 });
      break;
    case PlanetType.ICE_GIANT:
      atmo.push({ gas: 'H₂', pct: 60 + Math.random() * 15 });
      atmo.push({ gas: 'He', pct: 10 + Math.random() * 15 });
      atmo.push({ gas: 'CH₄', pct: 5 + Math.random() * 8 });
      break;
    default: // rocky/terrestrial/super-earth
      if (eqTemp > 200 && eqTemp < 350) {
        atmo.push({ gas: 'N₂', pct: 50 + Math.random() * 30 });
        atmo.push({ gas: 'CO₂', pct: 10 + Math.random() * 30 });
        atmo.push({ gas: 'H₂O', pct: 5 + Math.random() * 20 });
        atmo.push({ gas: 'O₂', pct: Math.random() * 8 });
      } else {
        atmo.push({ gas: 'CO₂', pct: 60 + Math.random() * 25 });
        atmo.push({ gas: 'N₂', pct: 5 + Math.random() * 15 });
        atmo.push({ gas: 'SO₂', pct: Math.random() * 5 });
      }
  }

  // Normalize to ~100%
  const total = atmo.reduce((s, a) => s + a.pct, 0);
  atmo.forEach(a => a.pct = Math.round((a.pct / total) * 1000) / 10);
  return atmo;
}

// ── 120 Curated Real Exoplanets ──────────────
const CURATED_PLANETS = [
  { name: 'TRAPPIST-1b', system: 'TRAPPIST-1', distance: 39.46, radius: 1.116, mass: 1.017, period: 1.511, semiMajorAxis: 0.01154, eqTemp: 400, starType: 'M8V', starTemp: 2566, starMass: 0.0898, starLum: 0.000553, discovered: 2016 },
  { name: 'TRAPPIST-1c', system: 'TRAPPIST-1', distance: 39.46, radius: 1.097, mass: 1.156, period: 2.422, semiMajorAxis: 0.01580, eqTemp: 342, starType: 'M8V', starTemp: 2566, starMass: 0.0898, starLum: 0.000553, discovered: 2016 },
  { name: 'TRAPPIST-1d', system: 'TRAPPIST-1', distance: 39.46, radius: 0.788, mass: 0.297, period: 4.050, semiMajorAxis: 0.02227, eqTemp: 288, starType: 'M8V', starTemp: 2566, starMass: 0.0898, starLum: 0.000553, discovered: 2016 },
  { name: 'TRAPPIST-1e', system: 'TRAPPIST-1', distance: 39.46, radius: 0.920, mass: 0.692, period: 6.101, semiMajorAxis: 0.02925, eqTemp: 251, starType: 'M8V', starTemp: 2566, starMass: 0.0898, starLum: 0.000553, discovered: 2017 },
  { name: 'TRAPPIST-1f', system: 'TRAPPIST-1', distance: 39.46, radius: 1.045, mass: 1.039, period: 9.207, semiMajorAxis: 0.03849, eqTemp: 219, starType: 'M8V', starTemp: 2566, starMass: 0.0898, starLum: 0.000553, discovered: 2017 },
  { name: 'TRAPPIST-1g', system: 'TRAPPIST-1', distance: 39.46, radius: 1.129, mass: 1.321, period: 12.35, semiMajorAxis: 0.04683, eqTemp: 199, starType: 'M8V', starTemp: 2566, starMass: 0.0898, starLum: 0.000553, discovered: 2017 },
  { name: 'TRAPPIST-1h', system: 'TRAPPIST-1', distance: 39.46, radius: 0.755, mass: 0.326, period: 18.77, semiMajorAxis: 0.06189, eqTemp: 173, starType: 'M8V', starTemp: 2566, starMass: 0.0898, starLum: 0.000553, discovered: 2017 },
  { name: 'Proxima Centauri b', system: 'Proxima Centauri', distance: 4.24, radius: 1.03, mass: 1.07, period: 11.186, semiMajorAxis: 0.04857, eqTemp: 234, starType: 'M5.5V', starTemp: 3042, starMass: 0.122, starLum: 0.00155, discovered: 2016 },
  { name: 'Proxima Centauri d', system: 'Proxima Centauri', distance: 4.24, radius: 0.81, mass: 0.26, period: 5.122, semiMajorAxis: 0.02885, eqTemp: 360, starType: 'M5.5V', starTemp: 3042, starMass: 0.122, starLum: 0.00155, discovered: 2022 },
  { name: 'Kepler-22b', system: 'Kepler-22', distance: 635, radius: 2.38, mass: 9.1, period: 289.86, semiMajorAxis: 0.849, eqTemp: 262, starType: 'G5V', starTemp: 5518, starMass: 0.97, starLum: 0.79, discovered: 2011 },
  { name: 'Kepler-442b', system: 'Kepler-442', distance: 1206, radius: 1.34, mass: 2.36, period: 112.3, semiMajorAxis: 0.409, eqTemp: 233, starType: 'K5V', starTemp: 4402, starMass: 0.61, starLum: 0.11, discovered: 2015 },
  { name: 'Kepler-452b', system: 'Kepler-452', distance: 1402, radius: 1.63, mass: 3.29, period: 384.8, semiMajorAxis: 1.046, eqTemp: 265, starType: 'G2V', starTemp: 5757, starMass: 1.037, starLum: 1.2, discovered: 2015 },
  { name: 'Kepler-186f', system: 'Kepler-186', distance: 582, radius: 1.17, mass: 1.71, period: 129.9, semiMajorAxis: 0.432, eqTemp: 188, starType: 'M1V', starTemp: 3788, starMass: 0.544, starLum: 0.041, discovered: 2014 },
  { name: 'Kepler-62e', system: 'Kepler-62', distance: 1200, radius: 1.61, mass: 4.5, period: 122.4, semiMajorAxis: 0.427, eqTemp: 270, starType: 'K2V', starTemp: 4925, starMass: 0.69, starLum: 0.21, discovered: 2013 },
  { name: 'Kepler-62f', system: 'Kepler-62', distance: 1200, radius: 1.41, mass: 2.8, period: 267.3, semiMajorAxis: 0.718, eqTemp: 208, starType: 'K2V', starTemp: 4925, starMass: 0.69, starLum: 0.21, discovered: 2013 },
  { name: 'Kepler-438b', system: 'Kepler-438', distance: 473, radius: 1.12, mass: 1.46, period: 35.23, semiMajorAxis: 0.166, eqTemp: 276, starType: 'M0V', starTemp: 3748, starMass: 0.544, starLum: 0.044, discovered: 2015 },
  { name: 'Kepler-296e', system: 'Kepler-296', distance: 737, radius: 1.53, mass: 3.0, period: 34.14, semiMajorAxis: 0.169, eqTemp: 300, starType: 'M2V', starTemp: 3504, starMass: 0.498, starLum: 0.035, discovered: 2014 },
  { name: 'K2-18b', system: 'K2-18', distance: 124, radius: 2.61, mass: 8.63, period: 32.94, semiMajorAxis: 0.1429, eqTemp: 284, starType: 'M2.5V', starTemp: 3457, starMass: 0.496, starLum: 0.028, discovered: 2015 },
  { name: 'TOI-700d', system: 'TOI-700', distance: 101.4, radius: 1.19, mass: 1.57, period: 37.42, semiMajorAxis: 0.163, eqTemp: 269, starType: 'M2V', starTemp: 3480, starMass: 0.415, starLum: 0.023, discovered: 2020 },
  { name: 'TOI-700e', system: 'TOI-700', distance: 101.4, radius: 0.953, mass: 0.818, period: 28.43, semiMajorAxis: 0.134, eqTemp: 295, starType: 'M2V', starTemp: 3480, starMass: 0.415, starLum: 0.023, discovered: 2023 },
  { name: 'LHS 1140b', system: 'LHS 1140', distance: 48.8, radius: 1.73, mass: 5.6, period: 24.73, semiMajorAxis: 0.0946, eqTemp: 235, starType: 'M4.5V', starTemp: 3216, starMass: 0.179, starLum: 0.00441, discovered: 2017 },
  { name: 'GJ 1061d', system: 'GJ 1061', distance: 11.98, radius: 1.16, mass: 1.64, period: 13.03, semiMajorAxis: 0.054, eqTemp: 218, starType: 'M5.5V', starTemp: 2953, starMass: 0.113, starLum: 0.00165, discovered: 2019 },
  { name: 'GJ 667Cc', system: 'GJ 667C', distance: 23.62, radius: 1.54, mass: 3.81, period: 28.14, semiMajorAxis: 0.125, eqTemp: 277, starType: 'M1.5V', starTemp: 3350, starMass: 0.33, starLum: 0.0137, discovered: 2011 },
  { name: 'Ross 128b', system: 'Ross 128', distance: 11.03, radius: 1.10, mass: 1.40, period: 9.866, semiMajorAxis: 0.0496, eqTemp: 292, starType: 'M4V', starTemp: 3192, starMass: 0.168, starLum: 0.00362, discovered: 2017 },
  { name: 'Wolf 1061c', system: 'Wolf 1061', distance: 14.05, radius: 1.64, mass: 3.41, period: 17.87, semiMajorAxis: 0.084, eqTemp: 271, starType: 'M3V', starTemp: 3342, starMass: 0.294, starLum: 0.00955, discovered: 2015 },
  { name: 'Teegarden\'s Star b', system: 'Teegarden\'s Star', distance: 12.5, radius: 1.05, mass: 1.05, period: 4.91, semiMajorAxis: 0.0252, eqTemp: 264, starType: 'M7V', starTemp: 2637, starMass: 0.089, starLum: 0.00073, discovered: 2019 },
  { name: 'Teegarden\'s Star c', system: 'Teegarden\'s Star', distance: 12.5, radius: 1.04, mass: 1.11, period: 11.41, semiMajorAxis: 0.0443, eqTemp: 199, starType: 'M7V', starTemp: 2637, starMass: 0.089, starLum: 0.00073, discovered: 2019 },
  { name: 'Tau Ceti e', system: 'Tau Ceti', distance: 11.91, radius: 1.59, mass: 3.93, period: 162.9, semiMajorAxis: 0.538, eqTemp: 264, starType: 'G8.5V', starTemp: 5344, starMass: 0.783, starLum: 0.488, discovered: 2017 },
  { name: 'Tau Ceti f', system: 'Tau Ceti', distance: 11.91, radius: 1.69, mass: 3.93, period: 636.1, semiMajorAxis: 1.334, eqTemp: 167, starType: 'G8.5V', starTemp: 5344, starMass: 0.783, starLum: 0.488, discovered: 2012 },
  { name: '51 Pegasi b', system: '51 Pegasi', distance: 50.9, radius: 12.1, mass: 150.8, period: 4.231, semiMajorAxis: 0.052, eqTemp: 1284, starType: 'G4V', starTemp: 5793, starMass: 1.11, starLum: 1.36, discovered: 1995 },
  { name: 'HD 209458b', system: 'HD 209458', distance: 159, radius: 15.1, mass: 220, period: 3.525, semiMajorAxis: 0.047, eqTemp: 1449, starType: 'G0V', starTemp: 6065, starMass: 1.148, starLum: 1.77, discovered: 1999 },
  { name: 'WASP-12b', system: 'WASP-12', distance: 1410, radius: 20.9, mass: 464, period: 1.091, semiMajorAxis: 0.0234, eqTemp: 2580, starType: 'G0V', starTemp: 6300, starMass: 1.434, starLum: 3.6, discovered: 2008 },
  { name: 'WASP-17b', system: 'WASP-17', distance: 1306, radius: 22.1, mass: 170, period: 3.735, semiMajorAxis: 0.0515, eqTemp: 1771, starType: 'F6V', starTemp: 6550, starMass: 1.306, starLum: 2.86, discovered: 2009 },
  { name: 'WASP-121b', system: 'WASP-121', distance: 881, radius: 20.4, mass: 376, period: 1.275, semiMajorAxis: 0.0254, eqTemp: 2358, starType: 'F6V', starTemp: 6459, starMass: 1.353, starLum: 2.91, discovered: 2015 },
  { name: 'WASP-76b', system: 'WASP-76', distance: 634, radius: 20.6, mass: 292, period: 1.810, semiMajorAxis: 0.033, eqTemp: 2160, starType: 'F7V', starTemp: 6329, starMass: 1.458, starLum: 3.33, discovered: 2013 },
  { name: 'WASP-39b', system: 'WASP-39', distance: 700, radius: 14.3, mass: 91, period: 4.055, semiMajorAxis: 0.0486, eqTemp: 1166, starType: 'G7V', starTemp: 5485, starMass: 0.93, starLum: 0.83, discovered: 2011 },
  { name: 'WASP-96b', system: 'WASP-96', distance: 1150, radius: 13.5, mass: 152, period: 3.426, semiMajorAxis: 0.0453, eqTemp: 1285, starType: 'G8V', starTemp: 5500, starMass: 1.06, starLum: 0.94, discovered: 2013 },
  { name: 'HAT-P-11b', system: 'HAT-P-11', distance: 123, radius: 4.36, mass: 25.8, period: 4.888, semiMajorAxis: 0.053, eqTemp: 878, starType: 'K4V', starTemp: 4780, starMass: 0.81, starLum: 0.26, discovered: 2009 },
  { name: 'GJ 1214b', system: 'GJ 1214', distance: 47.7, radius: 2.68, mass: 6.55, period: 1.580, semiMajorAxis: 0.0149, eqTemp: 596, starType: 'M4.5V', starTemp: 3026, starMass: 0.176, starLum: 0.00435, discovered: 2009 },
  { name: 'GJ 436b', system: 'GJ 436', distance: 31.8, radius: 4.22, mass: 21.4, period: 2.644, semiMajorAxis: 0.0291, eqTemp: 712, starType: 'M3.5V', starTemp: 3350, starMass: 0.452, starLum: 0.0253, discovered: 2004 },
  { name: 'HD 189733b', system: 'HD 189733', distance: 64.5, radius: 12.7, mass: 364, period: 2.219, semiMajorAxis: 0.031, eqTemp: 1201, starType: 'K1V', starTemp: 5040, starMass: 0.846, starLum: 0.328, discovered: 2005 },
  { name: 'CoRoT-7b', system: 'CoRoT-7', distance: 489, radius: 1.58, mass: 4.73, period: 0.854, semiMajorAxis: 0.0172, eqTemp: 1810, starType: 'K0V', starTemp: 5275, starMass: 0.93, starLum: 0.71, discovered: 2009 },
  { name: 'Kepler-10b', system: 'Kepler-10', distance: 608, radius: 1.47, mass: 4.56, period: 0.837, semiMajorAxis: 0.01684, eqTemp: 1833, starType: 'G5V', starTemp: 5708, starMass: 0.913, starLum: 0.81, discovered: 2011 },
  { name: 'Kepler-16b', system: 'Kepler-16', distance: 200, radius: 8.45, mass: 106, period: 228.8, semiMajorAxis: 0.7048, eqTemp: 188, starType: 'K5V', starTemp: 4450, starMass: 0.69, starLum: 0.15, discovered: 2011 },
  { name: 'Kepler-11b', system: 'Kepler-11', distance: 2150, radius: 1.97, mass: 4.3, period: 10.30, semiMajorAxis: 0.091, eqTemp: 944, starType: 'G6V', starTemp: 5680, starMass: 0.961, starLum: 1.05, discovered: 2011 },
  { name: 'Kepler-11c', system: 'Kepler-11', distance: 2150, radius: 3.15, mass: 13.5, period: 13.03, semiMajorAxis: 0.106, eqTemp: 877, starType: 'G6V', starTemp: 5680, starMass: 0.961, starLum: 1.05, discovered: 2011 },
  { name: 'Kepler-11d', system: 'Kepler-11', distance: 2150, radius: 3.43, mass: 6.1, period: 22.68, semiMajorAxis: 0.159, eqTemp: 717, starType: 'G6V', starTemp: 5680, starMass: 0.961, starLum: 1.05, discovered: 2011 },
  { name: 'Kepler-20e', system: 'Kepler-20', distance: 929, radius: 0.87, mass: 0.65, period: 6.099, semiMajorAxis: 0.0507, eqTemp: 1040, starType: 'G8V', starTemp: 5466, starMass: 0.912, starLum: 0.704, discovered: 2011 },
  { name: 'Kepler-20f', system: 'Kepler-20', distance: 929, radius: 1.03, mass: 0.78, period: 19.58, semiMajorAxis: 0.1104, eqTemp: 705, starType: 'G8V', starTemp: 5466, starMass: 0.912, starLum: 0.704, discovered: 2011 },
  { name: 'Kepler-37b', system: 'Kepler-37', distance: 209, radius: 0.303, mass: 0.02, period: 13.37, semiMajorAxis: 0.1003, eqTemp: 700, starType: 'G8V', starTemp: 5417, starMass: 0.803, starLum: 0.478, discovered: 2013 },
  { name: 'Kepler-78b', system: 'Kepler-78', distance: 406, radius: 1.20, mass: 1.86, period: 0.355, semiMajorAxis: 0.0089, eqTemp: 2300, starType: 'K0V', starTemp: 5089, starMass: 0.83, starLum: 0.49, discovered: 2013 },
  { name: 'Kepler-90h', system: 'Kepler-90', distance: 2840, radius: 11.3, mass: 203, period: 331.6, semiMajorAxis: 1.01, eqTemp: 292, starType: 'G0V', starTemp: 6080, starMass: 1.2, starLum: 1.95, discovered: 2013 },
  { name: 'Kepler-90g', system: 'Kepler-90', distance: 2840, radius: 8.13, mass: 76, period: 210.6, semiMajorAxis: 0.71, eqTemp: 348, starType: 'G0V', starTemp: 6080, starMass: 1.2, starLum: 1.95, discovered: 2013 },
  { name: 'Kepler-90i', system: 'Kepler-90', distance: 2840, radius: 1.32, mass: 2.5, period: 14.45, semiMajorAxis: 0.1234, eqTemp: 837, starType: 'G0V', starTemp: 6080, starMass: 1.2, starLum: 1.95, discovered: 2017 },
  { name: 'Kepler-1649c', system: 'Kepler-1649', distance: 301, radius: 1.06, mass: 1.2, period: 19.54, semiMajorAxis: 0.0649, eqTemp: 234, starType: 'M5V', starTemp: 3240, starMass: 0.1977, starLum: 0.00515, discovered: 2020 },
  { name: 'Kepler-1647b', system: 'Kepler-1647', distance: 3700, radius: 12.0, mass: 483, period: 1107, semiMajorAxis: 2.72, eqTemp: 239, starType: 'F8V', starTemp: 6210, starMass: 1.22, starLum: 2.02, discovered: 2016 },
  { name: 'HR 8799b', system: 'HR 8799', distance: 129, radius: 12.0, mass: 1750, period: 170000, semiMajorAxis: 68, eqTemp: 870, starType: 'A5V', starTemp: 7430, starMass: 1.56, starLum: 5.05, discovered: 2008 },
  { name: 'HR 8799c', system: 'HR 8799', distance: 129, radius: 12.0, mass: 2200, period: 66000, semiMajorAxis: 38, eqTemp: 1100, starType: 'A5V', starTemp: 7430, starMass: 1.56, starLum: 5.05, discovered: 2008 },
  { name: 'HR 8799d', system: 'HR 8799', distance: 129, radius: 12.0, mass: 2200, period: 37000, semiMajorAxis: 24, eqTemp: 1200, starType: 'A5V', starTemp: 7430, starMass: 1.56, starLum: 5.05, discovered: 2008 },
  { name: 'HR 8799e', system: 'HR 8799', distance: 129, radius: 12.0, mass: 2000, period: 18000, semiMajorAxis: 14.5, eqTemp: 1150, starType: 'A5V', starTemp: 7430, starMass: 1.56, starLum: 5.05, discovered: 2010 },
  { name: 'Beta Pictoris b', system: 'Beta Pictoris', distance: 63.4, radius: 16.7, mass: 3700, period: 7800, semiMajorAxis: 9.0, eqTemp: 1724, starType: 'A6V', starTemp: 8052, starMass: 1.797, starLum: 8.7, discovered: 2008 },
  { name: 'Beta Pictoris c', system: 'Beta Pictoris', distance: 63.4, radius: 13.0, mass: 2600, period: 1227, semiMajorAxis: 2.68, eqTemp: 1250, starType: 'A6V', starTemp: 8052, starMass: 1.797, starLum: 8.7, discovered: 2019 },
  { name: 'Fomalhaut b', system: 'Fomalhaut', distance: 25.13, radius: 11.0, mass: 950, period: 590000, semiMajorAxis: 115, eqTemp: 50, starType: 'A3V', starTemp: 8590, starMass: 1.92, starLum: 16.6, discovered: 2008 },
  { name: '55 Cancri e', system: '55 Cancri', distance: 41.1, radius: 1.88, mass: 8.08, period: 0.737, semiMajorAxis: 0.0154, eqTemp: 2573, starType: 'G8V', starTemp: 5196, starMass: 0.905, starLum: 0.582, discovered: 2004 },
  { name: 'GJ 876d', system: 'GJ 876', distance: 15.2, radius: 1.24, mass: 6.83, period: 1.938, semiMajorAxis: 0.0208, eqTemp: 650, starType: 'M3.5V', starTemp: 3129, starMass: 0.334, starLum: 0.0122, discovered: 2005 },
  { name: 'HD 40307g', system: 'HD 40307', distance: 42.3, radius: 1.80, mass: 7.09, period: 197.8, semiMajorAxis: 0.60, eqTemp: 225, starType: 'K2.5V', starTemp: 4977, starMass: 0.77, starLum: 0.23, discovered: 2012 },
  { name: 'Gliese 581d', system: 'Gliese 581', distance: 20.4, radius: 1.62, mass: 6.98, period: 66.64, semiMajorAxis: 0.22, eqTemp: 220, starType: 'M3V', starTemp: 3498, starMass: 0.31, starLum: 0.013, discovered: 2007 },
  { name: 'Gliese 581g', system: 'Gliese 581', distance: 20.4, radius: 1.29, mass: 3.1, period: 36.6, semiMajorAxis: 0.146, eqTemp: 254, starType: 'M3V', starTemp: 3498, starMass: 0.31, starLum: 0.013, discovered: 2010 },
  { name: 'HD 106906b', system: 'HD 106906', distance: 336, radius: 13.5, mass: 3500, period: 3500000, semiMajorAxis: 738, eqTemp: 1800, starType: 'F5V', starTemp: 6516, starMass: 1.37, starLum: 3.8, discovered: 2013 },
  { name: 'TOI-1452b', system: 'TOI-1452', distance: 100, radius: 1.67, mass: 4.82, period: 11.07, semiMajorAxis: 0.061, eqTemp: 326, starType: 'M4V', starTemp: 3185, starMass: 0.249, starLum: 0.00724, discovered: 2022 },
  { name: 'TOI-715b', system: 'TOI-715', distance: 137, radius: 1.55, mass: 3.02, period: 19.29, semiMajorAxis: 0.083, eqTemp: 234, starType: 'M4V', starTemp: 3075, starMass: 0.248, starLum: 0.0067, discovered: 2024 },
  { name: 'LP 890-9c', system: 'LP 890-9', distance: 105, radius: 1.37, mass: 2.5, period: 8.46, semiMajorAxis: 0.0397, eqTemp: 272, starType: 'M6V', starTemp: 2871, starMass: 0.118, starLum: 0.00143, discovered: 2022 },
  { name: 'GJ 357d', system: 'GJ 357', distance: 31, radius: 1.55, mass: 6.1, period: 55.66, semiMajorAxis: 0.204, eqTemp: 220, starType: 'M2.5V', starTemp: 3505, starMass: 0.342, starLum: 0.016, discovered: 2019 },
  { name: 'Kepler-1229b', system: 'Kepler-1229', distance: 770, radius: 1.40, mass: 2.7, period: 86.83, semiMajorAxis: 0.2896, eqTemp: 213, starType: 'M4V', starTemp: 3724, starMass: 0.54, starLum: 0.037, discovered: 2016 },
  { name: 'TOI-2257b', system: 'TOI-2257', distance: 188, radius: 2.19, mass: 5.5, period: 35.19, semiMajorAxis: 0.145, eqTemp: 256, starType: 'M3V', starTemp: 3441, starMass: 0.34, starLum: 0.0146, discovered: 2021 },
  { name: 'GJ 3470b', system: 'GJ 3470', distance: 29.5, radius: 4.57, mass: 13.9, period: 3.337, semiMajorAxis: 0.036, eqTemp: 615, starType: 'M1.5V', starTemp: 3652, starMass: 0.539, starLum: 0.029, discovered: 2012 },
  { name: 'HAT-P-26b', system: 'HAT-P-26', distance: 437, radius: 6.33, mass: 18.6, period: 4.235, semiMajorAxis: 0.0479, eqTemp: 990, starType: 'K1V', starTemp: 5079, starMass: 0.816, starLum: 0.41, discovered: 2010 },
  { name: 'KELT-9b', system: 'KELT-9', distance: 667, radius: 21.2, mass: 910, period: 1.481, semiMajorAxis: 0.0346, eqTemp: 4050, starType: 'A0V', starTemp: 10170, starMass: 2.52, starLum: 50.6, discovered: 2016 },
  { name: 'GJ 9827d', system: 'GJ 9827', distance: 97.3, radius: 2.02, mass: 4.04, period: 6.202, semiMajorAxis: 0.0559, eqTemp: 680, starType: 'K6V', starTemp: 4255, starMass: 0.606, starLum: 0.094, discovered: 2017 },
  { name: 'TOI-1431b', system: 'TOI-1431', distance: 490, radius: 17.0, mass: 1020, period: 2.650, semiMajorAxis: 0.046, eqTemp: 2370, starType: 'A5V', starTemp: 7670, starMass: 1.92, starLum: 8.4, discovered: 2021 },
  { name: 'WASP-189b', system: 'WASP-189', distance: 322, radius: 18.1, mass: 660, period: 2.724, semiMajorAxis: 0.0501, eqTemp: 2641, starType: 'A6V', starTemp: 8000, starMass: 2.03, starLum: 11.7, discovered: 2018 },
  { name: 'TOI-561b', system: 'TOI-561', distance: 280, radius: 1.37, mass: 1.59, period: 0.447, semiMajorAxis: 0.0106, eqTemp: 2480, starType: 'G9V', starTemp: 5372, starMass: 0.805, starLum: 0.47, discovered: 2021 },
  { name: 'Kepler-138d', system: 'Kepler-138', distance: 219, radius: 1.51, mass: 2.1, period: 23.09, semiMajorAxis: 0.1286, eqTemp: 390, starType: 'M1V', starTemp: 3841, starMass: 0.571, starLum: 0.054, discovered: 2014 },
  { name: 'GJ 486b', system: 'GJ 486', distance: 26.3, radius: 1.31, mass: 2.82, period: 1.467, semiMajorAxis: 0.0173, eqTemp: 700, starType: 'M3.5V', starTemp: 3340, starMass: 0.323, starLum: 0.0112, discovered: 2021 },
  { name: 'TOI-1075b', system: 'TOI-1075', distance: 200, radius: 1.79, mass: 9.95, period: 0.605, semiMajorAxis: 0.011, eqTemp: 1860, starType: 'M0V', starTemp: 3799, starMass: 0.605, starLum: 0.047, discovered: 2022 },
  { name: 'Kepler-34b', system: 'Kepler-34', distance: 4900, radius: 8.56, mass: 69.9, period: 288.8, semiMajorAxis: 1.0896, eqTemp: 290, starType: 'G4V', starTemp: 5913, starMass: 1.048, starLum: 1.39, discovered: 2012 },
  { name: 'Kepler-35b', system: 'Kepler-35', distance: 5400, radius: 8.16, mass: 40.4, period: 131.5, semiMajorAxis: 0.6035, eqTemp: 395, starType: 'G1V', starTemp: 5606, starMass: 0.888, starLum: 0.71, discovered: 2012 },
  { name: 'TOI-4600b', system: 'TOI-4600', distance: 815, radius: 6.80, mass: 56, period: 82.69, semiMajorAxis: 0.304, eqTemp: 347, starType: 'K7V', starTemp: 4105, starMass: 0.638, starLum: 0.085, discovered: 2023 },
  { name: 'TOI-4600c', system: 'TOI-4600', distance: 815, radius: 9.42, mass: 190, period: 482.8, semiMajorAxis: 1.08, eqTemp: 184, starType: 'K7V', starTemp: 4105, starMass: 0.638, starLum: 0.085, discovered: 2023 },
  { name: 'HD 80606b', system: 'HD 80606', distance: 190, radius: 11.0, mass: 1275, period: 111.4, semiMajorAxis: 0.449, eqTemp: 420, starType: 'G5V', starTemp: 5574, starMass: 0.97, starLum: 0.91, discovered: 2001 },
  { name: 'HD 149026b', system: 'HD 149026', distance: 257, radius: 7.71, mass: 114, period: 2.876, semiMajorAxis: 0.0432, eqTemp: 1440, starType: 'G0V', starTemp: 6147, starMass: 1.3, starLum: 2.72, discovered: 2005 },
  { name: 'Kepler-444b', system: 'Kepler-444', distance: 116, radius: 0.403, mass: 0.034, period: 3.600, semiMajorAxis: 0.0418, eqTemp: 1046, starType: 'K0V', starTemp: 5046, starMass: 0.758, starLum: 0.37, discovered: 2015 },
  { name: 'Kepler-444c', system: 'Kepler-444', distance: 116, radius: 0.497, mass: 0.052, period: 4.546, semiMajorAxis: 0.0488, eqTemp: 966, starType: 'K0V', starTemp: 5046, starMass: 0.758, starLum: 0.37, discovered: 2015 },
  { name: 'Kepler-444e', system: 'Kepler-444', distance: 116, radius: 0.546, mass: 0.064, period: 7.743, semiMajorAxis: 0.070, eqTemp: 808, starType: 'K0V', starTemp: 5046, starMass: 0.758, starLum: 0.37, discovered: 2015 },
  { name: 'Kepler-69c', system: 'Kepler-69', distance: 2430, radius: 1.71, mass: 6.0, period: 242.5, semiMajorAxis: 0.64, eqTemp: 285, starType: 'G4V', starTemp: 5638, starMass: 0.81, starLum: 0.65, discovered: 2013 },
  { name: 'Kepler-283c', system: 'Kepler-283', distance: 1743, radius: 1.82, mass: 5.9, period: 92.74, semiMajorAxis: 0.341, eqTemp: 248, starType: 'K5V', starTemp: 4351, starMass: 0.596, starLum: 0.077, discovered: 2014 },
  { name: 'Kepler-440b', system: 'Kepler-440', distance: 851, radius: 1.86, mass: 6.8, period: 101.1, semiMajorAxis: 0.242, eqTemp: 273, starType: 'K0V', starTemp: 4134, starMass: 0.568, starLum: 0.055, discovered: 2015 },
  { name: 'HD 85512b', system: 'HD 85512', distance: 36.4, radius: 1.62, mass: 3.6, period: 58.43, semiMajorAxis: 0.26, eqTemp: 298, starType: 'K6V', starTemp: 4715, starMass: 0.69, starLum: 0.126, discovered: 2011 },
  { name: 'GJ 180c', system: 'GJ 180', distance: 39.0, radius: 1.80, mass: 6.4, period: 24.33, semiMajorAxis: 0.129, eqTemp: 238, starType: 'M2V', starTemp: 3634, starMass: 0.43, starLum: 0.028, discovered: 2014 },
  { name: 'HD 219134b', system: 'HD 219134', distance: 21.25, radius: 1.60, mass: 4.74, period: 3.093, semiMajorAxis: 0.0388, eqTemp: 1015, starType: 'K3V', starTemp: 4699, starMass: 0.804, starLum: 0.265, discovered: 2015 },
  { name: 'Pi Mensae c', system: 'Pi Mensae', distance: 59.7, radius: 2.04, mass: 4.52, period: 6.268, semiMajorAxis: 0.0684, eqTemp: 1170, starType: 'G0V', starTemp: 6037, starMass: 1.094, starLum: 1.52, discovered: 2018 },
  { name: 'TOI-270d', system: 'TOI-270', distance: 73.2, radius: 2.13, mass: 5.4, period: 11.38, semiMajorAxis: 0.0726, eqTemp: 388, starType: 'M3V', starTemp: 3386, starMass: 0.386, starLum: 0.0147, discovered: 2019 },
  { name: 'Kepler-36c', system: 'Kepler-36', distance: 1530, radius: 3.68, mass: 7.13, period: 16.24, semiMajorAxis: 0.1283, eqTemp: 826, starType: 'G1V', starTemp: 5911, starMass: 1.071, starLum: 1.28, discovered: 2012 },
  { name: 'HIP 65426b', system: 'HIP 65426', distance: 385, radius: 16.0, mass: 2300, period: 205000, semiMajorAxis: 92, eqTemp: 1560, starType: 'A2V', starTemp: 8840, starMass: 1.96, starLum: 12.6, discovered: 2017 },
  { name: 'AF Leporis b', system: 'AF Leporis', distance: 87.5, radius: 13.0, mass: 950, period: 26000, semiMajorAxis: 8.2, eqTemp: 800, starType: 'F8V', starTemp: 6190, starMass: 1.2, starLum: 1.97, discovered: 2023 },
  { name: 'TOI-1338b', system: 'TOI-1338', distance: 1320, radius: 6.85, mass: 33, period: 95.17, semiMajorAxis: 0.4607, eqTemp: 467, starType: 'G0V', starTemp: 5940, starMass: 1.04, starLum: 1.13, discovered: 2020 },
  { name: 'Upsilon Andromedae d', system: 'Upsilon Andromedae', distance: 13.47, radius: 13.0, mass: 3248, period: 1276, semiMajorAxis: 2.53, eqTemp: 236, starType: 'F9V', starTemp: 6213, starMass: 1.27, starLum: 3.4, discovered: 1999 },
];

// ── Star Name Parts for Procedural Generation ──
const STAR_PREFIXES = ['HD','GJ','HIP','TYC','2MASS','Kepler','TOI','K2','CoRoT','WASP','HAT-P','HATS','XO','TrES','OGLE','KIC','EPIC','LP','Wolf','Ross','Barnard','LHS','GQ','BD+','CD-','UCAC4','WISE','SDSS','USNO','WDS'];
const GREEK = ['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta','Iota','Kappa','Lambda','Mu','Nu','Xi','Omicron','Pi','Rho','Sigma','Tau','Upsilon','Phi','Chi','Psi','Omega'];
const CONSTELLATIONS = ['Centauri','Cygni','Draconis','Eridani','Bootis','Pegasi','Virginis','Aquilae','Leonis','Ophiuchi','Sagittarii','Lyrae','Scorpii','Ursae Majoris','Cassiopeiae','Orionis','Andromedae','Persei','Geminorum','Tauri','Cancri','Librae','Capricorni','Piscium','Aquarii','Arietis','Pavonis','Tucanae','Gruis','Vela','Puppis','Carinae','Crucis','Lupi','Muscae'];
const PLANET_LETTERS = ['b','c','d','e','f','g','h','i'];

// ── Seeded Random Number Generator ───────────
function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ── Procedural Planet Generator ──────────────
function generateProceduralPlanets(count, startId) {
  const planets = [];
  const rng = seededRandom(42); // Deterministic for consistency

  const starTypes = [
    { type: 'O', temp: [30000, 50000], mass: [16, 90], lum: [30000, 1000000], weight: 0.001 },
    { type: 'B', temp: [10000, 30000], mass: [2.1, 16], lum: [25, 30000], weight: 0.01 },
    { type: 'A', temp: [7500, 10000], mass: [1.4, 2.1], lum: [5, 25], weight: 0.03 },
    { type: 'F', temp: [6000, 7500], mass: [1.04, 1.4], lum: [1.5, 5], weight: 0.08 },
    { type: 'G', temp: [5200, 6000], mass: [0.8, 1.04], lum: [0.6, 1.5], weight: 0.12 },
    { type: 'K', temp: [3700, 5200], mass: [0.45, 0.8], lum: [0.08, 0.6], weight: 0.25 },
    { type: 'M', temp: [2400, 3700], mass: [0.08, 0.45], lum: [0.0001, 0.08], weight: 0.51 },
  ];

  // Generate unique star systems
  const numSystems = Math.ceil(count * 0.6); // ~60% multi-planet systems
  const systems = [];

  for (let i = 0; i < numSystems; i++) {
    // Pick star type weighted
    let roll = rng();
    let cumWeight = 0;
    let starDef = starTypes[6]; // default M-type
    for (const st of starTypes) {
      cumWeight += st.weight;
      if (roll < cumWeight) { starDef = st; break; }
    }

    const starTemp = starDef.temp[0] + rng() * (starDef.temp[1] - starDef.temp[0]);
    const starMass = starDef.mass[0] + rng() * (starDef.mass[1] - starDef.mass[0]);
    const starLum = starDef.lum[0] + rng() * (starDef.lum[1] - starDef.lum[0]);

    // Generate system name
    let systemName;
    if (rng() < 0.4) {
      systemName = `${STAR_PREFIXES[Math.floor(rng() * STAR_PREFIXES.length)]} ${Math.floor(rng() * 99999) + 1}`;
    } else if (rng() < 0.5) {
      systemName = `${GREEK[Math.floor(rng() * GREEK.length)]} ${CONSTELLATIONS[Math.floor(rng() * CONSTELLATIONS.length)]}`;
    } else {
      systemName = `${STAR_PREFIXES[Math.floor(rng() * STAR_PREFIXES.length)]}-${Math.floor(rng() * 9999) + 1}`;
    }

    const distance = 4 + rng() * rng() * 25000; // Skewed toward nearer
    const numPlanets = 1 + Math.floor(rng() * rng() * 7); // 1-7 planets
    const subclass = Math.floor(rng() * 10);
    const lumClass = rng() < 0.9 ? 'V' : (rng() < 0.7 ? 'IV' : 'III');

    systems.push({
      name: systemName,
      starType: `${starDef.type}${subclass}${lumClass}`,
      starTemp: Math.round(starTemp),
      starMass: Math.round(starMass * 1000) / 1000,
      starLum: Math.round(starLum * 100000) / 100000,
      distance: Math.round(distance * 10) / 10,
      numPlanets,
      discovered: 1995 + Math.floor(rng() * 31), // 1995-2025
    });
  }

  // Generate planets for each system
  let planetIdx = 0;
  for (const sys of systems) {
    if (planetIdx >= count) break;

    for (let p = 0; p < sys.numPlanets && planetIdx < count; p++) {
      const letterIdx = p % PLANET_LETTERS.length;

      // Semi-major axis: logarithmically distributed
      const baseAxis = 0.01 * Math.pow(10, rng() * 3.5); // 0.01 to ~300 AU
      const sortedAxis = baseAxis * (1 + p * 0.5); // Outer planets farther

      // Period from Kepler's third law: P² = a³/M_star
      const periodYears = Math.sqrt(Math.pow(sortedAxis, 3) / sys.starMass);
      const periodDays = periodYears * 365.25;

      // Equilibrium temperature: T_eq = T_star * sqrt(R_star / (2*a))
      // Simplified: use luminosity
      const eqTemp = Math.round(278 * Math.pow(sys.starLum, 0.25) / Math.sqrt(sortedAxis));

      // Radius: bimodal distribution (rocky vs gas giant gap)
      let radius;
      const sizeRoll = rng();
      if (sizeRoll < 0.35) radius = 0.3 + rng() * 1.7; // Sub-Earth to Super-Earth
      else if (sizeRoll < 0.55) radius = 2.0 + rng() * 2.5; // Mini-Neptune
      else if (sizeRoll < 0.75) radius = 4.5 + rng() * 4.0; // Neptune-like
      else radius = 8.5 + rng() * 14.5; // Gas giant

      // Mass from radius (mass-radius relationship with scatter)
      let mass;
      if (radius < 1.5) mass = Math.pow(radius, 3.7) * (0.7 + rng() * 0.6);
      else if (radius < 4) mass = Math.pow(radius, 2.5) * (0.8 + rng() * 0.4);
      else mass = Math.pow(radius, 1.5) * (3 + rng() * 10);

      radius = Math.round(radius * 100) / 100;
      mass = Math.round(mass * 100) / 100;

      const type = classifyPlanet(radius, mass, eqTemp);

      const planet = {
        id: startId + planetIdx,
        name: `${sys.name} ${PLANET_LETTERS[letterIdx]}`,
        system: sys.name,
        distance: sys.distance,
        radius,
        mass,
        period: Math.round(periodDays * 100) / 100,
        semiMajorAxis: Math.round(sortedAxis * 10000) / 10000,
        eqTemp: Math.max(3, eqTemp), // minimum 3K (CMB)
        type,
        starType: sys.starType,
        starTemp: sys.starTemp,
        starMass: sys.starMass,
        starLum: sys.starLum,
        discovered: sys.discovered + Math.floor(rng() * 5),
        atmosphere: generateAtmosphere(type, eqTemp),
      };

      planet.habitability = calculateHabitability(planet);
      planets.push(planet);
      planetIdx++;
    }
  }

  return planets;
}

// ── Build the Full Catalog ───────────────────
function buildCatalog() {
  // Process curated planets
  const curated = CURATED_PLANETS.map((p, i) => {
    const type = classifyPlanet(p.radius, p.mass, p.eqTemp);
    const planet = {
      id: i,
      ...p,
      type,
      atmosphere: generateAtmosphere(type, p.eqTemp),
      curated: true,
    };
    planet.habitability = calculateHabitability(planet);
    enrichPlanet(planet);
    return planet;
  });

  // Generate procedural planets
  const procedural = generateProceduralPlanets(4900, curated.length);
  procedural.forEach(p => enrichPlanet(p));

  return [...curated, ...procedural];
}

// ── Export the catalog (mutable — updated by NASA data) ──
export let PLANET_CATALOG = buildCatalog();

// ── Process NASA data into full catalog entries ──
function processNASAPlanets(nasaPlanets) {
  return nasaPlanets.map((p, i) => {
    const type = classifyPlanet(p.radius, p.mass, p.eqTemp);
    const planet = {
      id: i,
      ...p,
      type,
      atmosphere: generateAtmosphere(type, p.eqTemp),
      nasaRaw: true,
    };
    planet.habitability = calculateHabitability(planet);
    enrichPlanet(planet);
    return planet;
  });
}

// ── Initialize catalog from NASA (call at app start) ──
export async function initializeNASACatalog(onProgress) {
  try {
    const result = await loadNASAPlanets(onProgress);

    if (result.planets && result.planets.length > 0) {
      const processed = processNASAPlanets(result.planets);
      PLANET_CATALOG = processed;
      dataSource = result.fromCache ? 'cache' : 'nasa';
      dataFetchedAt = result.fetchedAt;
      dataReport = result.report;
      printValidationReport(result.report);

      if (onProgress) onProgress({
        phase: 'ready',
        message: `${PLANET_CATALOG.length} confirmed planets loaded from ${dataSource}`,
        count: PLANET_CATALOG.length,
      });

      // Schedule background refresh if using cache
      if (result.fromCache) {
        setTimeout(() => {
          backgroundRefresh((refreshResult) => {
            if (refreshResult && refreshResult.planets) {
              const refreshed = processNASAPlanets(refreshResult.planets);
              PLANET_CATALOG = refreshed;
              dataSource = 'nasa';
              dataFetchedAt = refreshResult.fetchedAt;
              dataReport = refreshResult.report;
              window.dispatchEvent(new CustomEvent('catalog-refreshed', {
                detail: { count: PLANET_CATALOG.length }
              }));
            }
          });
        }, 5000);
      }
    } else {
      // Use built-in fallback
      dataSource = 'built-in';
      if (onProgress) onProgress({
        phase: 'ready',
        message: `Using built-in catalog: ${PLANET_CATALOG.length} planets (NASA API unavailable)`,
        count: PLANET_CATALOG.length,
        error: result.error,
      });
    }
  } catch (err) {
    console.warn('[Database] NASA initialization failed:', err);
    dataSource = 'built-in';
    if (onProgress) onProgress({
      phase: 'ready',
      message: `Using built-in catalog: ${PLANET_CATALOG.length} planets`,
      count: PLANET_CATALOG.length,
      error: err.message,
    });
  }

  notifyCatalogReady();
  return PLANET_CATALOG;
}

// ── Search & Filter Functions ────────────────
export function searchPlanets(query, filters = {}) {
  let results = [...PLANET_CATALOG];

  // Text search
  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    results = results.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.system.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      (p.discoveryMethod && p.discoveryMethod.toLowerCase().includes(q)) ||
      (p.constellation && p.constellation.name && p.constellation.name.toLowerCase().includes(q))
    );
  }

  // Type filter
  if (filters.type) {
    results = results.filter(p => p.type === filters.type);
  }

  // Habitability range
  if (filters.minHabitability !== undefined) {
    results = results.filter(p => p.habitability >= filters.minHabitability);
  }

  // Distance range
  if (filters.maxDistance !== undefined) {
    results = results.filter(p => p.distance <= filters.maxDistance);
  }
  if (filters.minDistance !== undefined) {
    results = results.filter(p => p.distance >= filters.minDistance);
  }

  // Temperature range
  if (filters.minTemp !== undefined) {
    results = results.filter(p => p.eqTemp >= filters.minTemp);
  }
  if (filters.maxTemp !== undefined) {
    results = results.filter(p => p.eqTemp <= filters.maxTemp);
  }

  // Radius range
  if (filters.minRadius !== undefined) {
    results = results.filter(p => p.radius >= filters.minRadius);
  }
  if (filters.maxRadius !== undefined) {
    results = results.filter(p => p.radius <= filters.maxRadius);
  }

  // Star type filter
  if (filters.starType) {
    results = results.filter(p => p.starType && p.starType.startsWith(filters.starType));
  }

  // Discovery year
  if (filters.discoveredAfter) {
    results = results.filter(p => p.discovered >= filters.discoveredAfter);
  }

  // Discovery method filter
  if (filters.discoveryMethod) {
    results = results.filter(p => p.discoveryMethod === filters.discoveryMethod);
  }

  // Habitable zone filters
  if (filters.inHZ === 'conservative') {
    results = results.filter(p => p.hzStatus && p.hzStatus.conservative);
  } else if (filters.inHZ === 'optimistic') {
    results = results.filter(p => p.hzStatus && p.hzStatus.optimistic);
  }

  // ESI filter
  if (filters.minESI !== undefined) {
    results = results.filter(p => p.esi && p.esi.global >= filters.minESI);
  }

  // Sort
  const sortBy = filters.sortBy || 'name';
  const sortDir = filters.sortDir || 'asc';
  results.sort((a, b) => {
    let va, vb;
    if (sortBy === 'esi') {
      va = a.esi ? a.esi.global : 0;
      vb = b.esi ? b.esi.global : 0;
    } else {
      va = a[sortBy];
      vb = b[sortBy];
    }
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va == null) va = sortDir === 'asc' ? Infinity : -Infinity;
    if (vb == null) vb = sortDir === 'asc' ? Infinity : -Infinity;
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return results;
}

// ── Get planet by name ───────────────────────
export function getPlanetByName(name) {
  return PLANET_CATALOG.find(p => p.name === name);
}

// ── Get planets in same system ───────────────
export function getSystemPlanets(systemName) {
  return PLANET_CATALOG.filter(p => p.system === systemName);
}

// ── Catalog Statistics ───────────────────────
export function getCatalogStats() {
  const types = {};
  const starTypes = {};
  const methods = {};
  let totalHab = 0;
  let highHabCount = 0;
  let inHZCount = 0;
  let highESICount = 0;

  PLANET_CATALOG.forEach(p => {
    types[p.type] = (types[p.type] || 0) + 1;
    const st = p.starType ? p.starType[0] : '?';
    starTypes[st] = (starTypes[st] || 0) + 1;
    if (p.discoveryMethod) methods[p.discoveryMethod] = (methods[p.discoveryMethod] || 0) + 1;
    totalHab += p.habitability;
    if (p.habitability >= 0.7) highHabCount++;
    if (p.hzStatus && p.hzStatus.optimistic) inHZCount++;
    if (p.esi && p.esi.global >= 0.7) highESICount++;
  });

  return {
    total: PLANET_CATALOG.length,
    types,
    starTypes,
    methods,
    avgHabitability: Math.round((totalHab / PLANET_CATALOG.length) * 100) / 100,
    highHabitabilityCount: highHabCount,
    inHabitableZone: inHZCount,
    highESICount,
    nearestPlanet: PLANET_CATALOG.reduce((a, b) => a.distance < b.distance ? a : b),
    mostHabitable: PLANET_CATALOG.reduce((a, b) => a.habitability > b.habitability ? a : b),
    dataSource,
    lastUpdated: getLastUpdated(),
  };
}

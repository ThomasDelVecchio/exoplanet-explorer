// ═══════════════════════════════════════════════
// EXOPLANET EXPLORER — SCIENCE MODULE
// Habitable zone, ESI, observer utilities,
// discovery method metadata
// ═══════════════════════════════════════════════

// ════════════════════════════════════════════════
// SECTION 1: HABITABLE ZONE CALCULATIONS
// Based on Kopparapu et al. (2013, 2014) model
// "Habitable Zones Around Main-Sequence Stars"
// ════════════════════════════════════════════════

// Kopparapu et al. (2013) HZ coefficients
// Columns: S_eff_sun, a, b, c, d (for T* = T_eff - 5780)
const HZ_COEFFICIENTS = {
  // Conservative limits
  recentVenus:     { S0: 1.7763, a: 1.4335e-4, b: 3.3954e-9,  c: -7.6364e-12, d: -1.1950e-15 },
  runawayGH:       { S0: 1.0385, a: 1.2456e-4, b: 1.4612e-8,  c: -7.6345e-12, d: -1.7511e-15 },
  maxGreenhouse:   { S0: 0.3507, a: 5.9578e-5, b: 1.6707e-9,  c: -3.0058e-12, d: -5.1925e-16 },
  earlyMars:       { S0: 0.3207, a: 5.4471e-5, b: 1.5275e-9,  c: -2.1709e-12, d: -3.8282e-16 },
  // Optimistic limits use recentVenus (inner) and earlyMars (outer)
  // Conservative limits use runawayGH (inner) and maxGreenhouse (outer)
};

/**
 * Calculate habitable zone boundaries for a given host star.
 * @param {number} starTeff - Stellar effective temperature (K)
 * @param {number} starLum  - Stellar luminosity (solar luminosities, linear)
 * @returns {object} HZ boundaries in AU
 *
 * Reference: Kopparapu et al. (2013), ApJ, 765, 131
 * Updated coefficients from Kopparapu et al. (2014)
 */
export function calculateHabitableZone(starTeff, starLum) {
  if (!starTeff || !starLum || starLum <= 0) {
    return null;
  }

  // Clamp T_eff to model validity range (2600K - 7200K)
  const tClamped = Math.max(2600, Math.min(7200, starTeff));
  const tStar = tClamped - 5780; // offset from solar

  function sEff(coeffs) {
    const { S0, a, b, c, d } = coeffs;
    return S0 + a * tStar + b * tStar * tStar + c * Math.pow(tStar, 3) + d * Math.pow(tStar, 4);
  }

  function distAU(sEffVal) {
    return Math.sqrt(starLum / sEffVal);
  }

  const boundaries = {
    // Conservative HZ (more restrictive)
    conservativeInner: distAU(sEff(HZ_COEFFICIENTS.runawayGH)),
    conservativeOuter: distAU(sEff(HZ_COEFFICIENTS.maxGreenhouse)),
    // Optimistic HZ (wider)
    optimisticInner: distAU(sEff(HZ_COEFFICIENTS.recentVenus)),
    optimisticOuter: distAU(sEff(HZ_COEFFICIENTS.earlyMars)),
    // Model metadata
    modelValid: starTeff >= 2600 && starTeff <= 7200,
    modelNote: starTeff < 2600 || starTeff > 7200
      ? `Star T_eff (${starTeff}K) outside model range (2600-7200K); boundaries are extrapolated.`
      : null,
    reference: 'Kopparapu et al. (2013, 2014)',
  };

  return boundaries;
}

/**
 * Determine if a planet is in the habitable zone.
 * Returns { conservative: bool, optimistic: bool, label: string }
 */
export function getHZStatus(planet) {
  const hz = calculateHabitableZone(planet.starTemp, planet.starLum);
  if (!hz || !planet.semiMajorAxis || planet.semiMajorAxis <= 0) {
    return { conservative: false, optimistic: false, label: 'Unknown', hz: null, confidence: 'low' };
  }

  const a = planet.semiMajorAxis;

  const inConservative = a >= hz.conservativeInner && a <= hz.conservativeOuter;
  const inOptimistic = a >= hz.optimisticInner && a <= hz.optimisticOuter;

  let label;
  if (inConservative) label = 'In Conservative HZ';
  else if (inOptimistic) label = 'In Optimistic HZ';
  else if (a < hz.optimisticInner) label = 'Too Hot (inside HZ)';
  else label = 'Too Cold (outside HZ)';

  return {
    conservative: inConservative,
    optimistic: inOptimistic,
    label,
    hz,
    confidence: hz.modelValid ? 'high' : 'moderate',
    caveat: 'Being in the HZ does not guarantee habitability. Atmosphere, magnetic field, tidal locking, and many other factors affect surface conditions.',
  };
}

// ════════════════════════════════════════════════
// SECTION 2: EARTH SIMILARITY INDEX (ESI)
// Based on Schulze-Makuch et al. (2011)
// "A Two-Tiered Approach to Assessing the Habitability of Exoplanets"
// ════════════════════════════════════════════════

// Earth reference values
const EARTH = {
  radius: 1.0,     // R⊕
  mass: 1.0,       // M⊕ (not used directly in standard ESI)
  eqTemp: 255,     // K (effective temperature)
  density: 5.51,   // g/cm³
  escapeVelocity: 11.186, // km/s
};

// ESI weight exponents (Schulze-Makuch et al., 2011)
const ESI_WEIGHTS = {
  radius: 0.57,
  density: 1.07,
  escapeVelocity: 0.70,
  surfaceTemp: 5.58,
};

/**
 * Compute the Earth Similarity Index (ESI) for a planet.
 * ESI = ∏(1 - |x_i - x_E| / (x_i + x_E))^(w_i/n)
 *
 * @param {object} planet
 * @returns {object} { global: number, interior: number, surface: number, components: {} }
 *
 * Reference: Schulze-Makuch et al. (2011), Astrobiology, 11(10), 1041-1052
 */
export function calculateESI(planet) {
  if (!planet.radius || !planet.eqTemp) {
    return { global: 0, interior: null, surface: null, components: {}, confidence: 'low',
             note: 'Insufficient data to compute ESI.' };
  }

  function esiComponent(planetVal, earthVal, weight) {
    if (planetVal == null || planetVal <= 0) return null;
    const ratio = Math.abs(planetVal - earthVal) / (planetVal + earthVal);
    return Math.pow(1 - ratio, weight);
  }

  // Estimate density from mass and radius: ρ ∝ M/R³
  // density in g/cm³ = (M/M⊕) / (R/R⊕)³ × 5.51
  const mass = planet.mass || Math.pow(planet.radius, 2.5); // rough M-R relation if no mass
  const density = (mass / Math.pow(planet.radius, 3)) * EARTH.density;

  // Estimate escape velocity: v_esc = sqrt(2GM/R) ∝ sqrt(M/R)
  // in km/s = sqrt(M/M⊕ / (R/R⊕)) × 11.186
  const escapeVelocity = Math.sqrt(mass / planet.radius) * EARTH.escapeVelocity;

  const components = {
    radius: esiComponent(planet.radius, EARTH.radius, ESI_WEIGHTS.radius),
    density: esiComponent(density, EARTH.density, ESI_WEIGHTS.density),
    escapeVelocity: esiComponent(escapeVelocity, EARTH.escapeVelocity, ESI_WEIGHTS.escapeVelocity),
    surfaceTemp: esiComponent(planet.eqTemp, EARTH.eqTemp, ESI_WEIGHTS.surfaceTemp),
  };

  // Interior ESI (radius + density)
  let interior = null;
  if (components.radius != null && components.density != null) {
    interior = Math.pow(components.radius * components.density, 0.5);
  }

  // Surface ESI (escape velocity + temp)
  let surface = null;
  if (components.escapeVelocity != null && components.surfaceTemp != null) {
    surface = Math.pow(components.escapeVelocity * components.surfaceTemp, 0.5);
  }

  // Global ESI
  const validComponents = Object.values(components).filter(v => v != null);
  let global = 0;
  if (validComponents.length > 0) {
    global = Math.pow(validComponents.reduce((a, b) => a * b, 1), 1 / validComponents.length);
  }

  return {
    global: Math.round(global * 1000) / 1000,
    interior: interior != null ? Math.round(interior * 1000) / 1000 : null,
    surface: surface != null ? Math.round(surface * 1000) / 1000 : null,
    components,
    confidence: (planet.mass != null && planet.eqTemp != null && !planet.eqTempEstimated) ? 'high' : 'moderate',
    reference: 'Schulze-Makuch et al. (2011)',
    note: planet.mass == null ? 'Mass estimated from radius using M-R relation.' : null,
  };
}

// ════════════════════════════════════════════════
// SECTION 3: OBSERVER UTILITIES
// Coordinates, constellation, observability
// ════════════════════════════════════════════════

// Constellation boundaries (simplified IAU regions, RA/Dec centers for name lookup)
// Maps RA (hours) + Dec (degrees) to constellation name
const CONSTELLATIONS = [
  { name: 'Andromeda', abbr: 'And', raMin: 22.8, raMax: 2.4, decMin: 21, decMax: 53 },
  { name: 'Aquarius', abbr: 'Aqr', raMin: 20.6, raMax: 23.8, decMin: -25, decMax: 3 },
  { name: 'Aquila', abbr: 'Aql', raMin: 18.8, raMax: 20.6, decMin: -12, decMax: 18 },
  { name: 'Aries', abbr: 'Ari', raMin: 1.5, raMax: 3.5, decMin: 10, decMax: 31 },
  { name: 'Boötes', abbr: 'Boo', raMin: 13.5, raMax: 15.8, decMin: 7, decMax: 55 },
  { name: 'Cancer', abbr: 'Cnc', raMin: 7.9, raMax: 9.3, decMin: 7, decMax: 33 },
  { name: 'Canis Major', abbr: 'CMa', raMin: 6.0, raMax: 7.5, decMin: -33, decMax: -11 },
  { name: 'Capricornus', abbr: 'Cap', raMin: 20.0, raMax: 21.8, decMin: -28, decMax: -8 },
  { name: 'Cassiopeia', abbr: 'Cas', raMin: 22.5, raMax: 3.5, decMin: 46, decMax: 77 },
  { name: 'Centaurus', abbr: 'Cen', raMin: 11.0, raMax: 15.0, decMin: -64, decMax: -30 },
  { name: 'Cetus', abbr: 'Cet', raMin: 23.5, raMax: 3.3, decMin: -25, decMax: 10 },
  { name: 'Cygnus', abbr: 'Cyg', raMin: 19.1, raMax: 21.8, decMin: 28, decMax: 61 },
  { name: 'Draco', abbr: 'Dra', raMin: 9.4, raMax: 20.5, decMin: 48, decMax: 86 },
  { name: 'Eridanus', abbr: 'Eri', raMin: 1.4, raMax: 5.1, decMin: -58, decMax: 0 },
  { name: 'Gemini', abbr: 'Gem', raMin: 5.9, raMax: 8.1, decMin: 10, decMax: 35 },
  { name: 'Hercules', abbr: 'Her', raMin: 16.0, raMax: 18.8, decMin: 14, decMax: 51 },
  { name: 'Hydra', abbr: 'Hya', raMin: 8.1, raMax: 15.0, decMin: -35, decMax: 7 },
  { name: 'Leo', abbr: 'Leo', raMin: 9.3, raMax: 12.0, decMin: -6, decMax: 33 },
  { name: 'Libra', abbr: 'Lib', raMin: 14.2, raMax: 16.0, decMin: -30, decMax: 0 },
  { name: 'Lyra', abbr: 'Lyr', raMin: 18.1, raMax: 19.4, decMin: 25, decMax: 48 },
  { name: 'Ophiuchus', abbr: 'Oph', raMin: 16.0, raMax: 18.0, decMin: -30, decMax: 14 },
  { name: 'Orion', abbr: 'Ori', raMin: 4.5, raMax: 6.4, decMin: -11, decMax: 23 },
  { name: 'Pegasus', abbr: 'Peg', raMin: 21.1, raMax: 0.2, decMin: 2, decMax: 36 },
  { name: 'Perseus', abbr: 'Per', raMin: 1.4, raMax: 4.5, decMin: 31, decMax: 59 },
  { name: 'Pisces', abbr: 'Psc', raMin: 22.5, raMax: 2.0, decMin: -6, decMax: 34 },
  { name: 'Sagittarius', abbr: 'Sgr', raMin: 17.7, raMax: 20.4, decMin: -45, decMax: -12 },
  { name: 'Scorpius', abbr: 'Sco', raMin: 15.8, raMax: 17.8, decMin: -45, decMax: -8 },
  { name: 'Taurus', abbr: 'Tau', raMin: 3.3, raMax: 6.0, decMin: 0, decMax: 31 },
  { name: 'Ursa Major', abbr: 'UMa', raMin: 8.0, raMax: 14.5, decMin: 29, decMax: 73 },
  { name: 'Ursa Minor', abbr: 'UMi', raMin: 0.0, raMax: 24.0, decMin: 66, decMax: 90 },
  { name: 'Virgo', abbr: 'Vir', raMin: 11.6, raMax: 15.0, decMin: -22, decMax: 14 },
  { name: 'Vela', abbr: 'Vel', raMin: 8.0, raMax: 11.0, decMin: -56, decMax: -37 },
  { name: 'Puppis', abbr: 'Pup', raMin: 6.0, raMax: 8.5, decMin: -50, decMax: -11 },
  { name: 'Carina', abbr: 'Car', raMin: 6.0, raMax: 11.3, decMin: -75, decMax: -51 },
  { name: 'Crux', abbr: 'Cru', raMin: 11.9, raMax: 12.6, decMin: -64, decMax: -56 },
];

/**
 * Convert RA (degrees) and Dec (degrees) to formatted sexagesimal strings.
 */
export function formatRADec(raDeg, decDeg) {
  if (raDeg == null || decDeg == null) return { ra: null, dec: null };

  // RA: degrees → hours (0-24h)
  const raH = raDeg / 15;
  const raHours = Math.floor(raH);
  const raMinRem = (raH - raHours) * 60;
  const raMin = Math.floor(raMinRem);
  const raSec = ((raMinRem - raMin) * 60).toFixed(1);

  // Dec: degrees → d m s
  const decSign = decDeg >= 0 ? '+' : '-';
  const decAbs = Math.abs(decDeg);
  const decD = Math.floor(decAbs);
  const decMinRem = (decAbs - decD) * 60;
  const decMin = Math.floor(decMinRem);
  const decSec = ((decMinRem - decMin) * 60).toFixed(0);

  return {
    ra: `${String(raHours).padStart(2, '0')}h ${String(raMin).padStart(2, '0')}m ${String(raSec).padStart(4, '0')}s`,
    dec: `${decSign}${String(decD).padStart(2, '0')}° ${String(decMin).padStart(2, '0')}′ ${String(decSec).padStart(2, '0')}″`,
    raHours: raH,
    decDeg: decDeg,
  };
}

/**
 * Approximate constellation lookup from RA/Dec.
 * This is a simplified lookup — real IAU boundaries are complex polygons.
 */
export function getConstellation(raDeg, decDeg) {
  if (raDeg == null || decDeg == null) return null;

  const raH = raDeg / 15; // convert to hours

  for (const c of CONSTELLATIONS) {
    let raMatch;
    if (c.raMin > c.raMax) {
      // Wraps around 0h
      raMatch = raH >= c.raMin || raH <= c.raMax;
    } else {
      raMatch = raH >= c.raMin && raH <= c.raMax;
    }

    if (raMatch && decDeg >= c.decMin && decDeg <= c.decMax) {
      return { name: c.name, abbreviation: c.abbr };
    }
  }

  return { name: 'Unknown', abbreviation: '---' };
}

/**
 * Best viewing season based on right ascension.
 * Objects are best observed when opposite the Sun in the sky.
 * Sun RA in months: Jan≈19h, Feb≈21h, Mar≈23h, Apr≈1h, ...
 */
export function getObservability(raDeg, decDeg) {
  if (raDeg == null) return null;

  const raH = raDeg / 15;

  // Month when RA is at opposition (approx 12h from Sun)
  // Sun RA by month: 0=Jan(~19.5h), 1=Feb(~21.5h), ...
  const sunRA = [19.5, 21.5, 23.5, 1.5, 3.5, 5.5, 7.5, 9.5, 11.5, 13.5, 15.5, 17.5];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const monthAbbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Find best month (when object is ~12h from Sun)
  let bestMonth = 0;
  let bestDiff = 24;
  for (let m = 0; m < 12; m++) {
    let diff = Math.abs(raH - sunRA[m] + 12);
    if (diff > 12) diff = 24 - diff;
    // Wrap
    let diff2 = Math.abs((raH + 24) - (sunRA[m] + 12));
    if (diff2 > 12) diff2 = 24 - diff2;
    const minDiff = Math.min(diff, diff2);
    if (minDiff < bestDiff) {
      bestDiff = minDiff;
      bestMonth = m;
    }
  }

  // Observable season (best ± 2 months)
  const seasonStart = (bestMonth - 2 + 12) % 12;
  const seasonEnd = (bestMonth + 2) % 12;

  // Hemisphere visibility
  let hemisphere;
  if (decDeg == null) {
    hemisphere = 'Unknown';
  } else if (decDeg > 60) {
    hemisphere = 'Northern hemisphere only';
  } else if (decDeg > 20) {
    hemisphere = 'Best from Northern hemisphere';
  } else if (decDeg > -20) {
    hemisphere = 'Visible from both hemispheres';
  } else if (decDeg > -60) {
    hemisphere = 'Best from Southern hemisphere';
  } else {
    hemisphere = 'Southern hemisphere only';
  }

  // Circumpolar check
  const circumpolarN = decDeg != null && decDeg > 50;
  const circumpolarS = decDeg != null && decDeg < -50;

  return {
    bestMonth: monthNames[bestMonth],
    bestMonthAbbr: monthAbbr[bestMonth],
    bestMonthIndex: bestMonth,
    seasonStart: monthAbbr[seasonStart],
    seasonEnd: monthAbbr[seasonEnd],
    seasonLabel: `${monthAbbr[seasonStart]}–${monthAbbr[seasonEnd]}`,
    hemisphere,
    circumpolarNorth: circumpolarN,
    circumpolarSouth: circumpolarS,
    note: circumpolarN ? 'Circumpolar from far-northern latitudes (always visible).' :
          circumpolarS ? 'Circumpolar from far-southern latitudes (always visible).' : null,
  };
}

/**
 * Apparent magnitude interpretation for amateur observers.
 */
export function getMagnitudeGuidance(vMag) {
  if (vMag == null) return { label: 'Unknown', guidance: 'No magnitude data available.', confidence: 'low' };

  let label, guidance;
  if (vMag < 0) {
    label = 'Very Bright';
    guidance = 'Easily visible to the naked eye, among the brightest stars in the sky.';
  } else if (vMag < 2) {
    label = 'Bright';
    guidance = 'Visible to the naked eye from most locations, even with some light pollution.';
  } else if (vMag < 4) {
    label = 'Moderate';
    guidance = 'Naked-eye visible from suburban skies. Easy target for any binoculars.';
  } else if (vMag < 6) {
    label = 'Dim';
    guidance = 'Near the naked-eye limit. Requires dark skies or binoculars (7×50 or larger).';
  } else if (vMag < 8) {
    label = 'Binocular';
    guidance = 'Not naked-eye visible. Requires binoculars or a small telescope (60mm+).';
  } else if (vMag < 10) {
    label = 'Small Telescope';
    guidance = 'Requires a small telescope (80-150mm aperture) under good conditions.';
  } else if (vMag < 13) {
    label = 'Medium Telescope';
    guidance = 'Requires a medium telescope (150-250mm) and steady skies.';
  } else if (vMag < 16) {
    label = 'Large Telescope';
    guidance = 'Requires a large amateur telescope (300mm+) or astrophotography.';
  } else {
    label = 'Professional Only';
    guidance = 'Too faint for most amateur equipment. Requires observatory-class instruments.';
  }

  return {
    label,
    guidance,
    magnitude: vMag,
    confidence: 'high',
    note: 'Magnitude refers to the host star system brightness, not the planet itself. Exoplanets are not directly visible in amateur telescopes.',
  };
}

// ════════════════════════════════════════════════
// SECTION 4: DISCOVERY METHOD METADATA
// Educational content for each method
// ════════════════════════════════════════════════

export const DISCOVERY_METHODS = {
  'Transit': {
    id: 'transit',
    name: 'Transit',
    shortDesc: 'Planet passes in front of its star, causing a tiny dip in brightness.',
    fullDesc: 'When a planet\'s orbit is aligned so it crosses between its star and Earth, it blocks a small fraction of starlight. By measuring the depth and duration of these periodic dips, astronomers can determine the planet\'s size (radius) and orbital period. Transit observations can also reveal atmospheric composition through transmission spectroscopy.',
    physics: 'The fractional brightness dip equals (R_planet/R_star)². A Jupiter-sized planet blocks ~1% of a Sun-like star; an Earth-sized planet blocks ~0.01%.',
    strengths: ['Measures planet radius directly', 'Enables atmospheric characterization', 'Can detect multiple planets in a system', 'Most prolific method (>75% of discoveries)'],
    limitations: ['Requires precise orbital alignment (~0.5% chance for Earth-like)', 'Biased toward short-period planets', 'Cannot measure mass alone'],
    missions: ['Kepler', 'K2', 'TESS', 'CoRoT', 'CHEOPS', 'PLATO (future)'],
    animationType: 'transit',
  },
  'Radial Velocity': {
    id: 'radialVelocity',
    name: 'Radial Velocity',
    shortDesc: 'Star wobbles due to planet\'s gravity, shifting its light spectrum.',
    fullDesc: 'A planet and its star orbit their common center of mass. The star\'s tiny wobble causes periodic Doppler shifts in its spectrum — blue-shifted when moving toward us, red-shifted when moving away. This "radial velocity" method measures the planet\'s minimum mass and orbital period with high precision.',
    physics: 'The amplitude of the velocity shift depends on the planet\'s mass, orbital distance, and inclination. Jupiter causes the Sun to wobble at ~12.5 m/s; Earth causes only ~0.09 m/s.',
    strengths: ['Measures planet mass (minimum)', 'Works for a wide range of orbital periods', 'First method to detect exoplanets (51 Peg b, 1995)', 'Complements transit method'],
    limitations: ['Only measures minimum mass (m·sin(i))', 'Difficult for small/distant planets', 'Stellar activity can mimic signals'],
    missions: ['HARPS', 'ESPRESSO', 'HIRES/Keck', 'CARMENES', 'MAROON-X'],
    animationType: 'radialVelocity',
  },
  'Direct Imaging': {
    id: 'directImaging',
    name: 'Direct Imaging',
    shortDesc: 'Planet is photographed directly, separated from its star\'s glare.',
    fullDesc: 'Using advanced optics (coronagraphs) and image processing to block the star\'s overwhelming light, astronomers can sometimes photograph planets directly. This works best for young, massive, self-luminous planets far from their stars. Direct imaging reveals the planet\'s actual appearance and enables spectroscopy of its atmosphere.',
    physics: 'Stars outshine planets by factors of 10⁶ (infrared) to 10¹⁰ (visible). Coronagraphs and adaptive optics suppress starlight to reveal the planet\'s thermal emission or reflected light.',
    strengths: ['Provides actual image of the planet', 'Enables direct spectroscopy', 'Works for wide-orbit planets'],
    limitations: ['Only works for young, massive, distant planets', 'Requires extreme contrast (10⁸-10¹⁰)', 'Current tech limited to gas giants'],
    missions: ['GPI', 'SPHERE/VLT', 'JWST', 'Subaru/SCExAO', 'Roman (future)', 'HWO (concept)'],
    animationType: 'directImaging',
  },
  'Microlensing': {
    id: 'microlensing',
    name: 'Gravitational Microlensing',
    shortDesc: 'Planet\'s gravity bends and magnifies light from a background star.',
    fullDesc: 'When a star with a planet passes in front of a more distant background star, gravitational lensing magnifies the background star\'s light. The planet causes a brief spike or anomaly in the magnification curve. This method is unique in being sensitive to distant, cool, low-mass planets — including free-floating planets.',
    physics: 'General relativity predicts that mass bends spacetime, deflecting light. A planetary-mass lens creates a detectable perturbation lasting hours to days atop a stellar lensing event lasting weeks.',
    strengths: ['Sensitive to Earth-mass planets at AU-scale orbits', 'Can detect free-floating planets', 'No host star brightness requirement'],
    limitations: ['Events are one-time, non-repeating', 'Planet distance is poorly constrained', 'Requires continuous monitoring of dense starfields'],
    missions: ['OGLE', 'MOA', 'KMTNet', 'Roman (future)'],
    animationType: 'microlensing',
  },
  'Timing': {
    id: 'timing',
    name: 'Timing Variations',
    shortDesc: 'Periodic changes in signals from pulsars or eclipses reveal hidden planets.',
    fullDesc: 'Pulsars emit extremely regular radio pulses. A planet orbiting a pulsar causes tiny timing variations as the pulsar wobbles. Similarly, eclipsing binary stars show timing changes from third-body perturbations. The first exoplanets ever confirmed (PSR B1257+12, 1992) were found by pulsar timing.',
    physics: 'Pulsar timing can detect timing residuals as small as microseconds, corresponding to planets as small as the Moon. Transit timing variations (TTVs) in multi-planet systems reveal planet masses and eccentricities through gravitational perturbations.',
    strengths: ['Extremely precise', 'Can detect very small planets', 'First confirmed exoplanet method'],
    limitations: ['Only works for pulsars or eclipsing binaries', 'Pulsar planets are rare/exotic', 'Complex orbital analysis required'],
    missions: ['Arecibo (historical)', 'Parkes', 'Kepler (TTV)'],
    animationType: 'timing',
  },
  'Astrometry': {
    id: 'astrometry',
    name: 'Astrometry',
    shortDesc: 'Precisely measuring a star\'s position reveals its wobble from orbiting planets.',
    fullDesc: 'Astrometry measures the exact position of a star on the sky over time. A planet causes the star to trace a tiny ellipse. This is conceptually simple but extremely challenging in practice — the wobble is typically measured in microarcseconds. Gaia is expected to discover thousands of planets this way.',
    physics: 'A Jupiter at 5 AU causes the Sun to wobble by about 500 µas as seen from 10 pc. An Earth would produce only ~0.3 µas. Gaia achieves ~20 µas precision for bright stars.',
    strengths: ['Gives true mass (not minimum)', 'Measures all orbital elements', 'Complementary to radial velocity'],
    limitations: ['Requires extreme positional precision', 'Long observation baselines needed', 'Best for nearby, massive planets'],
    missions: ['Gaia', 'Hipparcos (attempted)', 'VLTI/GRAVITY'],
    animationType: 'astrometry',
  },
  'Transit Timing Variations': {
    id: 'ttv',
    name: 'Transit Timing Variations',
    shortDesc: 'Gravitational tugs from additional planets cause transit times to vary.',
    fullDesc: 'In a multi-planet system, mutual gravitational interactions cause planets to speed up or slow down, shifting their transit times by minutes to hours. By analyzing these Transit Timing Variations (TTVs), astronomers can infer the masses and orbital properties of non-transiting planets.',
    physics: 'Planets near mean-motion resonances (e.g., 2:1 period ratios) show the largest TTVs. The amplitude depends on the perturber\'s mass and the proximity to resonance.',
    strengths: ['Can detect non-transiting planets', 'Provides mass measurements', 'Powerful for resonant systems'],
    limitations: ['Requires multi-planet systems', 'Analysis is model-dependent', 'Works best near resonances'],
    missions: ['Kepler', 'TESS'],
    animationType: 'timing',
  },
  'Imaging': {
    id: 'imaging',
    name: 'Direct Imaging',
    shortDesc: 'Planet photographed directly by blocking the star\'s light.',
    fullDesc: 'Same as Direct Imaging — planet is observed directly using coronagraphic or high-contrast imaging techniques.',
    physics: 'See Direct Imaging.',
    strengths: ['Direct observation of planet light'],
    limitations: ['Limited to young, massive, wide-orbit planets'],
    missions: ['GPI', 'SPHERE', 'JWST'],
    animationType: 'directImaging',
  },
  'Eclipse Timing Variations': {
    id: 'etv',
    name: 'Eclipse Timing Variations',
    shortDesc: 'Changes in eclipse times of binary stars reveal orbiting planets.',
    fullDesc: 'Similar to transit timing variations, but applied to eclipsing binary stars. A planet orbiting the binary system causes the eclipse times to shift periodically.',
    physics: 'The light-travel time effect and gravitational perturbations from the planet shift the observed eclipse times.',
    strengths: ['Can detect circumbinary planets'],
    limitations: ['Complex systems, ambiguous interpretations'],
    missions: ['Kepler', 'TESS'],
    animationType: 'timing',
  },
  'Pulsar Timing': {
    id: 'pulsarTiming',
    name: 'Pulsar Timing',
    shortDesc: 'Ultra-precise timing of pulsar radio pulses reveals planetary companions.',
    fullDesc: 'The first exoplanets ever confirmed were found around pulsar PSR B1257+12 in 1992. Pulsars act as incredibly precise clocks, and planetary companions cause measurable timing residuals.',
    physics: 'Pulsar timing residuals in the microsecond range correspond to light-travel-time delays from the pulsar\'s wobble.',
    strengths: ['Ultra-high precision', 'Historical significance'],
    limitations: ['Only pulsar hosts', 'Exotic environments'],
    missions: ['Arecibo', 'Green Bank Telescope'],
    animationType: 'timing',
  },
  'Orbital Brightness Modulation': {
    id: 'obm',
    name: 'Orbital Brightness Modulation',
    shortDesc: 'Detects planets from their changing reflected/thermal light as they orbit.',
    fullDesc: 'As a planet orbits its star, the combined light of the system changes due to reflected light from the planet and its thermal emission. This method detects planets without requiring transits.',
    physics: 'The variation is proportional to the planet\'s albedo and size, and follows the orbital period.',
    strengths: ['Does not require transits'],
    limitations: ['Only works for hot, close-in planets'],
    missions: ['Kepler', 'TESS'],
    animationType: 'transit',
  },
  'Disk Kinematics': {
    id: 'diskKinematics',
    name: 'Disk Kinematics',
    shortDesc: 'Velocity patterns in protoplanetary disks reveal embedded planets.',
    fullDesc: 'ALMA observations of protoplanetary disks can detect velocity perturbations caused by forming planets. The planet\'s gravity creates characteristic "kinks" in the disk\'s rotation pattern.',
    physics: 'Planets carve gaps in disks and create pressure bumps that alter the local Keplerian velocity field.',
    strengths: ['Observes planet formation in action'],
    limitations: ['Only for young systems with disks'],
    missions: ['ALMA'],
    animationType: 'directImaging',
  },
};

// Normalize discovery method names from NASA data to our keys
const METHOD_ALIASES = {
  'Transit': 'Transit',
  'Radial Velocity': 'Radial Velocity',
  'Direct Imaging': 'Direct Imaging',
  'Microlensing': 'Microlensing',
  'Imaging': 'Direct Imaging',
  'Astrometry': 'Astrometry',
  'Transit Timing Variations': 'Transit Timing Variations',
  'Eclipse Timing Variations': 'Eclipse Timing Variations',
  'Pulsar Timing': 'Pulsar Timing',
  'Pulsation Timing Variations': 'Timing',
  'Orbital Brightness Modulation': 'Orbital Brightness Modulation',
  'Disk Kinematics': 'Disk Kinematics',
};

export function getDiscoveryMethodInfo(methodName) {
  if (!methodName) return null;
  const normalized = METHOD_ALIASES[methodName] || methodName;
  return DISCOVERY_METHODS[normalized] || DISCOVERY_METHODS[methodName] || null;
}

// ════════════════════════════════════════════════
// SECTION 5: ENRICH PLANET DATA
// Attach HZ, ESI, observer info to a planet
// ════════════════════════════════════════════════

export function enrichPlanet(planet) {
  // Habitable zone status
  planet.hzStatus = getHZStatus(planet);

  // Earth Similarity Index
  planet.esi = calculateESI(planet);

  // Observer coordinates
  if (planet.ra != null && planet.dec != null) {
    planet.coords = formatRADec(planet.ra, planet.dec);
    planet.constellation = getConstellation(planet.ra, planet.dec);
    planet.observability = getObservability(planet.ra, planet.dec);
  }

  // Magnitude guidance
  if (planet.vMag != null) {
    planet.magnitudeGuidance = getMagnitudeGuidance(planet.vMag);
  }

  // Discovery method info
  if (planet.discoveryMethod) {
    planet.discoveryMethodInfo = getDiscoveryMethodInfo(planet.discoveryMethod);
  }

  return planet;
}

// ════════════════════════════════════════════════
// SECTION 6: GLOSSARY TOOLTIPS
// Beginner-friendly definitions for astronomy terms
// ════════════════════════════════════════════════

export const GLOSSARY = {
  'Right Ascension': 'The celestial equivalent of longitude. Measured in hours, minutes, and seconds (0h to 24h), it tells you where to point your telescope east-west along the sky\'s equator.',
  'Declination': 'The celestial equivalent of latitude. Measured in degrees (-90° to +90°), it tells you how far above or below the celestial equator an object is.',
  'Apparent Magnitude': 'How bright a star appears from Earth. Lower numbers = brighter. The brightest stars are magnitude 0 or negative; the faintest naked-eye stars are about magnitude 6.',
  'Habitable Zone': 'The range of distances from a star where liquid water could exist on a planet\'s surface — not too hot, not too cold. Sometimes called the "Goldilocks zone." Being in the HZ does not guarantee habitability.',
  'Conservative HZ': 'The narrower, more cautious estimate of the habitable zone. Uses the "runaway greenhouse" inner edge (Venus-like) and "maximum greenhouse" outer edge (early Mars-like). Based on Kopparapu et al. (2013).',
  'Optimistic HZ': 'The wider estimate that includes regions where habitability is less certain. Uses the "recent Venus" inner edge and "early Mars" outer edge — based on the idea that Venus and Mars may once have had surface water.',
  'ESI': 'Earth Similarity Index — a number from 0 to 1 that measures how physically similar a planet is to Earth. Based on radius, density, escape velocity, and surface temperature. ESI = 1.0 would be an exact Earth twin.',
  'Equilibrium Temperature': 'The theoretical temperature a planet would have if it absorbed and re-radiated all incoming starlight uniformly, with no atmosphere. Real surface temperatures depend heavily on atmospheric greenhouse effects.',
  'Semi-Major Axis': 'Half the longest diameter of an elliptical orbit. For nearly circular orbits, it\'s approximately the average distance from the planet to its star. Measured in AU (1 AU = Earth-Sun distance).',
  'Orbital Period': 'The time it takes a planet to complete one full orbit around its star. Earth\'s orbital period is 365.25 days (1 year).',
  'Transit': 'When a planet passes directly between its star and the observer, causing a tiny dip in the star\'s brightness. This is how most exoplanets have been discovered.',
  'Radial Velocity': 'The component of a star\'s velocity toward or away from Earth. Measured via Doppler shifts in the star\'s spectrum. A wobble in radial velocity reveals an orbiting planet.',
  'Light-Year': 'The distance light travels in one year — about 9.46 trillion kilometers (5.88 trillion miles). It\'s a measure of distance, not time.',
  'Stellar Spectral Type': 'A classification of stars by their surface temperature and color. From hottest to coolest: O, B, A, F, G (Sun), K, M. Each letter has subclasses (0-9) and luminosity classes (I-V).',
  'Eccentricity': 'How elongated an orbit is. 0 = perfect circle, close to 1 = very elliptical. Earth\'s eccentricity is 0.017 (nearly circular).',
  'Constellation': 'One of 88 internationally recognized regions of the sky. Named mostly after mythological figures, they serve as a coordinate system for locating objects.',
};

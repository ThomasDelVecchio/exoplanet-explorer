// ═══════════════════════════════════════════════
// EXOPLANET EXPLORER — MAIN APPLICATION
// Three.js 3D Scene: Multi-planet Explorer
// ═══════════════════════════════════════════════

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import {
  planetVertexShader,
  planetFragmentShader,
  atmosphereVertexShader,
  atmosphereFragmentShader,
  ringVertexShader,
  ringFragmentShader,
  starVertexShader,
  starFragmentShader,
  orbitVertexShader,
  orbitFragmentShader,
} from './shaders.js';

import {
  drawAtmosphereWireframe,
  drawHabitabilityGauge,
  drawHabitabilityGraph,
  drawSpectrum,
  updateTimestamp,
} from './ui.js';

import {
  PLANET_CATALOG,
  getPlanetByName,
  createVisualProfile,
  calculateHabitability,
  getSystemPlanets,
  initializeNASACatalog,
  getDataSource,
  getDataFetchedAt,
} from './database.js';

import { initCatalog, toggleCatalog, setCurrentPlanet, hideCatalog, refreshCatalog } from './catalog-ui.js';
import { initWarpSystem, startWarpTravel, updateWarp, isWarping } from './travel.js';
import { drawHZDiagram } from './discovery-animations.js';

// ── Globals ──────────────────────────────────
let scene, camera, renderer, composer, controls;
let planet, atmosphere, rings, star, starGlow, orbitLine;
let clock = new THREE.Clock();
let frameCount = 0;
let bloomPass;
let textureLoader;
let currentSurfaceTexture = null;

const fallbackSurfaceTexture = new THREE.DataTexture(
  new Uint8Array([255, 255, 255, 255]),
  1,
  1,
  THREE.RGBAFormat
);
fallbackSurfaceTexture.needsUpdate = true;
fallbackSurfaceTexture.colorSpace = THREE.SRGBColorSpace;

// Current planet data
let currentPlanet = null;
let currentProfile = null;

// Planet parameters (dynamic)
const PLANET_RADIUS = 1.5;
let STAR_DISTANCE = 12;
const ORBIT_RADIUS = 10;

// ── Initialization ───────────────────────────
function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010108);
  scene.fog = new THREE.FogExp2(0x010108, 0.008);

  // Camera
  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(3.5, 1.5, 4);

  // Renderer
  const canvas = document.getElementById('scene-canvas');
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin('anonymous');

  // Post-processing (bloom)
  composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.35,  // strength
    0.25,  // radius
    0.9    // threshold
  );
  composer.addPass(bloomPass);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 2.5;
  controls.maxDistance = 20;
  controls.target.set(0, 0, 0);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.15;

  // Build scene
  createStarfield();
  createStar();
  createPlanet();
  createAtmosphere();
  createRings();
  createOrbitPath();
  createAmbientLighting();
  createNebulaBackground();

  // Events
  window.addEventListener('resize', onResize);

  // Initialize warp system
  initWarpSystem(scene, camera, clock);

  // Load initial planet (TRAPPIST-1e)
  const initialPlanet = getPlanetByName('TRAPPIST-1e') || PLANET_CATALOG[0];
  loadPlanet(initialPlanet);

  // Initialize catalog (non-fatal if UI catalog fails)
  let catalogInitOk = true;
  try {
    initCatalog(onPlanetSelected);
  } catch (err) {
    catalogInitOk = false;
    console.error('[App] Catalog init failed:', err);
  }

  // Begin NASA data loading (async, non-blocking)
  updateDataStatus('loading', catalogInitOk ? 'LOADING NASA DATA...' : 'CATALOG UI DEGRADED');
  initializeNASACatalog((progress) => {
    if (progress.phase === 'ready') {
      updateDataStatus(
        progress.error ? 'fallback' : 'online',
        progress.error ? 'BUILT-IN DATA' : 'NASA ARCHIVE LIVE'
      );
      refreshCatalog();
      // Reload current planet if it exists in new catalog
      if (currentPlanet) {
        const updated = getPlanetByName(currentPlanet.name);
        if (updated) loadPlanet(updated);
      }
    } else if (progress.phase === 'fetching') {
      updateDataStatus('loading', progress.message || 'FETCHING...');
    }
  }).catch(err => {
    console.warn('[App] NASA init error:', err);
    updateDataStatus('fallback', 'BUILT-IN DATA');
  });

  // Listen for background refresh
  window.addEventListener('catalog-refreshed', () => {
    refreshCatalog();
    updateDataStatus('online', 'NASA ARCHIVE LIVE');
    const updated = currentPlanet ? getPlanetByName(currentPlanet.name) : null;
    if (updated) loadPlanet(updated);
  });

  // Start
  animate();
  startUIUpdates();
}

// ── Load Planet Data ─────────────────────────
function loadPlanet(planetData) {
  currentPlanet = planetData;
  currentProfile = createVisualProfile(planetData);

  // Update shader uniforms
  updatePlanetVisuals();
  applyRealSurfaceTexture(planetData);
  updateStarVisuals();
  updateTelemetryPanel();
  setCurrentPlanet(planetData);

  // Update header
  const systemLabel = document.querySelector('.system-label');
  const targetLabel = document.querySelector('.target-label');
  if (systemLabel) systemLabel.textContent = `${planetData.system} SYSTEM`;
  if (targetLabel) targetLabel.innerHTML = `TARGET: <strong>${planetData.name}</strong>`;
}

// ── Update Planet Visual Parameters ──────────
function updatePlanetVisuals() {
  if (!planet || !currentProfile) return;
  const p = currentProfile;
  const mat = planet.material;

  mat.uniforms.uOceanColor.value.setRGB(...p.secondaryColor);
  mat.uniforms.uLandColor.value.setRGB(...p.primaryColor);
  mat.uniforms.uVolcanicColor.value.setRGB(...p.tertiaryColor);
  mat.uniforms.uOceanLevel.value = p.oceanLevel;
  mat.uniforms.uNoiseScale.value = p.noiseScale;
  mat.uniforms.uBioLuminescence.value = p.bioLuminescence;

  if (atmosphere) {
    atmosphere.material.uniforms.uAtmoColor.value.setRGB(...p.atmosColor);
    atmosphere.material.uniforms.uAtmoIntensity.value = p.atmosIntensity;
  }
  if (rings) {
    rings.visible = p.hasRings;
  }
}

function hashName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getSurfaceTexturePreset(planetData) {
  if (!planetData || !planetData.type) return null;

  const textureBase = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/';
  const type = planetData.type;
  const index = hashName(planetData.name || '') % 4;

  if (type.includes('Jupiter') || type === 'Gas Dwarf') {
    const choices = ['earth_atmos_2048.jpg', 'earth_day_4096.jpg'];
    return { url: `${textureBase}${choices[index % choices.length]}`, blend: 0.62 };
  }
  if (type.includes('Neptune') || type === 'Ice Giant') {
    const choices = ['earth_atmos_2048.jpg', 'earth_day_4096.jpg'];
    return { url: `${textureBase}${choices[index % choices.length]}`, blend: 0.58 };
  }
  if (type === 'Water World') {
    const choices = ['earth_atmos_2048.jpg', 'earth_day_4096.jpg'];
    return { url: `${textureBase}${choices[index % choices.length]}`, blend: 0.65 };
  }
  if (type === 'Lava World') {
    const choices = ['moon_1024.jpg', 'earth_night_4096.jpg'];
    return { url: `${textureBase}${choices[index % choices.length]}`, blend: 0.68 };
  }
  if (type === 'Desert World' || type === 'Sub-Earth') {
    const choices = ['moon_1024.jpg', 'earth_day_4096.jpg'];
    return { url: `${textureBase}${choices[index % choices.length]}`, blend: 0.66 };
  }
  if (type === 'Rocky Terrestrial' || type === 'Super-Earth') {
    const choices = ['earth_day_4096.jpg', 'earth_atmos_2048.jpg', 'moon_1024.jpg', 'earth_night_4096.jpg'];
    return { url: `${textureBase}${choices[index]}`, blend: 0.55 };
  }

  return { url: `${textureBase}earth_atmos_2048.jpg`, blend: 0.55 };
}

function applyRealSurfaceTexture(planetData) {
  if (!planet || !planet.material || !textureLoader) return;

  const uniforms = planet.material.uniforms;
  const preset = getSurfaceTexturePreset(planetData);

  if (!preset) {
    uniforms.uSurfaceTexture.value = fallbackSurfaceTexture;
    uniforms.uTextureBlend.value = 0.0;
    uniforms.uUseTexture.value = 0.0;
    return;
  }

  textureLoader.load(
    preset.url,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;

      if (currentSurfaceTexture && currentSurfaceTexture !== fallbackSurfaceTexture) {
        currentSurfaceTexture.dispose();
      }
      currentSurfaceTexture = texture;

      uniforms.uSurfaceTexture.value = texture;
      uniforms.uTextureBlend.value = preset.blend;
      uniforms.uUseTexture.value = 1.0;
    },
    undefined,
    () => {
      uniforms.uSurfaceTexture.value = fallbackSurfaceTexture;
      uniforms.uTextureBlend.value = 0.0;
      uniforms.uUseTexture.value = 0.0;
    }
  );
}

// ── Update Star Visual Parameters ────────────
function updateStarVisuals() {
  if (!currentProfile) return;
  const p = currentProfile;
  if (star) {
    star.material.color.setRGB(...p.starColor);
    star.scale.setScalar(p.starSize / 0.4);
  }
  if (starGlow) {
    starGlow.material.uniforms.uStarColor.value.setRGB(...p.starGlowColor);
    starGlow.material.uniforms.uIntensity.value = p.starGlowIntensity;
  }
}

// ── Update Telemetry Panel ───────────────────
function updateTelemetryPanel() {
  if (!currentPlanet) return;
  const p = currentPlanet;

  setDataValue('DESIGNATION', p.name, 'gold');
  setDataValue('CLASSIFICATION', p.type, 'cyan');
  setDataValue('DISTANCE', `${p.distance.toFixed(2)} <span class="unit">LY</span>`);
  setDataValue('RADIUS', `${p.radius.toFixed(3)} <span class="unit">R⊕</span>`);
  setDataValue('MASS', `${p.mass.toFixed(3)} <span class="unit">M⊕</span>`);
  setDataValue('ORBITAL PERIOD', `${p.period.toFixed(3)} <span class="unit">DAYS</span>`);
  setDataValue('SEMI-MAJOR AXIS', `${p.semiMajorAxis.toFixed(5)} <span class="unit">AU</span>`);

  const eqTempEl = document.getElementById('eq-temp');
  if (eqTempEl) eqTempEl.innerHTML = `${p.eqTemp} <span class="unit">K</span>`;

  const habValue = document.getElementById('hab-value');
  if (habValue) habValue.textContent = p.habitability.toFixed(2);

  if (p.atmosphere && p.atmosphere.length > 0) {
    updateAtmosphereBars(p.atmosphere);
  }
  setStarData(p);
  updateSciencePanels(p);
}

function setDataValue(label, html, colorClass) {
  const items = document.querySelectorAll('.data-item');
  items.forEach(item => {
    const labelEl = item.querySelector('.data-label');
    const valueEl = item.querySelector('.data-value');
    if (labelEl && labelEl.textContent.trim() === label && valueEl) {
      valueEl.innerHTML = html;
      if (colorClass) valueEl.className = `data-value ${colorClass}`;
    }
  });
}

function updateAtmosphereBars(atmoData) {
  const barsContainer = document.querySelector('.atmo-bars');
  if (!barsContainer) return;
  const gases = atmoData.slice(0, 4);
  const gasClasses = { 'CO₂': 'co2', 'H₂O': 'h2o', 'N₂': 'n2', 'O₂': 'o2', 'H₂': 'h2', 'He': 'he', 'CH₄': 'ch4' };
  barsContainer.innerHTML = gases.map(g => {
    const cls = gasClasses[g.gas] || 'co2';
    return `<div class="atmo-bar-item">
        <span class="bar-label">${g.gas}</span>
        <div class="bar-track"><div class="bar-fill ${cls}" style="width: ${g.pct}%"></div></div>
        <span class="bar-pct">${g.pct}%</span>
      </div>`;
  }).join('');
  const atmoValue = document.querySelector('.atmo-value');
  if (atmoValue && gases.length >= 2) {
    atmoValue.textContent = `${gases[0].gas}/${gases[1].gas} MIX`;
  }
}

function setStarData(planetData) {
  const starSection = document.querySelector('.star-section');
  if (!starSection) return;
  const title = starSection.querySelector('.section-title');
  if (title) title.innerHTML = `<span class="icon">★</span> HOST STAR: ${planetData.system}`;
  const grid = starSection.querySelector('.data-grid');
  if (grid) {
    grid.innerHTML = `
      <div class="data-item"><span class="data-label">TYPE</span><span class="data-value red">${planetData.starType || 'Unknown'}</span></div>
      <div class="data-item"><span class="data-label">TEMP</span><span class="data-value">${planetData.starTemp ? planetData.starTemp.toLocaleString() : '?'} <span class="unit">K</span></span></div>
      <div class="data-item"><span class="data-label">LUMINOSITY</span><span class="data-value">${planetData.starLum || '?'} <span class="unit">L☉</span></span></div>
      <div class="data-item"><span class="data-label">MASS</span><span class="data-value">${planetData.starMass || '?'} <span class="unit">M☉</span></span></div>
    `;
  }
}

// ── Update HZ / ESI / Observer / Discovery Panels ──
function updateSciencePanels(p) {
  // HZ Section
  const hzSection = document.getElementById('hz-section');
  if (hzSection && p.hzStatus && p.hzStatus.hz) {
    hzSection.style.display = '';
    const hz = p.hzStatus;
    const label = document.getElementById('hz-status-label');
    const badge = document.getElementById('hz-status-badge');
    const consEl = document.getElementById('hz-conservative');
    const optEl = document.getElementById('hz-optimistic');
    const orbitEl = document.getElementById('hz-orbit');
    const caveatEl = document.getElementById('hz-caveat');

    if (label) label.textContent = hz.label;
    if (badge) {
      badge.textContent = hz.conservative ? 'CONSERVATIVE' : hz.optimistic ? 'OPTIMISTIC' : 'OUTSIDE';
      badge.className = 'hz-status-badge ' + (hz.conservative ? 'hz-cons' : hz.optimistic ? 'hz-opt' : 'hz-out');
    }
    if (consEl) consEl.textContent = `${hz.hz.conservativeInner.toFixed(3)} – ${hz.hz.conservativeOuter.toFixed(3)} AU`;
    if (optEl) optEl.textContent = `${hz.hz.optimisticInner.toFixed(3)} – ${hz.hz.optimisticOuter.toFixed(3)} AU`;
    if (orbitEl) orbitEl.textContent = p.semiMajorAxis ? `${p.semiMajorAxis.toFixed(4)} AU` : '—';
    if (caveatEl) caveatEl.textContent = hz.caveat || '';

    // Draw HZ diagram
    const hzCanvas = document.getElementById('hz-diagram-canvas');
    if (hzCanvas) {
      const ctx = hzCanvas.getContext('2d');
      drawHZDiagram(ctx, hzCanvas.width, hzCanvas.height, p);
    }
  } else if (hzSection) {
    hzSection.style.display = 'none';
  }

  // ESI Section
  const esiSection = document.getElementById('esi-section');
  if (esiSection && p.esi) {
    esiSection.style.display = '';
    const esi = p.esi;
    const globalEl = document.getElementById('esi-global');
    if (globalEl) globalEl.textContent = esi.global.toFixed(3);

    const comps = esi.components || {};
    const barsMap = {
      radius: 'esi-bar-radius',
      density: 'esi-bar-density',
      escapeVelocity: 'esi-bar-escvel',
      surfaceTemp: 'esi-bar-temp',
    };
    const valsMap = {
      radius: 'esi-val-radius',
      density: 'esi-val-density',
      escapeVelocity: 'esi-val-escvel',
      surfaceTemp: 'esi-val-temp',
    };
    for (const [key, barId] of Object.entries(barsMap)) {
      const bar = document.getElementById(barId);
      const val = document.getElementById(valsMap[key]);
      const v = comps[key] !== undefined ? comps[key] : 0;
      if (bar) bar.style.width = (v * 100) + '%';
      if (val) val.textContent = v.toFixed(2);
    }
    const confEl = document.getElementById('esi-confidence');
    if (confEl) confEl.textContent = esi.confidence || '';
  } else if (esiSection) {
    esiSection.style.display = 'none';
  }

  // Observer Section
  const obsSection = document.getElementById('observer-section');
  if (obsSection && (p.ra != null || p.dec != null)) {
    obsSection.style.display = '';
    const radecEl = document.getElementById('obs-radec');
    const constEl = document.getElementById('obs-constellation');
    const magEl = document.getElementById('obs-magnitude');
    const viewEl = document.getElementById('obs-viewing');
    const visEl = document.getElementById('obs-visibility');
    const guideEl = document.getElementById('obs-guidance');

    if (radecEl) radecEl.textContent = p.coords ? `${p.coords.ra} / ${p.coords.dec}` : '—';
    if (constEl) constEl.textContent = p.constellation ? `${p.constellation.name} (${p.constellation.abbreviation})` : '—';
    if (magEl) magEl.textContent = p.vMag != null ? `V = ${p.vMag.toFixed(1)}` : '—';
    if (viewEl && p.observability) viewEl.textContent = `${p.observability.bestMonth} (${p.observability.seasonLabel})`;
    if (visEl && p.observability) visEl.textContent = p.observability.hemisphere;
    if (guideEl && p.magnitudeGuidance) guideEl.textContent = `${p.magnitudeGuidance.label}: ${p.magnitudeGuidance.guidance}`;
  } else if (obsSection) {
    obsSection.style.display = 'none';
  }

  // Discovery Section
  const discSection = document.getElementById('discovery-section');
  if (discSection && p.discoveryMethod) {
    discSection.style.display = '';
    const nameEl = document.getElementById('disc-method-name');
    const yearEl = document.getElementById('disc-year');
    const descEl = document.getElementById('disc-description');
    const facEl = document.getElementById('disc-facility');

    if (nameEl) nameEl.textContent = p.discoveryMethod;
    if (yearEl) yearEl.textContent = p.discovered ? `(${p.discovered})` : '';
    if (descEl) descEl.textContent = p.discoveryMethodInfo ? p.discoveryMethodInfo.shortDesc : '';
    if (facEl) facEl.textContent = p.discoveryFacility || '—';
  } else if (discSection) {
    discSection.style.display = 'none';
  }
}

// ── Data Status Indicator ────────────────────
function updateDataStatus(state, text) {
  const dot = document.getElementById('data-status-dot');
  const label = document.getElementById('data-status-text');
  const lastUpdEl = document.getElementById('data-last-updated');
  const srcLabel = document.getElementById('data-source-label');

  if (dot) {
    dot.className = 'status-dot ' + (state === 'online' ? 'online' : state === 'loading' ? 'loading' : 'offline');
  }
  if (label) label.textContent = text;

  const fetchedAt = getDataFetchedAt();
  if (lastUpdEl && fetchedAt) {
    const d = new Date(fetchedAt);
    lastUpdEl.textContent = `Updated: ${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
  }
  if (srcLabel) {
    const src = getDataSource();
    srcLabel.textContent = src === 'nasa' ? '▁▂▃▅▇ NASA LIVE' : src === 'cache' ? '▁▂▃▅ CACHED' : '▁▂▃ BUILT-IN';
  }
}

// ── Planet Selection Handler ─────────────────
function onPlanetSelected(planetData) {
  if (isWarping()) return;
  startWarpTravel(planetData, () => {
    loadPlanet(planetData);
    animateCameraReset();
  });
  hideCatalog();
}

// ── Camera Reset Animation ───────────────────
function animateCameraReset() {
  const target = new THREE.Vector3(3.5, 1.5, 4);
  const startPos = camera.position.clone();
  const startTime = performance.now();
  const duration = 1500;
  function animateCam() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(startPos, target, ease);
    controls.target.set(0, 0, 0);
    if (t < 1) requestAnimationFrame(animateCam);
  }
  animateCam();
}

// ── Starfield ────────────────────────────────
function createStarfield() {
  const count = 6000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;

    // Distribute on a large sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 80 + Math.random() * 120;

    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);

    // Color variety: whites, blues, warm
    const colorChoice = Math.random();
    if (colorChoice < 0.6) {
      colors[i3] = 0.9 + Math.random() * 0.1;
      colors[i3 + 1] = 0.9 + Math.random() * 0.1;
      colors[i3 + 2] = 1.0;
    } else if (colorChoice < 0.8) {
      colors[i3] = 0.6;
      colors[i3 + 1] = 0.8;
      colors[i3 + 2] = 1.0;
    } else {
      colors[i3] = 1.0;
      colors[i3 + 1] = 0.85;
      colors[i3 + 2] = 0.6;
    }

    sizes[i] = Math.random() * 2.0 + 0.5;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
}

// ── Nebula Background ────────────────────────
function createNebulaBackground() {
  // Subtle colored nebula clouds using large transparent planes
  const nebulaGeo = new THREE.PlaneGeometry(200, 200);

  const colors = [
    { color: new THREE.Color(0x1a0030), pos: [-50, 20, -100], rot: [0.2, 0.3, 0] },
    { color: new THREE.Color(0x001030), pos: [60, -30, -90], rot: [-0.1, -0.2, 0.1] },
    { color: new THREE.Color(0x200010), pos: [0, 40, -110], rot: [0, 0, 0.3] },
  ];

  colors.forEach(c => {
    const mat = new THREE.MeshBasicMaterial({
      color: c.color,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(nebulaGeo, mat);
    mesh.position.set(...c.pos);
    mesh.rotation.set(...c.rot);
    scene.add(mesh);
  });
}

// ── Star (TRAPPIST-1) ───────────────────────
function createStar() {
  const starPos = new THREE.Vector3(-STAR_DISTANCE, 2, -6);

  // Physical star sphere
  const starGeo = new THREE.SphereGeometry(0.4, 32, 32);
  const starMat = new THREE.MeshBasicMaterial({
    color: 0xff1a1a,
  });
  star = new THREE.Mesh(starGeo, starMat);
  star.position.copy(starPos);
  scene.add(star);

  // Glow billboard
  const glowGeo = new THREE.PlaneGeometry(6, 6);
  const glowMat = new THREE.ShaderMaterial({
    vertexShader: starVertexShader,
    fragmentShader: starFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uStarColor: { value: new THREE.Color(0.9, 0.12, 0.05) },
      uIntensity: { value: 1.5 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  starGlow = new THREE.Mesh(glowGeo, glowMat);
  starGlow.position.copy(starPos);
  scene.add(starGlow);

  // Point light from star
  const starLight = new THREE.PointLight(0xff3311, 3.0, 50, 1.5);
  starLight.position.copy(starPos);
  scene.add(starLight);

  // Secondary softer fill
  const fillLight = new THREE.PointLight(0xff6644, 0.8, 30, 2);
  fillLight.position.copy(starPos);
  scene.add(fillLight);
}

// ── Planet ───────────────────────────────────
function createPlanet() {
  const geometry = new THREE.SphereGeometry(PLANET_RADIUS, 256, 256);

  const material = new THREE.ShaderMaterial({
    vertexShader: planetVertexShader,
    fragmentShader: planetFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uNoiseScale: { value: 2.5 },
      uStarPosition: { value: new THREE.Vector3(-STAR_DISTANCE, 2, -6) },
      uOceanColor: { value: new THREE.Color(0.08, 0.18, 0.42) },
      uLandColor: { value: new THREE.Color(0.32, 0.26, 0.18) },
      uVolcanicColor: { value: new THREE.Color(0.48, 0.28, 0.2) },
      uOceanLevel: { value: 0.02 },
      uBioLuminescence: { value: 0.0 },
      uSurfaceTexture: { value: fallbackSurfaceTexture },
      uTextureBlend: { value: 0.0 },
      uUseTexture: { value: 0.0 },
    },
  });

  planet = new THREE.Mesh(geometry, material);
  planet.rotation.x = 0.15;
  scene.add(planet);
}

// ── Atmosphere ───────────────────────────────
function createAtmosphere() {
  const geometry = new THREE.SphereGeometry(PLANET_RADIUS * 1.025, 128, 128);

  const material = new THREE.ShaderMaterial({
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uStarPosition: { value: new THREE.Vector3(-STAR_DISTANCE, 2, -6) },
      uAtmoColor: { value: new THREE.Color(0.25, 0.42, 0.7) },
      uAtmoIntensity: { value: 0.85 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });

  atmosphere = new THREE.Mesh(geometry, material);
  scene.add(atmosphere);
}

// ── Rings ────────────────────────────────────
function createRings() {
  // Ring geometry: a flat torus-like disc using a plane
  const innerRadius = PLANET_RADIUS * 1.6;
  const outerRadius = PLANET_RADIUS * 3.2;

  const geometry = new THREE.RingGeometry(innerRadius, outerRadius, 128, 8);

  // Fix UVs for ring geometry
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const dist = Math.sqrt(x * x + y * y);
    const angle = Math.atan2(y, x);
    uv.setXY(i,
      (angle / (Math.PI * 2) + 0.5),
      (dist - innerRadius) / (outerRadius - innerRadius)
    );
  }

  const material = new THREE.ShaderMaterial({
    vertexShader: ringVertexShader,
    fragmentShader: ringFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uStarPosition: { value: new THREE.Vector3(-STAR_DISTANCE, 2, -6) },
      uPlanetPosition: { value: new THREE.Vector3(0, 0, 0) },
      uPlanetRadius: { value: PLANET_RADIUS },
      uInnerRadius: { value: innerRadius },
      uOuterRadius: { value: outerRadius },
    },
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  rings = new THREE.Mesh(geometry, material);
  rings.rotation.x = -Math.PI * 0.42;
  rings.rotation.z = 0.12;
  scene.add(rings);
}

// ── Orbital Path ─────────────────────────────
function createOrbitPath() {
  const segments = 256;
  const positions = new Float32Array(segments * 3);
  const angles = new Float32Array(segments);

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    angles[i] = angle;
    positions[i * 3] = Math.cos(angle) * ORBIT_RADIUS;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = Math.sin(angle) * ORBIT_RADIUS;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: orbitVertexShader,
    fragmentShader: orbitFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uPlanetAngle: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  orbitLine = new THREE.LineLoop(geometry, material);
  orbitLine.rotation.x = -0.15;
  orbitLine.position.set(-STAR_DISTANCE, 2, -6); // Centered on star
  scene.add(orbitLine);
}

// ── Ambient Lighting ─────────────────────────
function createAmbientLighting() {
  // Subtle ambient to prevent total blackness on night side
  const ambient = new THREE.AmbientLight(0x0a1030, 0.15);
  scene.add(ambient);

  // Faint blue fill from the opposite side
  const fillLight = new THREE.DirectionalLight(0x1a3060, 0.08);
  fillLight.position.set(10, -2, 8);
  scene.add(fillLight);
}

// ── Animation Loop ───────────────────────────
function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  const delta = clock.getDelta();
  frameCount++;

  // Update warp travel
  if (isWarping()) {
    updateWarp(delta);
  }

  // Update controls
  controls.update();

  // Rotate planet slowly
  if (planet) {
    planet.rotation.y += 0.001;
    planet.material.uniforms.uTime.value = elapsed;
  }

  // Atmosphere
  if (atmosphere) {
    atmosphere.material.uniforms.uTime.value = elapsed;
  }

  // Rings slow rotation
  if (rings && rings.visible) {
    rings.rotation.z += 0.0002;
    rings.material.uniforms.uTime.value = elapsed;
  }

  // Star glow always face camera
  if (starGlow) {
    starGlow.lookAt(camera.position);
    starGlow.material.uniforms.uTime.value = elapsed;
  }

  // Orbit path
  if (orbitLine) {
    const planetAngle = elapsed * 0.2;
    orbitLine.material.uniforms.uTime.value = elapsed;
    orbitLine.material.uniforms.uPlanetAngle.value = planetAngle % (Math.PI * 2);
  }

  // Render
  composer.render();

  // FPS counter (update every 30 frames)
  if (frameCount % 30 === 0) {
    const fps = Math.round(1 / Math.max(clock.getDelta() || 1 / 60, 0.001));
    const statsEl = document.getElementById('render-stats');
    if (statsEl) {
      statsEl.textContent = `FPS: ${Math.min(fps, 144)} | PLANETS: ${PLANET_CATALOG.length.toLocaleString()} | DRAW: 48`;
    }
  }
}

// ── UI Canvas Updates ────────────────────────
function startUIUpdates() {
  // Atmosphere wireframe
  const atmoCanvas = document.getElementById('atmosphere-canvas');
  const atmoCtx = atmoCanvas ? atmoCanvas.getContext('2d') : null;

  // Habitability gauge
  const habGauge = document.getElementById('habitability-gauge');
  const habCtx = habGauge ? habGauge.getContext('2d') : null;

  // Habitability graph
  const habGraph = document.getElementById('hab-graph');
  const habGraphCtx = habGraph ? habGraph.getContext('2d') : null;

  // Spectrum
  const specCanvas = document.getElementById('spectrum-canvas');
  const specCtx = specCanvas ? specCanvas.getContext('2d') : null;

  function updateUI() {
    const t = performance.now() / 1000;

    if (atmoCtx) drawAtmosphereWireframe(atmoCtx, atmoCanvas.width, atmoCanvas.height, t);
    const habScore = currentPlanet ? currentPlanet.habitability : 0.89;
    if (habCtx) drawHabitabilityGauge(habCtx, habGauge.width, habGauge.height, habScore, t);
    if (habGraphCtx) drawHabitabilityGraph(habGraphCtx, habGraph.width, habGraph.height, t);
    if (specCtx) drawSpectrum(specCtx, specCanvas.width, specCanvas.height, t);

    updateTimestamp();

    requestAnimationFrame(updateUI);
  }

  updateUI();
}

// ── Resize Handler ───────────────────────────
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
  composer.setSize(w, h);
}

// ── Boot ─────────────────────────────────────
init();

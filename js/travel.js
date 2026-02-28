// ═══════════════════════════════════════════════
// EXOPLANET EXPLORER — WARP TRAVEL SYSTEM
// Cinematic hyperspace travel between planets
// ═══════════════════════════════════════════════

import * as THREE from 'three';

// ── Warp State ───────────────────────────────
let warpActive = false;
let warpProgress = 0;
let warpDuration = 3.5; // seconds
let warpStartTime = 0;
let warpCallback = null;
let warpPhase = 'idle'; // idle, accelerate, cruise, decelerate, arrive

// Warp visual objects
let warpParticles = null;
let warpTunnel = null;
let warpFlash = null;
let warpOverlay = null;

// References
let _scene = null;
let _camera = null;
let _clock = null;

// ── Initialize Warp System ───────────────────
export function initWarpSystem(scene, camera, clock) {
  _scene = scene;
  _camera = camera;
  _clock = clock;
  createWarpParticles();
  createWarpTunnel();
  createWarpFlash();
  createWarpOverlay();
}

// ── Speed Lines (Star Streaks) ───────────────
function createWarpParticles() {
  const count = 3000;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    resetParticle(positions, velocities, colors, sizes, i);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: warpParticleVertexShader,
    fragmentShader: warpParticleFragmentShader,
    uniforms: {
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uIntensity: { value: 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  warpParticles = new THREE.Points(geometry, material);
  warpParticles.visible = false;
  warpParticles.frustumCulled = false;
  warpParticles._velocities = velocities;
  _scene.add(warpParticles);
}

function resetParticle(positions, velocities, colors, sizes, i) {
  const i3 = i * 3;
  const angle = Math.random() * Math.PI * 2;
  const radius = 1 + Math.random() * 15;

  positions[i3] = Math.cos(angle) * radius;
  positions[i3 + 1] = Math.sin(angle) * radius;
  positions[i3 + 2] = -50 + Math.random() * 100;

  velocities[i3] = 0;
  velocities[i3 + 1] = 0;
  velocities[i3 + 2] = -(20 + Math.random() * 80);

  const colorChoice = Math.random();
  if (colorChoice < 0.5) {
    colors[i3] = 0.4; colors[i3 + 1] = 0.7; colors[i3 + 2] = 1.0;
  } else if (colorChoice < 0.8) {
    colors[i3] = 0.8; colors[i3 + 1] = 0.9; colors[i3 + 2] = 1.0;
  } else {
    colors[i3] = 0.2; colors[i3 + 1] = 0.5; colors[i3 + 2] = 1.0;
  }

  sizes[i] = 0.5 + Math.random() * 2.0;
}

// ── Warp Tunnel (Hyperspace Corridor) ────────
function createWarpTunnel() {
  const geometry = new THREE.CylinderGeometry(6, 6, 100, 32, 20, true);
  // Invert normals for inside view
  geometry.scale(-1, 1, -1);

  const material = new THREE.ShaderMaterial({
    vertexShader: warpTunnelVertexShader,
    fragmentShader: warpTunnelFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uColor1: { value: new THREE.Color(0x0044aa) },
      uColor2: { value: new THREE.Color(0x00ccff) },
      uColor3: { value: new THREE.Color(0x4400aa) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });

  warpTunnel = new THREE.Mesh(geometry, material);
  warpTunnel.rotation.x = Math.PI / 2;
  warpTunnel.visible = false;
  warpTunnel.frustumCulled = false;
  _scene.add(warpTunnel);
}

// ── Flash Effect ─────────────────────────────
function createWarpFlash() {
  const geometry = new THREE.PlaneGeometry(100, 100);
  const material = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform float uFlash;
      uniform vec3 uFlashColor;
      void main() {
        vec2 center = vUv - 0.5;
        float dist = length(center);
        float flash = uFlash * (1.0 - dist * 1.5);
        flash = max(flash, 0.0);
        gl_FragColor = vec4(uFlashColor * flash, flash);
      }
    `,
    uniforms: {
      uFlash: { value: 0 },
      uFlashColor: { value: new THREE.Color(0.5, 0.8, 1.0) },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });

  warpFlash = new THREE.Mesh(geometry, material);
  warpFlash.visible = false;
  warpFlash.renderOrder = 999;
  warpFlash.frustumCulled = false;
  _scene.add(warpFlash);
}

// ── Screen Overlay (for fade/distortion) ─────
function createWarpOverlay() {
  // DOM overlay for screen effects
  warpOverlay = document.createElement('div');
  warpOverlay.className = 'warp-overlay';
  warpOverlay.innerHTML = `
    <div class="warp-text-container">
      <div class="warp-destination" id="warp-destination"></div>
      <div class="warp-distance" id="warp-distance"></div>
      <div class="warp-speed" id="warp-speed">ENGAGING FTL DRIVE...</div>
      <div class="warp-progress-bar">
        <div class="warp-progress-fill" id="warp-progress-fill"></div>
      </div>
    </div>
    <div class="warp-chromatic-left"></div>
    <div class="warp-chromatic-right"></div>
  `;
  document.body.appendChild(warpOverlay);
}

// ── Start Travel ─────────────────────────────
export function startWarpTravel(targetPlanet, onArrival) {
  if (warpActive) return;

  warpActive = true;
  warpProgress = 0;
  warpPhase = 'accelerate';
  warpStartTime = performance.now() / 1000;
  warpCallback = onArrival;

  // Show destination info
  const destEl = document.getElementById('warp-destination');
  const distEl = document.getElementById('warp-distance');
  const speedEl = document.getElementById('warp-speed');
  if (destEl) destEl.textContent = targetPlanet.name;
  if (distEl) distEl.textContent = `${targetPlanet.distance.toFixed(1)} LIGHT-YEARS`;
  if (speedEl) speedEl.textContent = 'ENGAGING FTL DRIVE...';

  // Activate visuals
  warpOverlay.classList.add('active');
  if (warpParticles) warpParticles.visible = true;
  if (warpTunnel) warpTunnel.visible = true;
  if (warpFlash) warpFlash.visible = true;

  // Play engine sound (visual shake as substitute)
  document.body.classList.add('warp-shake');

  // Dispatch event for other systems
  window.dispatchEvent(new CustomEvent('warp-start', { detail: targetPlanet }));
}

// ── Update Warp (call each frame) ────────────
export function updateWarp(deltaTime) {
  if (!warpActive) return;

  const now = performance.now() / 1000;
  const elapsed = now - warpStartTime;
  warpProgress = Math.min(elapsed / warpDuration, 1.0);

  // Phase transitions
  if (warpProgress < 0.15) {
    warpPhase = 'accelerate';
  } else if (warpProgress < 0.7) {
    warpPhase = 'cruise';
  } else if (warpProgress < 0.92) {
    warpPhase = 'decelerate';
  } else {
    warpPhase = 'arrive';
  }

  // Intensity curve
  let intensity;
  if (warpProgress < 0.15) {
    intensity = easeInCubic(warpProgress / 0.15);
  } else if (warpProgress < 0.7) {
    intensity = 1.0;
  } else if (warpProgress < 0.92) {
    intensity = 1.0 - easeInCubic((warpProgress - 0.7) / 0.22) * 0.3;
  } else {
    intensity = 0.7 * (1.0 - easeOutCubic((warpProgress - 0.92) / 0.08));
  }

  // Update speed text
  const speedEl = document.getElementById('warp-speed');
  if (speedEl) {
    if (warpPhase === 'accelerate') speedEl.textContent = 'ENGAGING FTL DRIVE...';
    else if (warpPhase === 'cruise') speedEl.textContent = `WARP FACTOR ${(5 + intensity * 4).toFixed(1)}`;
    else if (warpPhase === 'decelerate') speedEl.textContent = 'DECELERATING...';
    else speedEl.textContent = 'ARRIVING AT DESTINATION';
  }

  // Progress bar
  const fillEl = document.getElementById('warp-progress-fill');
  if (fillEl) fillEl.style.width = `${warpProgress * 100}%`;

  // Update particles
  updateWarpParticles(intensity, deltaTime);

  // Update tunnel
  if (warpTunnel) {
    warpTunnel.material.uniforms.uTime.value = now;
    warpTunnel.material.uniforms.uProgress.value = intensity;
    warpTunnel.position.copy(_camera.position);
    warpTunnel.quaternion.copy(_camera.quaternion);
  }

  // Flash at start and end
  if (warpFlash) {
    let flashIntensity = 0;
    if (warpProgress < 0.08) {
      flashIntensity = easeOutCubic(warpProgress / 0.08) * 0.6;
    } else if (warpProgress > 0.92) {
      flashIntensity = easeInCubic((warpProgress - 0.92) / 0.08) * 1.0;
    }
    warpFlash.material.uniforms.uFlash.value = flashIntensity;
    warpFlash.position.copy(_camera.position);
    warpFlash.quaternion.copy(_camera.quaternion);
  }

  // Chromatic aberration on overlay
  const chromIntensity = intensity * 8;
  warpOverlay.style.setProperty('--chrom-offset', `${chromIntensity}px`);

  // Completion
  if (warpProgress >= 1.0) {
    endWarp();
  }
}

function updateWarpParticles(intensity, dt) {
  if (!warpParticles || !warpParticles.visible) return;

  const positions = warpParticles.geometry.attributes.position.array;
  const velocities = warpParticles._velocities;
  const count = positions.length / 3;

  warpParticles.material.uniforms.uIntensity.value = intensity;
  warpParticles.material.uniforms.uTime.value = performance.now() / 1000;
  warpParticles.material.uniforms.uProgress.value = warpProgress;

  // Position particles relative to camera
  warpParticles.position.copy(_camera.position);
  warpParticles.quaternion.copy(_camera.quaternion);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3 + 2] += velocities[i3 + 2] * dt * intensity;

    // Recycle particles that passed the camera
    if (positions[i3 + 2] < -50) {
      positions[i3 + 2] = 50;
    }
    if (positions[i3 + 2] > 50) {
      positions[i3 + 2] = -50;
    }
  }

  warpParticles.geometry.attributes.position.needsUpdate = true;
}

// ── End Warp ─────────────────────────────────
function endWarp() {
  warpActive = false;
  warpPhase = 'idle';

  document.body.classList.remove('warp-shake');

  // Fade out overlay
  warpOverlay.classList.add('fade-out');
  setTimeout(() => {
    warpOverlay.classList.remove('active', 'fade-out');
  }, 800);

  // Hide 3D effects
  if (warpParticles) warpParticles.visible = false;
  if (warpTunnel) warpTunnel.visible = false;
  if (warpFlash) warpFlash.visible = false;

  // Trigger arrival
  if (warpCallback) {
    warpCallback();
    warpCallback = null;
  }

  window.dispatchEvent(new CustomEvent('warp-end'));
}

// ── Status ───────────────────────────────────
export function isWarping() {
  return warpActive;
}

export function getWarpProgress() {
  return warpProgress;
}

// ── Easing Functions ─────────────────────────
function easeInCubic(t) { return t * t * t; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOutCubic(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }

// ── Warp Particle Shaders ────────────────────
const warpParticleVertexShader = /* glsl */ `
  attribute float size;
  attribute vec3 color;
  varying vec3 vColor;
  varying float vZ;
  uniform float uIntensity;
  uniform float uProgress;

  void main() {
    vColor = color;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vZ = -mvPos.z;

    // Stretch particles along Z based on intensity
    float stretch = 1.0 + uIntensity * 15.0;
    gl_PointSize = size * (200.0 / -mvPos.z) * (1.0 + uIntensity * 2.0);
    gl_Position = projectionMatrix * mvPos;
  }
`;

const warpParticleFragmentShader = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vZ;
  uniform float uIntensity;
  uniform float uTime;

  void main() {
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;

    // Elongate vertically for streak effect
    float streak = 1.0 - smoothstep(0.0, 0.5, abs(center.x) * (3.0 - uIntensity * 2.0));
    float core = exp(-dist * 4.0);

    float alpha = (core + streak * 0.3) * uIntensity;
    vec3 col = vColor * (1.0 + uIntensity * 0.5);

    gl_FragColor = vec4(col, alpha * 0.8);
  }
`;

// ── Warp Tunnel Shaders ──────────────────────
const warpTunnelVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;

  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const warpTunnelFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vPos;

  uniform float uTime;
  uniform float uProgress;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;

  void main() {
    // Flowing energy bands
    float flow = vUv.y * 20.0 - uTime * 8.0;
    float band1 = sin(flow) * 0.5 + 0.5;
    float band2 = sin(flow * 2.3 + 1.5) * 0.5 + 0.5;
    float band3 = sin(flow * 0.7 + 3.0) * 0.5 + 0.5;

    // Radial fade (brighter at edges)
    float radial = pow(abs(sin(vUv.x * 3.14159)), 0.3);

    // Color mixing
    vec3 color = uColor1 * band1 + uColor2 * band2 * 0.5 + uColor3 * band3 * 0.3;
    color *= radial;

    // Shimmer
    float shimmer = sin(vUv.x * 50.0 + uTime * 3.0) * 0.5 + 0.5;
    color += vec3(0.1, 0.2, 0.4) * shimmer * 0.2;

    float alpha = uProgress * radial * 0.35;
    alpha *= (band1 * 0.5 + 0.5);

    gl_FragColor = vec4(color, alpha);
  }
`;

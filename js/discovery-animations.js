// ═══════════════════════════════════════════════
// EXOPLANET EXPLORER — DISCOVERY METHOD ANIMATIONS
// Lightweight canvas-based educational animations
// for each planet detection technique
// ═══════════════════════════════════════════════

let lowPowerMode = false;

export function setLowPowerMode(enabled) {
  lowPowerMode = enabled;
}

export function isLowPowerMode() {
  return lowPowerMode;
}

// ── Generic animation runner ─────────────────
// Creates a requestAnimationFrame loop for a canvas
export function animateCanvas(canvas, drawFn, durationMs = 8000) {
  if (!canvas || lowPowerMode) {
    // In low-power mode, draw a single static frame
    if (canvas && drawFn) {
      const ctx = canvas.getContext('2d');
      drawFn(ctx, canvas.width, canvas.height, 0.5);
    }
    return { stop: () => {} };
  }

  const ctx = canvas.getContext('2d');
  let animId = null;
  let startTime = performance.now();

  function loop() {
    const elapsed = performance.now() - startTime;
    const t = (elapsed % durationMs) / durationMs; // 0-1 cyclic
    drawFn(ctx, canvas.width, canvas.height, t);
    animId = requestAnimationFrame(loop);
  }
  loop();

  return {
    stop: () => { if (animId) cancelAnimationFrame(animId); },
  };
}

// ════════════════════════════════════════════════
// TRANSIT METHOD ANIMATION
// Shows a planet crossing in front of a star
// with a light curve below
// ════════════════════════════════════════════════
export function drawTransit(ctx, w, h, t) {
  ctx.clearRect(0, 0, w, h);

  const midY = h * 0.35;
  const starR = h * 0.18;
  const planetR = starR * 0.28;
  const curveY = h * 0.72;
  const curveH = h * 0.2;

  // Star (yellow circle with glow)
  const starGrad = ctx.createRadialGradient(w / 2, midY, 0, w / 2, midY, starR * 1.5);
  starGrad.addColorStop(0, '#fff8e1');
  starGrad.addColorStop(0.5, '#ffd740');
  starGrad.addColorStop(0.8, '#ff8f00');
  starGrad.addColorStop(1, 'rgba(255,143,0,0)');
  ctx.beginPath();
  ctx.arc(w / 2, midY, starR * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = starGrad;
  ctx.fill();

  // Star core
  ctx.beginPath();
  ctx.arc(w / 2, midY, starR, 0, Math.PI * 2);
  ctx.fillStyle = '#fff8e1';
  ctx.fill();

  // Planet moving across star
  const planetX = w * 0.15 + t * w * 0.7;
  ctx.beginPath();
  ctx.arc(planetX, midY, planetR, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a2e';
  ctx.fill();

  // Light curve
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.08, curveY);
  ctx.lineTo(w * 0.92, curveY);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 100; i++) {
    const x = w * 0.08 + (i / 100) * w * 0.84;
    const phase = i / 100;
    // Dip when planet is in front of star
    const dist = Math.abs(phase - t);
    const dip = dist < 0.08 ? Math.cos((dist / 0.08) * Math.PI / 2) * curveH * 0.6 : 0;
    const y = curveY - curveH * 0.1 + dip;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Labels
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '9px "Rajdhani", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Brightness', w * 0.08, curveY + curveH * 0.35);
  ctx.fillText('Time →', w * 0.92, curveY + curveH * 0.35);

  // Dip label
  if (Math.abs(t - 0.5) < 0.15) {
    ctx.fillStyle = '#ffd740';
    ctx.font = '10px "Rajdhani", sans-serif';
    ctx.fillText('▼ Transit dip', w / 2, curveY + curveH * 0.55);
  }
}

// ════════════════════════════════════════════════
// RADIAL VELOCITY ANIMATION
// Shows star wobble with Doppler shift
// ════════════════════════════════════════════════
export function drawRadialVelocity(ctx, w, h, t) {
  ctx.clearRect(0, 0, w, h);

  const midX = w * 0.4;
  const midY = h * 0.38;
  const orbitR = h * 0.2;
  const starR = h * 0.1;
  const planetR = h * 0.04;
  const wobbleAmp = h * 0.03;

  const angle = t * Math.PI * 2;

  // Star wobble (opposite to planet)
  const starX = midX - Math.cos(angle) * wobbleAmp;
  const starY = midY - Math.sin(angle) * wobbleAmp * 0.3;

  // Planet orbit
  const planetX = midX + Math.cos(angle) * orbitR;
  const planetY = midY + Math.sin(angle) * orbitR * 0.3;

  // Orbit path (dashed)
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.ellipse(midX, midY, orbitR, orbitR * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Star
  const blueShift = Math.max(0, -Math.cos(angle));
  const redShift = Math.max(0, Math.cos(angle));
  const sr = Math.round(255 * (0.9 + redShift * 0.1));
  const sg = Math.round(255 * (0.85 - redShift * 0.2 - blueShift * 0.1));
  const sb = Math.round(255 * (0.4 + blueShift * 0.6));

  const starGrad = ctx.createRadialGradient(starX, starY, 0, starX, starY, starR);
  starGrad.addColorStop(0, `rgb(${sr},${sg},${sb})`);
  starGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.arc(starX, starY, starR, 0, Math.PI * 2);
  ctx.fillStyle = starGrad;
  ctx.fill();

  // Planet
  ctx.beginPath();
  ctx.arc(planetX, planetY, planetR, 0, Math.PI * 2);
  ctx.fillStyle = '#4fc3f7';
  ctx.fill();

  // Velocity curve
  const curveY = h * 0.78;
  const curveH = h * 0.15;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.55, curveY);
  ctx.lineTo(w * 0.95, curveY);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = '#69f0ae';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 60; i++) {
    const x = w * 0.55 + (i / 60) * w * 0.4;
    const phase = i / 60;
    const vel = Math.sin(phase * Math.PI * 2) * curveH * 0.4;
    const y = curveY + vel;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Current position marker
  const markerX = w * 0.55 + t * w * 0.4;
  const markerY = curveY + Math.sin(t * Math.PI * 2) * curveH * 0.4;
  ctx.beginPath();
  ctx.arc(markerX, markerY, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#69f0ae';
  ctx.fill();

  // Labels
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '9px "Rajdhani", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Blueshift ↑', w * 0.56, curveY - curveH * 0.35);
  ctx.fillText('Redshift ↓', w * 0.56, curveY + curveH * 0.55);
}

// ════════════════════════════════════════════════
// DIRECT IMAGING ANIMATION
// Shows coronagraph masking starlight
// ════════════════════════════════════════════════
export function drawDirectImaging(ctx, w, h, t) {
  ctx.clearRect(0, 0, w, h);

  const cx = w * 0.45;
  const cy = h * 0.45;
  const starR = h * 0.08;

  // Diffraction spikes / scattered light
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const spikeLen = h * 0.35;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * spikeLen, cy + Math.sin(angle) * spikeLen);
    ctx.strokeStyle = `rgba(255, 200, 100, ${0.05 + 0.03 * Math.sin(t * Math.PI * 2)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Star halo (before coronagraph)
  const haloR = h * 0.25;
  const haloGrad = ctx.createRadialGradient(cx, cy, starR, cx, cy, haloR);
  haloGrad.addColorStop(0, 'rgba(255, 220, 150, 0.3)');
  haloGrad.addColorStop(1, 'rgba(255, 220, 150, 0)');
  ctx.beginPath();
  ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
  ctx.fillStyle = haloGrad;
  ctx.fill();

  // Coronagraph mask (dark circle)
  ctx.beginPath();
  ctx.arc(cx, cy, starR * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a1a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 100, 50, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Planet (orbiting, visible!)
  const planetOrbitR = h * 0.28;
  const planetAngle = t * Math.PI * 2;
  const px = cx + Math.cos(planetAngle) * planetOrbitR;
  const py = cy + Math.sin(planetAngle) * planetOrbitR * 0.5;
  const planetR = h * 0.03;

  // Planet glow
  const pglow = ctx.createRadialGradient(px, py, 0, px, py, planetR * 3);
  pglow.addColorStop(0, 'rgba(100, 200, 255, 0.6)');
  pglow.addColorStop(1, 'rgba(100, 200, 255, 0)');
  ctx.beginPath();
  ctx.arc(px, py, planetR * 3, 0, Math.PI * 2);
  ctx.fillStyle = pglow;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(px, py, planetR, 0, Math.PI * 2);
  ctx.fillStyle = '#64b5f6';
  ctx.fill();

  // Labels
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '9px "Rajdhani", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Coronagraph', cx, cy + starR * 2.2);
  ctx.fillStyle = '#64b5f6';
  ctx.fillText('Planet', px, py + planetR * 5);
}

// ════════════════════════════════════════════════
// MICROLENSING ANIMATION
// Shows light curve magnification
// ════════════════════════════════════════════════
export function drawMicrolensing(ctx, w, h, t) {
  ctx.clearRect(0, 0, w, h);

  const bgStarY = h * 0.3;
  const lensStarY = h * 0.3;

  // Background star (distant, at center)
  const bgX = w * 0.5;
  const bgR = h * 0.04;

  // Lens star moving across
  const lensX = w * 0.15 + t * w * 0.7;
  const lensR = h * 0.06;

  // Magnification based on alignment
  const sep = Math.abs(lensX - bgX) / (w * 0.35);
  const magnification = 1 + 3 / (sep * sep + 0.15);

  // Background star (magnified)
  const magR = bgR * Math.sqrt(magnification);
  const magBright = Math.min(1, 0.3 + magnification * 0.15);

  const bgGrad = ctx.createRadialGradient(bgX, bgStarY, 0, bgX, bgStarY, magR * 2);
  bgGrad.addColorStop(0, `rgba(255, 250, 230, ${magBright})`);
  bgGrad.addColorStop(0.5, `rgba(255, 220, 150, ${magBright * 0.5})`);
  bgGrad.addColorStop(1, 'rgba(255, 220, 150, 0)');
  ctx.beginPath();
  ctx.arc(bgX, bgStarY, magR * 2, 0, Math.PI * 2);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(bgX, bgStarY, magR, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 250, 240, ${magBright})`;
  ctx.fill();

  // Lens star (foreground)
  ctx.beginPath();
  ctx.arc(lensX, lensStarY + h * 0.05, lensR, 0, Math.PI * 2);
  ctx.fillStyle = '#ff8a65';
  ctx.fill();

  // Planet as small bump
  const planetOffset = lensR * 2.5;
  const planetX = lensX + planetOffset;
  const planetY = lensStarY + h * 0.05;
  ctx.beginPath();
  ctx.arc(planetX, planetY, h * 0.015, 0, Math.PI * 2);
  ctx.fillStyle = '#4dd0e1';
  ctx.fill();

  // Light curve
  const curveY = h * 0.72;
  const curveH = h * 0.2;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.08, curveY);
  ctx.lineTo(w * 0.92, curveY);
  ctx.stroke();

  ctx.beginPath();
  ctx.strokeStyle = '#ffd740';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 100; i++) {
    const x = w * 0.08 + (i / 100) * w * 0.84;
    const phase = i / 100;
    const s = Math.abs(phase - 0.5) / 0.35;
    const mag = 1 + 3 / (s * s + 0.15);
    const norm = (mag - 1) / 20;
    // Add planetary spike
    const planetBump = Math.exp(-Math.pow((phase - 0.55) / 0.02, 2)) * 0.15;
    const y = curveY - (norm + planetBump) * curveH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Current time marker
  const markX = w * 0.08 + t * w * 0.84;
  ctx.beginPath();
  ctx.moveTo(markX, curveY - curveH);
  ctx.lineTo(markX, curveY + 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Labels
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '9px "Rajdhani", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Magnification', w * 0.15, curveY + curveH * 0.4);
  ctx.fillStyle = '#4dd0e1';
  ctx.fillText('Planetary spike', w * 0.7, curveY - curveH * 0.6);
}

// ════════════════════════════════════════════════
// TIMING ANIMATION
// Shows pulsar / eclipse timing variations
// ════════════════════════════════════════════════
export function drawTiming(ctx, w, h, t) {
  ctx.clearRect(0, 0, w, h);

  const pulsarX = w * 0.3;
  const pulsarY = h * 0.35;
  const pulsarR = h * 0.06;

  // Planet orbiting pulsar
  const orbitR = h * 0.18;
  const angle = t * Math.PI * 2;
  const planetX = pulsarX + Math.cos(angle) * orbitR;
  const planetY = pulsarY + Math.sin(angle) * orbitR * 0.3;

  // Orbit path
  ctx.setLineDash([2, 3]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.ellipse(pulsarX, pulsarY, orbitR, orbitR * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Pulsar beams (rotating)
  const beamAngle = t * Math.PI * 20; // fast rotation
  for (let i = 0; i < 2; i++) {
    const ba = beamAngle + i * Math.PI;
    const beamLen = h * 0.3;
    ctx.beginPath();
    ctx.moveTo(pulsarX, pulsarY);
    ctx.lineTo(pulsarX + Math.cos(ba) * beamLen, pulsarY + Math.sin(ba) * beamLen);
    ctx.strokeStyle = `rgba(180, 130, 255, ${0.4 + 0.2 * Math.sin(ba)})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Pulsar
  ctx.beginPath();
  ctx.arc(pulsarX, pulsarY, pulsarR, 0, Math.PI * 2);
  ctx.fillStyle = '#b388ff';
  ctx.fill();

  // Planet
  ctx.beginPath();
  ctx.arc(planetX, planetY, h * 0.025, 0, Math.PI * 2);
  ctx.fillStyle = '#4fc3f7';
  ctx.fill();

  // Timing residuals
  const curveY = h * 0.78;
  const curveH = h * 0.15;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.55, curveY);
  ctx.lineTo(w * 0.95, curveY);
  ctx.stroke();

  // Pulse ticks
  ctx.strokeStyle = '#b388ff';
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i++) {
    const phase = i / 20;
    const offset = Math.sin(phase * Math.PI * 2) * curveH * 0.3; // timing variation
    const x = w * 0.55 + phase * w * 0.4;
    ctx.beginPath();
    ctx.moveTo(x + offset * 0.3, curveY - curveH * 0.3);
    ctx.lineTo(x + offset * 0.3, curveY + curveH * 0.3);
    ctx.stroke();
  }

  // Labels
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '9px "Rajdhani", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Pulse arrival times', w * 0.56, curveY - curveH * 0.45);
  ctx.fillText('Early ← → Late', w * 0.65, curveY + curveH * 0.55);
}

// ════════════════════════════════════════════════
// ASTROMETRY ANIMATION
// Shows star tracing tiny ellipse on sky
// ════════════════════════════════════════════════
export function drawAstrometry(ctx, w, h, t) {
  ctx.clearRect(0, 0, w, h);

  const cx = w * 0.5;
  const cy = h * 0.4;
  const ellipseA = h * 0.15;
  const ellipseB = h * 0.08;

  // Grid / reference frame
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 0.5;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * w * 0.1, 0);
    ctx.lineTo(cx + i * w * 0.1, h * 0.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, cy + i * h * 0.1);
    ctx.lineTo(w, cy + i * h * 0.1);
    ctx.stroke();
  }

  // Wobble ellipse (trace)
  ctx.setLineDash([2, 2]);
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, ellipseA, ellipseB, 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Trail
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 50; i++) {
    const frac = i / 50;
    const a = (t - frac * 0.3) * Math.PI * 2;
    const sx = cx + Math.cos(a) * ellipseA * Math.cos(0.3) - Math.sin(a) * ellipseB * Math.sin(0.3);
    const sy = cy + Math.cos(a) * ellipseA * Math.sin(0.3) + Math.sin(a) * ellipseB * Math.cos(0.3);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Star current position
  const starAngle = t * Math.PI * 2;
  const starX = cx + Math.cos(starAngle) * ellipseA * Math.cos(0.3) - Math.sin(starAngle) * ellipseB * Math.sin(0.3);
  const starY = cy + Math.cos(starAngle) * ellipseA * Math.sin(0.3) + Math.sin(starAngle) * ellipseB * Math.cos(0.3);

  const sglow = ctx.createRadialGradient(starX, starY, 0, starX, starY, h * 0.06);
  sglow.addColorStop(0, '#fff8e1');
  sglow.addColorStop(0.5, 'rgba(255, 215, 64, 0.3)');
  sglow.addColorStop(1, 'rgba(255, 215, 64, 0)');
  ctx.beginPath();
  ctx.arc(starX, starY, h * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = sglow;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(starX, starY, h * 0.03, 0, Math.PI * 2);
  ctx.fillStyle = '#fff8e1';
  ctx.fill();

  // Center of mass marker
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.font = '8px "Rajdhani", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CoM', cx + 5, cy - 3);

  // Labels
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '9px "Rajdhani", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Star position on sky (μas scale)', cx, h * 0.88);
  ctx.fillText('Wobble reveals unseen planet', cx, h * 0.95);
}

// ══ Habitable Zone Orbital Diagram ═══════════
// Shows planet position relative to HZ boundaries
export function drawHZDiagram(ctx, w, h, planet) {
  ctx.clearRect(0, 0, w, h);

  if (!planet || !planet.hzStatus || !planet.hzStatus.hz) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px "Rajdhani", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Insufficient star data for HZ diagram', w / 2, h / 2);
    return;
  }

  const hz = planet.hzStatus.hz;
  const padding = { left: 10, right: 10, top: 18, bottom: 22 };
  const graphW = w - padding.left - padding.right;
  const barH = 24;
  const barY = h * 0.4;

  // Determine scale: show from 0 to ~2x outer optimistic, or at least enough for planet
  const maxAU = Math.max(hz.optimisticOuter * 1.8, (planet.semiMajorAxis || 0) * 1.3, 0.1);
  const minAU = 0;

  function auToX(au) {
    return padding.left + (au / maxAU) * graphW;
  }

  // Star at left
  const starX = auToX(0);
  const starGrad = ctx.createRadialGradient(starX, barY + barH / 2, 0, starX, barY + barH / 2, 12);
  starGrad.addColorStop(0, '#ffd740');
  starGrad.addColorStop(1, 'rgba(255,215,64,0)');
  ctx.beginPath();
  ctx.arc(starX, barY + barH / 2, 12, 0, Math.PI * 2);
  ctx.fillStyle = starGrad;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(starX, barY + barH / 2, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#fff8e1';
  ctx.fill();

  // "Too hot" zone
  const optInner = auToX(hz.optimisticInner);
  ctx.fillStyle = 'rgba(255, 45, 45, 0.15)';
  ctx.fillRect(auToX(0), barY, optInner - auToX(0), barH);

  // Optimistic HZ band (light green)
  const optOuter = auToX(hz.optimisticOuter);
  ctx.fillStyle = 'rgba(105, 240, 174, 0.12)';
  ctx.fillRect(optInner, barY, optOuter - optInner, barH);

  // Conservative HZ band (brighter green, overlapping)
  const consInner = auToX(hz.conservativeInner);
  const consOuter = auToX(hz.conservativeOuter);
  ctx.fillStyle = 'rgba(105, 240, 174, 0.25)';
  ctx.fillRect(consInner, barY, consOuter - consInner, barH);

  // "Too cold" zone
  ctx.fillStyle = 'rgba(100, 180, 255, 0.1)';
  ctx.fillRect(optOuter, barY, w - padding.right - optOuter, barH);

  // Boundary lines
  [
    { x: consInner, label: 'CHZ inner', color: '#69f0ae' },
    { x: consOuter, label: 'CHZ outer', color: '#69f0ae' },
    { x: optInner, label: 'OHZ', color: 'rgba(105,240,174,0.4)' },
    { x: optOuter, label: 'OHZ', color: 'rgba(105,240,174,0.4)' },
  ].forEach(b => {
    ctx.beginPath();
    ctx.moveTo(b.x, barY - 2);
    ctx.lineTo(b.x, barY + barH + 2);
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // Planet marker
  if (planet.semiMajorAxis && planet.semiMajorAxis > 0) {
    const px = auToX(planet.semiMajorAxis);
    // Glow
    const pGlow = ctx.createRadialGradient(px, barY + barH / 2, 0, px, barY + barH / 2, 10);
    pGlow.addColorStop(0, 'rgba(0, 229, 255, 0.6)');
    pGlow.addColorStop(1, 'rgba(0, 229, 255, 0)');
    ctx.beginPath();
    ctx.arc(px, barY + barH / 2, 10, 0, Math.PI * 2);
    ctx.fillStyle = pGlow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px, barY + barH / 2, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#00e5ff';
    ctx.fill();

    // Label
    ctx.fillStyle = '#00e5ff';
    ctx.font = '10px "Rajdhani", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${planet.semiMajorAxis.toFixed(3)} AU`, px, barY - 5);
  }

  // Title / Labels
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '9px "Rajdhani", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('★', starX - 3, barY + barH + 15);
  ctx.fillText('0 AU', starX + 8, barY + barH + 15);
  ctx.textAlign = 'right';
  ctx.fillText(`${maxAU.toFixed(2)} AU`, w - padding.right, barY + barH + 15);

  // Legend
  ctx.textAlign = 'center';
  ctx.font = '8px "Rajdhani", sans-serif';
  ctx.fillStyle = '#69f0ae';
  ctx.fillText('Conservative HZ', (consInner + consOuter) / 2, barY + barH + 15);
  ctx.fillStyle = 'rgba(105,240,174,0.5)';
  if (optInner < consInner - 20) {
    ctx.fillText('Opt.', (optInner + consInner) / 2, padding.top + 2);
  }

  // Top title
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = '10px "Rajdhani", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Orbital Position vs. Habitable Zone', w / 2, padding.top - 4);
}

// ── Method to animation function map ─────────
export const ANIMATION_MAP = {
  transit: drawTransit,
  radialVelocity: drawRadialVelocity,
  radial_velocity: drawRadialVelocity,
  directImaging: drawDirectImaging,
  direct_imaging: drawDirectImaging,
  microlensing: drawMicrolensing,
  timing: drawTiming,
  astrometry: drawAstrometry,
  transit_timing_variations: drawTransit,
  pulsar_timing: drawTiming,
  imaging: drawDirectImaging,
};

export function getAnimationForMethod(animationType) {
  return ANIMATION_MAP[animationType] || drawTransit;
}

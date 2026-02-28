// ═══════════════════════════════════════════════
// EXOPLANET EXPLORER — UI ANIMATION LOGIC
// ═══════════════════════════════════════════════

/**
 * Draw rotating 3D wireframe sphere for the atmosphere breakdown
 */
export function drawAtmosphereWireframe(ctx, width, height, time) {
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.38;
  const rotY = time * 0.3;
  const rotX = 0.4;

  ctx.lineWidth = 0.6;

  // Longitude lines
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(0, 229, 255, ${0.15 + 0.1 * Math.sin(angle + rotY)})`;

    for (let j = 0; j <= 40; j++) {
      const phi = (j / 40) * Math.PI;
      let x = Math.sin(phi) * Math.cos(angle + rotY);
      let y = Math.cos(phi) * Math.cos(rotX) - Math.sin(phi) * Math.sin(angle + rotY) * Math.sin(rotX);
      let z = Math.cos(phi) * Math.sin(rotX) + Math.sin(phi) * Math.sin(angle + rotY) * Math.cos(rotX);

      const px = cx + x * radius;
      const py = cy - y * radius;

      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Latitude lines
  for (let i = 1; i < 8; i++) {
    const phi = (i / 8) * Math.PI;
    const latRadius = Math.sin(phi) * radius;
    const latY = Math.cos(phi) * radius;

    ctx.beginPath();
    ctx.strokeStyle = `rgba(0, 229, 255, ${0.12 + 0.08 * Math.abs(Math.cos(phi))})`;

    for (let j = 0; j <= 60; j++) {
      const theta = (j / 60) * Math.PI * 2;
      let x = latRadius * Math.cos(theta + rotY);
      let y = latY * Math.cos(rotX) - latRadius * Math.sin(theta + rotY) * Math.sin(rotX);

      const px = cx + x;
      const py = cy - y;

      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Atmosphere layers (colored rings for CO2 / H2O)
  const layers = [
    { r: radius * 1.08, color: 'rgba(255, 215, 64, 0.25)', label: 'CO₂' },
    { r: radius * 1.15, color: 'rgba(0, 229, 255, 0.2)', label: 'H₂O' },
    { r: radius * 1.22, color: 'rgba(124, 77, 255, 0.12)', label: 'N₂' },
  ];

  layers.forEach((layer, idx) => {
    ctx.beginPath();
    ctx.strokeStyle = layer.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 4]);

    const wobble = Math.sin(time * 0.5 + idx) * 2;
    ctx.ellipse(cx, cy + wobble, layer.r, layer.r * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // "Data points" on the wireframe
  for (let i = 0; i < 8; i++) {
    const t = time * 0.2 + i * 1.3;
    const phi = (Math.sin(t * 0.7 + i) * 0.5 + 0.5) * Math.PI;
    const theta = t + i * 0.8;

    let x = Math.sin(phi) * Math.cos(theta) * radius;
    let y = Math.cos(phi) * radius;

    const px = cx + x;
    const py = cy - y * Math.cos(rotX);

    ctx.beginPath();
    ctx.arc(px, py, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 229, 255, ${0.4 + 0.3 * Math.sin(time + i)})`;
    ctx.fill();
  }
}

/**
 * Draw the habitability gauge arc
 */
export function drawHabitabilityGauge(ctx, width, height, score, time) {
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height - 10;
  const radius = Math.min(width * 0.42, height - 20);
  const startAngle = Math.PI;
  const endAngle = 0;
  const scoreAngle = startAngle + (endAngle - startAngle) * score;

  // Background arc
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 8;
  ctx.stroke();

  // Score arc gradient
  const gradient = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
  gradient.addColorStop(0, '#ff2d2d');
  gradient.addColorStop(0.3, '#ff9100');
  gradient.addColorStop(0.5, '#ffd740');
  gradient.addColorStop(0.7, '#69f0ae');
  gradient.addColorStop(1, '#00e5ff');

  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, scoreAngle, false);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Glowing tip
  const tipX = cx + radius * Math.cos(scoreAngle);
  const tipY = cy + radius * Math.sin(scoreAngle);
  const glowSize = 6 + Math.sin(time * 3) * 2;

  const tipGlow = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, glowSize);
  tipGlow.addColorStop(0, 'rgba(0, 229, 255, 0.8)');
  tipGlow.addColorStop(1, 'rgba(0, 229, 255, 0)');
  ctx.beginPath();
  ctx.arc(tipX, tipY, glowSize, 0, Math.PI * 2);
  ctx.fillStyle = tipGlow;
  ctx.fill();

  // Tick marks
  for (let i = 0; i <= 10; i++) {
    const tickAngle = startAngle + (endAngle - startAngle) * (i / 10);
    const innerR = radius - 14;
    const outerR = radius - 10;
    ctx.beginPath();
    ctx.moveTo(cx + innerR * Math.cos(tickAngle), cy + innerR * Math.sin(tickAngle));
    ctx.lineTo(cx + outerR * Math.cos(tickAngle), cy + outerR * Math.sin(tickAngle));
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * Draw habitability temporal confidence graph
 */
export function drawHabitabilityGraph(ctx, width, height, time) {
  ctx.clearRect(0, 0, width, height);

  const padding = { top: 8, bottom: 8, left: 4, right: 4 };
  const graphW = width - padding.left - padding.right;
  const graphH = height - padding.top - padding.bottom;

  // Grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (graphH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  // Data line
  const points = [];
  for (let i = 0; i <= 50; i++) {
    const x = padding.left + (graphW / 50) * i;
    const baseVal = 0.89 + Math.sin(i * 0.3) * 0.03 + Math.sin(i * 0.7 + 1) * 0.02;
    const jitter = Math.sin(time * 0.5 + i * 0.8) * 0.008;
    const val = Math.max(0, Math.min(1, baseVal + jitter));
    const y = padding.top + graphH * (1 - val);
    points.push({ x, y });
  }

  // Fill area
  const areaGradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  areaGradient.addColorStop(0, 'rgba(0, 229, 255, 0.15)');
  areaGradient.addColorStop(1, 'rgba(0, 229, 255, 0)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, height - padding.bottom);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = areaGradient;
  ctx.fill();

  // Line
  ctx.beginPath();
  points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Current value indicator
  const lastP = points[points.length - 1];
  ctx.beginPath();
  ctx.arc(lastP.x, lastP.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#00e5ff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lastP.x, lastP.y, 6, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Draw JWST transmission spectrum
 */
export function drawSpectrum(ctx, width, height, time) {
  ctx.clearRect(0, 0, width, height);

  const padding = { top: 10, bottom: 10, left: 8, right: 8 };
  const graphW = width - padding.left - padding.right;
  const graphH = height - padding.top - padding.bottom;

  // Grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 5; i++) {
    const y = padding.top + (graphH / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  // Spectrum data with absorption features
  const numPoints = 100;
  const points = [];
  const errBars = [];

  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const wavelength = 1.0 + t * 9.0; // 1-10 μm
    const x = padding.left + t * graphW;

    // Base continuum
    let depth = 0.5 + 0.1 * Math.sin(t * 3);

    // CO2 absorption at ~4.3 μm
    const co2 = 0.25 * Math.exp(-Math.pow((wavelength - 4.3) / 0.3, 2));
    // H2O absorption at ~2.7 μm
    const h2o = 0.18 * Math.exp(-Math.pow((wavelength - 2.7) / 0.4, 2));
    // H2O at ~6.3 μm
    const h2o2 = 0.12 * Math.exp(-Math.pow((wavelength - 6.3) / 0.5, 2));
    // O3 at ~9.6 μm
    const o3 = 0.08 * Math.exp(-Math.pow((wavelength - 9.6) / 0.3, 2));

    depth += co2 + h2o + h2o2 + o3;

    // Noise
    const noise = Math.sin(time * 0.3 + i * 0.5) * 0.01;
    depth += noise;

    const y = padding.top + graphH * (1 - depth);
    points.push({ x, y, wavelength });

    // Error bars
    const errSize = 3 + Math.random() * 4;
    errBars.push(errSize);
  }

  // Error bars
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 0.5;
  points.forEach((p, i) => {
    if (i % 4 === 0) {
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - errBars[i]);
      ctx.lineTo(p.x, p.y + errBars[i]);
      ctx.stroke();
    }
  });

  // Data points
  points.forEach((p, i) => {
    if (i % 3 === 0) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.5)';
      ctx.fill();
    }
  });

  // Best fit line
  ctx.beginPath();
  points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Highlight absorption features
  const features = [
    { wl: 2.7, color: 'rgba(0, 229, 255, 0.15)', label: 'H₂O' },
    { wl: 4.3, color: 'rgba(255, 215, 64, 0.15)', label: 'CO₂' },
    { wl: 9.6, color: 'rgba(105, 240, 174, 0.12)', label: 'O₃' },
  ];

  features.forEach(f => {
    const fx = padding.left + ((f.wl - 1.0) / 9.0) * graphW;
    ctx.beginPath();
    ctx.moveTo(fx, padding.top);
    ctx.lineTo(fx, height - padding.bottom);
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

/**
 * Update the timestamp clock
 */
export function updateTimestamp() {
  const el = document.getElementById('timestamp');
  if (!el) return;
  const now = new Date();
  const utc = now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  el.textContent = utc;
}

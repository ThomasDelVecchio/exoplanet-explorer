// ═══════════════════════════════════════════════
// EXOPLANET EXPLORER — GLSL SHADERS
// ═══════════════════════════════════════════════

// ── Planet Surface Vertex Shader ──────────────
export const planetVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying float vElevation;

  uniform float uTime;
  uniform float uNoiseScale;

  //
  // Simplex-style 3D noise
  //
  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 6; i++) {
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    // Procedural surface displacement
    vec3 pos = position;
    float noise = fbm(pos * uNoiseScale);
    vElevation = noise;
    pos += normal * noise * 0.018;

    vPosition = pos;
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// ── Planet Surface Fragment Shader ────────────
export const planetFragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;
  varying float vElevation;

  uniform float uTime;
  uniform vec3 uStarPosition;
  uniform vec3 uOceanColor;
  uniform vec3 uLandColor;
  uniform vec3 uVolcanicColor;
  uniform float uOceanLevel;
  uniform float uBioLuminescence;
  uniform sampler2D uSurfaceTexture;
  uniform float uTextureBlend;
  uniform float uUseTexture;

  // Re-declare noise for fragment shader
  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 5; i++) {
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(uStarPosition - vWorldPosition);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float NdotL = max(dot(normal, lightDir), 0.0);
    float daylight = smoothstep(-0.08, 0.18, dot(normal, lightDir));

    float macro = fbm(vPosition * 1.6);
    float detail = snoise(vPosition * 9.0) * 0.5 + 0.5;
    float relief = clamp(vElevation * 0.75 + macro * 0.45 + 0.25, 0.0, 1.0);

    float landMask = smoothstep(uOceanLevel - 0.06, uOceanLevel + 0.08, relief);

    vec3 oceanCol = mix(uOceanColor * 0.55, uOceanColor * 1.15, detail);

    vec3 lowLand = uLandColor * mix(0.75, 1.05, detail);
    vec3 highLand = mix(uLandColor * 0.95, uVolcanicColor * 0.65, smoothstep(0.65, 0.98, relief));
    vec3 landCol = mix(lowLand, highLand, smoothstep(0.3, 0.95, relief));

    float snow = smoothstep(0.82, 0.98, relief) * mix(0.7, 1.0, detail);
    landCol = mix(landCol, vec3(0.82, 0.84, 0.86), snow * 0.45);

    vec3 proceduralColor = mix(oceanCol, landCol, landMask);
    vec3 textureColor = texture2D(uSurfaceTexture, vUv).rgb;
    vec3 surfaceColor = mix(proceduralColor, textureColor, uTextureBlend * uUseTexture);

    vec3 diffuse = surfaceColor * (0.06 + 0.94 * NdotL);

    vec3 halfDir = normalize(lightDir + viewDir);
    float specular = pow(max(dot(normal, halfDir), 0.0), 96.0);
    float oceanSpec = specular * (1.0 - landMask) * (0.12 + 0.28 * daylight);
    vec3 specColor = vec3(1.0) * oceanSpec;

    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0);
    vec3 subtleRim = uOceanColor * 0.05 * fresnel * daylight;

    float bioPattern = smoothstep(0.7, 0.9, snoise(vPosition * 18.0) * 0.5 + 0.5);
    vec3 bioColor = vec3(0.12, 0.3, 0.45) * bioPattern * uBioLuminescence * (1.0 - landMask) * (1.0 - daylight) * 0.18;

    vec3 litColor = diffuse + specColor + subtleRim + bioColor;
    litColor += surfaceColor * 0.03 * (1.0 - daylight);

    gl_FragColor = vec4(litColor, 1.0);
  }
`;

// ── Atmosphere Vertex Shader ──────────────────
export const atmosphereVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// ── Atmosphere Fragment Shader ────────────────
export const atmosphereFragmentShader = /* glsl */ `
  precision highp float;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  varying vec2 vUv;

  uniform vec3 uStarPosition;
  uniform float uTime;
  uniform vec3 uAtmoColor;
  uniform float uAtmoIntensity;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    vec3 lightDir = normalize(uStarPosition - vWorldPosition);

    float NdotV = max(dot(normal, viewDir), 0.0);
    float NdotL = dot(normal, lightDir);
    float daylight = smoothstep(-0.15, 0.25, NdotL);

    float horizon = pow(1.0 - NdotV, 2.5);
    float forwardScatter = pow(max(dot(viewDir, lightDir), 0.0), 6.0);

    vec3 rayleigh = uAtmoColor * (0.35 + 0.65 * daylight);
    vec3 mie = mix(vec3(1.0), uAtmoColor, 0.35) * forwardScatter * 0.35;
    vec3 atmoGlow = rayleigh * horizon * (0.45 + 0.55 * daylight) + mie * horizon;

    float alpha = horizon * (0.14 + 0.26 * daylight) * uAtmoIntensity;
    alpha += forwardScatter * 0.08 * uAtmoIntensity;
    alpha = clamp(alpha, 0.0, 0.45);

    gl_FragColor = vec4(atmoGlow, alpha);
  }
`;

// ── Ring Vertex Shader ────────────────────────
export const ringVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// ── Ring Fragment Shader ──────────────────────
export const ringFragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;

  uniform float uTime;
  uniform vec3 uStarPosition;
  uniform vec3 uPlanetPosition;
  uniform float uPlanetRadius;
  uniform float uInnerRadius;
  uniform float uOuterRadius;

  void main() {
    // Radial distance from center
    vec2 centered = vUv - 0.5;
    float dist = length(centered) * 2.0;

    // Ring bands
    float t = (dist - 0.0) / 1.0;
    float ring1 = smoothstep(0.0, 0.02, sin(t * 80.0) * 0.5 + 0.5);
    float ring2 = smoothstep(0.0, 0.03, sin(t * 120.0 + 1.5) * 0.5 + 0.5);
    float ring3 = smoothstep(0.0, 0.015, sin(t * 200.0 + 3.0) * 0.5 + 0.5);
    float bands = ring1 * 0.4 + ring2 * 0.35 + ring3 * 0.25;

    // Density falloff
    float innerEdge = smoothstep(0.3, 0.38, dist);
    float outerEdge = 1.0 - smoothstep(0.85, 0.95, dist);
    float density = innerEdge * outerEdge * bands;

    // Gaps
    float gap1 = 1.0 - smoothstep(0.0, 0.01, abs(dist - 0.55));
    float gap2 = 1.0 - smoothstep(0.0, 0.015, abs(dist - 0.7));
    density *= (1.0 - gap1 * 0.8) * (1.0 - gap2 * 0.6);

    // Shadow from planet
    vec3 toStar = normalize(uStarPosition - vWorldPosition);
    vec3 toPlanet = uPlanetPosition - vWorldPosition;
    float projDist = dot(toPlanet, toStar);
    vec3 closest = vWorldPosition + toStar * projDist - uPlanetPosition;
    float shadowDist = length(closest);
    float shadow = smoothstep(uPlanetRadius * 0.8, uPlanetRadius * 1.2, shadowDist);
    shadow = mix(0.15, 1.0, shadow);

    // Lighting
    vec3 lightDir = normalize(uStarPosition - vWorldPosition);
    float NdotL = abs(dot(normalize(vNormal), lightDir));
    float lighting = 0.3 + 0.7 * NdotL;

    // Color: icy blue-white with slight warmth
    vec3 ringColor = mix(
      vec3(0.5, 0.55, 0.65),
      vec3(0.8, 0.75, 0.7),
      sin(dist * 15.0) * 0.5 + 0.5
    );

    float alpha = density * 0.25 * shadow * lighting;
    gl_FragColor = vec4(ringColor * lighting * shadow, alpha);
  }
`;

// ── Star Glow Vertex Shader ──────────────────
export const starVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ── Star Glow Fragment Shader ────────────────
export const starFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform float uTime;
  uniform vec3 uStarColor;
  uniform float uIntensity;

  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);

    // Core
    float core = exp(-dist * 8.0) * uIntensity;

    // Corona
    float corona = exp(-dist * 3.0) * 0.4 * uIntensity;

    // Flicker
    float flicker = 1.0 + 0.05 * sin(uTime * 3.0 + dist * 20.0);

    vec3 color = uStarColor * (core + corona) * flicker;

    // Chromatic layers
    color.r += exp(-dist * 5.0) * 0.3;
    color.g += exp(-dist * 7.0) * 0.05;

    float alpha = clamp(core + corona * 0.8, 0.0, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`;

// ── Orbital Path Shader ──────────────────────
export const orbitVertexShader = /* glsl */ `
  attribute float aAngle;
  varying float vAngle;
  varying vec3 vPos;

  void main() {
    vAngle = aAngle;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const orbitFragmentShader = /* glsl */ `
  precision highp float;
  varying float vAngle;
  varying vec3 vPos;

  uniform float uTime;
  uniform float uPlanetAngle;

  void main() {
    // Pulsing effect that travels along the orbit
    float pulse = sin(vAngle * 2.0 - uTime * 1.5) * 0.5 + 0.5;
    float proximity = 1.0 - smoothstep(0.0, 1.5, abs(vAngle - uPlanetAngle));

    float alpha = 0.08 + pulse * 0.12 + proximity * 0.3;
    vec3 color = vec3(0.2, 0.5, 1.0);

    gl_FragColor = vec4(color, alpha);
  }
`;

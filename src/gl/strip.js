import * as THREE from 'three'
import { resolveSrc } from '../lib/films.js'

/* ─────────────────────────────────────────────────────────────
   A 35mm strip as one shader: amber base, 4-perf sprockets cut
   clean through, edge print, frames that develop from negative
   to positive wherever the light (your pointer) lands.
   ───────────────────────────────────────────────────────────── */

export async function loadAtlas(urls, { cell = [512, 288], cols = 4 } = {}) {
  urls = await Promise.all(urls.map((u) => resolveSrc(u).catch(() => u)))
  const imgs = await Promise.all(
    urls.map(
      (u) =>
        new Promise((res) => {
          const im = new Image()
          im.decoding = 'async'
          im.onload = () => res(im)
          im.onerror = () => res(null)
          im.src = u
        }),
    ),
  )
  const ok = imgs.filter(Boolean)
  const rows = Math.ceil(ok.length / cols)
  const c = document.createElement('canvas')
  c.width = cell[0] * cols
  c.height = cell[1] * rows
  const g = c.getContext('2d')
  g.fillStyle = '#111'
  g.fillRect(0, 0, c.width, c.height)
  ok.forEach((im, i) => {
    const x = (i % cols) * cell[0]
    const y = Math.floor(i / cols) * cell[1]
    // cover-crop into the cell
    const r = Math.max(cell[0] / im.width, cell[1] / im.height)
    const w = im.width * r, h = im.height * r
    g.drawImage(im, x + (cell[0] - w) / 2, y + (cell[1] - h) / 2, w, h)
  })
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  return { tex, count: ok.length, cols, rows }
}

export function edgeTexture() {
  const c = document.createElement('canvas')
  c.width = 2048
  c.height = 64
  const g = c.getContext('2d')
  g.fillStyle = '#000'
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#fff'
  g.font = '600 30px "Martian Mono", ui-monospace, monospace'
  g.textBaseline = 'middle'
  const words = ['SELECTS 5219', '24A', '25', 'SAFETY FILM', '26', 'THE TAKE WORTH KEEPING', '27A']
  let x = 20
  let i = 0
  while (x < c.width) {
    const w = words[i++ % words.length]
    g.fillText(w, x, 34)
    x += g.measureText(w).width + 90
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  return t
}

export const NOISE = /* glsl */ `
  float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
  float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
`

export function stripMaterial({ atlas, edge, frameLen = 1.18, width = 1 }) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uAtlas: { value: atlas.tex },
      uEdge: { value: edge },
      uCount: { value: atlas.count },
      uCols: { value: atlas.cols },
      uRows: { value: atlas.rows },
      uOffset: { value: 0 },
      uTime: { value: 0 },
      uFocus: { value: new THREE.Vector3(0, 0, 0) },
      uFocusR: { value: 2.2 },
      uDevelopAll: { value: 0 },
      uFog: { value: new THREE.Vector2(6, 22) },
      uFogColor: { value: new THREE.Color('#050506') },
      uBright: { value: 1 },
      uFrameLen: { value: frameLen },
      uWidth: { value: width },
      uLight: { value: new THREE.Vector3(-0.4, 0.8, 0.6).normalize() },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aTangent;
      varying vec2 vUv; varying vec3 vN; varying vec3 vView; varying float vDepth; varying float vDev; varying vec3 vWorld;
      uniform vec3 uFocus; uniform float uFocusR; uniform float uDevelopAll;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 mv = viewMatrix * wp;
        vView = normalize(-mv.xyz);
        vDepth = -mv.z;
        float d = distance(wp.xyz, uFocus);
        vDev = max(uDevelopAll, 1.0 - smoothstep(uFocusR*0.35, uFocusR, d));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D uAtlas; uniform sampler2D uEdge;
      uniform float uCount, uCols, uRows, uOffset, uTime, uBright, uFrameLen, uWidth;
      uniform vec2 uFog; uniform vec3 uFogColor; uniform vec3 uLight;
      varying vec2 vUv; varying vec3 vN; varying vec3 vView; varying float vDepth; varying float vDev; varying vec3 vWorld;
      ${NOISE}
      float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main(){
        float u = vUv.x + uOffset;
        float fid = floor(u);
        float fx = fract(u);
        float v = vUv.y;
        float band = 0.165;
        // ── sprockets: four perforations per frame per side, cut clean through
        float perf = fract(fx * 4.0) - 0.5;
        float hy = v < 0.5 ? v - band * 0.5 : v - (1.0 - band * 0.5);
        vec2 hp = vec2(perf * uFrameLen * 0.25, hy * uWidth);
        float hole = sdRound(hp, vec2(0.052, 0.034), 0.016);
        bool inBand = v < band || v > 1.0 - band;
        if (inBand && hole < 0.0) discard;
        // ── base: black celluloid, uneven, like it has been handled
        float grainN = noise(vec2(u * 140.0, v * 90.0) + uTime * 3.0);
        vec3 base = mix(vec3(0.035, 0.036, 0.04), vec3(0.12, 0.122, 0.13), fbm(vec2(u * 2.0, v * 3.0)));
        base *= 0.9 + grainN * 0.18;
        // sprocket edge burn
        base += smoothstep(0.012, 0.0, abs(hole)) * vec3(0.32) * float(inBand);
        // edge print in the lower band
        if (v < band * 0.86 && v > band * 0.06) {
          float ey = (v - band * 0.06) / (band * 0.8);
          float print = texture2D(uEdge, vec2(u * 0.075, 1.0 - ey)).r;
          float zone = smoothstep(0.30, 0.38, fract(fx * 4.0)) * smoothstep(0.70, 0.62, fract(fx * 4.0));
          base = mix(base, vec3(0.78, 0.78, 0.76), print * 0.55 * (1.0 - zone));
        }
        vec3 col = base;
        // ── the frame
        float x0 = 0.03, x1 = 0.97, y0 = band + 0.018, y1 = 1.0 - band - 0.018;
        float inImg = step(x0, fx) * step(fx, x1) * step(y0, v) * step(v, y1);
        vec2 iuv = vec2((fx - x0) / (x1 - x0), (v - y0) / (y1 - y0));
        float idx = mod(fid, uCount);
        vec2 cell = vec2(mod(idx, uCols), floor(idx / uCols));
        vec2 auv = vec2((cell.x + iuv.x) / uCols, 1.0 - (cell.y + 1.0 - iuv.y) / uRows);
        vec3 img = texture2D(uAtlas, auv).rgb;
        // black-and-white negative: luminance inverted, a little silver in the highlights
        float lum = dot(img, vec3(0.299, 0.587, 0.114));
        vec3 neg = vec3(pow(1.0 - lum, 1.6)) * vec3(0.46, 0.47, 0.5) + 0.025;
        // develop: a chemical front, not a crossfade
        float n = fbm(iuv * vec2(5.0, 3.0) + fid * 7.13 + uTime * 0.05);
        float dev = smoothstep(0.0, 0.18, vDev * 1.25 - n * 0.55);
        // developed: a monochrome print with the film's own colour coming through
        vec3 pos = mix(vec3(lum), img, 0.55);
        pos = pow(pos, vec3(0.92)) * 1.06;
        float front = smoothstep(0.0, 0.08, vDev * 1.25 - n * 0.55) - dev;
        vec3 pic = mix(neg, pos, dev) + front * vec3(1.0, 0.98, 0.94) * 0.8;
        // frame line between frames
        float edgeFade = smoothstep(0.0, 0.012, min(min(fx - x0, x1 - fx), min(v - y0, y1 - v)));
        col = mix(col, pic * (0.75 + 0.25 * edgeFade), inImg);
        col = mix(col, vec3(0.012), (1.0 - inImg) * step(band, v) * step(v, 1.0 - band) * 0.7);
        // ── light: backlit like a light table, glossy on the emulsion side
        vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
        vec3 V = normalize(vView);
        float facing = abs(dot(N, V));
        float rim = pow(1.0 - facing, 2.5);
        vec3 H = normalize(uLight + V);
        float spec = pow(max(dot(N, H), 0.0), 60.0);
        float sweep = smoothstep(0.08, 0.0, abs(fract(vUv.x * 0.06 - uTime * 0.05) - 0.5) - 0.42);
        col *= 0.6 + 0.55 * facing;
        col += rim * vec3(0.78, 0.82, 0.92) * 0.42;
        col += spec * vec3(1.0) * 0.85 + sweep * vec3(0.9, 0.92, 1.0) * 0.07;
        col *= uBright;
        float fog = smoothstep(uFog.x, uFog.y, vDepth);
        col = mix(col, uFogColor, fog);
        gl_FragColor = vec4(col, 1.0);
      }`,
  })
}

/* Ribbon geometry along a curve, with a slow twist. */
export function ribbon(curve, { segments = 600, width = 1, twist = (t) => 0, frameLen = 1.18 } = {}) {
  const len = curve.getLength()
  const pos = new Float32Array((segments + 1) * 2 * 3)
  const uv = new Float32Array((segments + 1) * 2 * 2)
  const nrm = new Float32Array((segments + 1) * 2 * 3)
  const idx = []
  const up = new THREE.Vector3(0, 0, 1)
  const T = new THREE.Vector3(), B = new THREE.Vector3(), N = new THREE.Vector3(), P = new THREE.Vector3()
  let prevB = null
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    curve.getPointAt(t, P)
    curve.getTangentAt(t, T)
    B.crossVectors(T, up)
    if (B.lengthSq() < 1e-4) B.set(0, 1, 0)
    B.normalize()
    if (prevB && B.dot(prevB) < 0) B.negate()
    prevB = B.clone()
    const a = twist(t)
    const Bq = B.clone().applyAxisAngle(T, a)
    N.crossVectors(T, Bq).normalize()
    for (let s = 0; s < 2; s++) {
      const k = i * 2 + s
      const off = (s - 0.5) * width
      pos[k * 3] = P.x + Bq.x * off
      pos[k * 3 + 1] = P.y + Bq.y * off
      pos[k * 3 + 2] = P.z + Bq.z * off
      nrm[k * 3] = N.x; nrm[k * 3 + 1] = N.y; nrm[k * 3 + 2] = N.z
      uv[k * 2] = (t * len) / frameLen
      uv[k * 2 + 1] = s
    }
    if (i < segments) {
      const a0 = i * 2, b0 = i * 2 + 1, c0 = i * 2 + 2, d0 = i * 2 + 3
      idx.push(a0, c0, b0, b0, c0, d0)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

/* Dust in the beam + out-of-focus bokeh. */
export function dust(count = 500, spread = [16, 10, 14]) {
  const g = new THREE.BufferGeometry()
  const p = new Float32Array(count * 3)
  const s = new Float32Array(count)
  const c = new Float32Array(count * 3)
  const r = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    p[i * 3] = (Math.random() - 0.5) * spread[0]
    p[i * 3 + 1] = (Math.random() - 0.5) * spread[1]
    p[i * 3 + 2] = (Math.random() - 0.7) * spread[2]
    const big = Math.random() < 0.07
    s[i] = big ? 60 + Math.random() * 140 : 2 + Math.random() * 7
    // neutral dust; a few motes carry a hint of colour
    const h = Math.random(), k = 0.82 + Math.random() * 0.18
    const tint = h < 0.05 ? [1, 0.4, 0.16] : h < 0.11 ? [0.5, 0.68, 1] : [0.94, 0.95, 1]
    c[i * 3] = tint[0] * k; c[i * 3 + 1] = tint[1] * k; c[i * 3 + 2] = tint[2] * k
    r[i] = Math.random()
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(s, 1))
  g.setAttribute('aColor', new THREE.BufferAttribute(c, 3))
  g.setAttribute('aRand', new THREE.BufferAttribute(r, 1))
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPx: { value: Math.min(devicePixelRatio, 2) }, uAlpha: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSize; attribute vec3 aColor; attribute float aRand;
      uniform float uTime; uniform float uPx;
      varying vec3 vC; varying float vA; varying float vBig;
      void main(){
        vec3 p = position;
        p.y += mod(uTime * (0.05 + aRand * 0.12) + aRand * 10.0, 10.0) - 5.0;
        p.x += sin(uTime * 0.3 + aRand * 20.0) * 0.4;
        p.z += cos(uTime * 0.2 + aRand * 13.0) * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float big = step(40.0, aSize);
        vBig = big;
        gl_PointSize = aSize * uPx * (big > 0.5 ? 1.0 : 6.0 / -mv.z);
        vC = aColor;
        float tw = 0.55 + 0.45 * sin(uTime * (1.0 + aRand * 3.0) + aRand * 40.0);
        vA = (big > 0.5 ? 0.016 + aRand * 0.02 : 0.45 * tw) * smoothstep(30.0, 4.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      varying vec3 vC; varying float vA; varying float vBig;
      void main(){
        vec2 q = gl_PointCoord - 0.5;
        float d = length(q);
        float a = vBig > 0.5 ? smoothstep(0.5, 0.42, d) * (0.65 + 0.35 * smoothstep(0.2, 0.48, d)) : smoothstep(0.5, 0.0, d);
        if (a < 0.002) discard;
        gl_FragColor = vec4(vC * a * vA * uAlpha, 1.0);
      }`,
  })
  return new THREE.Points(g, m)
}

/* Final pass: chromatic aberration, vignette, gate weave, grain, flicker. */
export const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uCA: { value: 0.0022 }, uVig: { value: 1.1 }, uFlicker: { value: 1 }, uFade: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uCA, uVig, uFlicker, uFade;
    varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      float t = floor(uTime * 24.0);
      uv += (vec2(h(vec2(t, 1.0)), h(vec2(t, 2.0))) - 0.5) * 0.0007;
      vec2 c = uv - 0.5;
      float r = dot(c, c);
      vec2 off = c * uCA * (1.0 + r * 4.0);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + off).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - off).b;
      col *= 1.0 - smoothstep(0.18, 0.9, r * uVig);
      col *= 1.0 + (h(vec2(t, 7.0)) - 0.5) * 0.035 * uFlicker;
      col += (h(uv * 900.0 + t) - 0.5) * 0.028;
      gl_FragColor = vec4(col * uFade, 1.0);
    }`,
}

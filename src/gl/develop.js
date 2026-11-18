import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { loadAtlas, edgeTexture, stripMaterial, ribbon, dust, FinishShader, NOISE } from './strip.js'

/* ─────────────────────────────────────────────────────────────
   THE READING. The only honest loading screen.
   Your posters float as a deck, dissolve into light from the top
   down, pour through the gate, and come back up as a negative.
   ───────────────────────────────────────────────────────────── */

const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src })

export async function createDevelop(canvas, { posters, stills, duration = 7.2, onProgress, onDone }) {
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.6 : 1.75))
  renderer.setClearColor('#020203', 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60)
  camera.position.set(0, 0.2, 9)

  const imgs = (await Promise.all(posters.slice(0, 5).map(loadImg))).filter(Boolean)
  const atlas = await loadAtlas(stills.slice(0, 12), { cell: [512, 288], cols: 4 })
  const edge = edgeTexture()
  const n = imgs.length
  const CW = 1.5, CH = 2.25

  // ── the film: already threaded, running up through the gate, unexposed
  const curve = new THREE.CatmullRomCurve3([[2.6, -10, -1.6], [0.9, -4.2, -1.4], [-0.3, -0.6, -1.2], [0.5, 2.6, -1.8], [-1.4, 6.5, -3.6], [-4, 10, -7]].map((p) => new THREE.Vector3(...p)))
  const FRAME = 1.18
  const len = curve.getLength()
  const smat = stripMaterial({ atlas, edge, frameLen: FRAME })
  smat.uniforms.uFog.value.set(7, 22)
  smat.uniforms.uFocusR.value = 0.001
  smat.uniforms.uExpOn.value = 1
  smat.uniforms.uBright.value = 0
  smat.uniforms.uRim.value = 0.16
  const strip = new THREE.Mesh(ribbon(curve, { segments: mobile ? 360 : 520, width: 1.05, frameLen: FRAME, twist: (t) => Math.sin(t * 4.0 + 0.6) * 0.45 + t * 1.1 }), smat)
  scene.add(strip)
  // find where the film crosses the gate line, low in frame
  const gateY = mobile ? -3.4 : -2.35
  let gt = 0
  for (let i = 0, best = 1e9; i <= 400; i++) { const p = curve.getPointAt(i / 400); const d = Math.abs(p.y - gateY); if (d < best && p.y < 0) { best = d; gt = i / 400 } }
  const gP = curve.getPointAt(gt), gT = curve.getTangentAt(gt).normalize()
  const gB = new THREE.Vector3().crossVectors(gT, new THREE.Vector3(0, 0, 1)).normalize()
  gB.applyAxisAngle(gT, Math.sin(gt * 4.0 + 0.6) * 0.45 + gt * 1.1)
  const gateU = { P: { value: gP }, B: { value: gB }, T: { value: gT } }
  smat.uniforms.uGateU.value = (gt * len) / FRAME

  // ── the deck: posters as cards, fanned
  const deck = new THREE.Group()
  scene.add(deck)
  const cards = []
  const particleSets = []
  const res = mobile ? [44, 66] : [64, 96]
  imgs.forEach((im, i) => {
    const tex = new THREE.Texture(im)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    const off = i - (n - 1) / 2
    const m = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uMap: { value: tex }, uFront: { value: 1.2 }, uDelay: { value: i * 0.06 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform float uFront; varying vec2 vUv;
        ${NOISE}
        void main(){
          vec3 c = texture2D(uMap, vUv).rgb;
          float edge = (1.0 - vUv.y) + noise(vUv * vec2(18.0, 30.0)) * 0.12;
          float a = smoothstep(uFront - 0.02, uFront + 0.02, edge);
          float glow = smoothstep(0.06, 0.0, abs(edge - uFront));
          if (a < 0.01 && glow < 0.01) discard;
          vec3 col = c * a + vec3(1.0, 0.75, 0.45) * glow * 1.6;
          // thin bone border like a printed poster card
          float b = step(vUv.x, 0.012) + step(0.988, vUv.x) + step(vUv.y, 0.008) + step(0.992, vUv.y);
          col = mix(col, vec3(0.94), clamp(b, 0.0, 1.0) * a * 0.35);
          gl_FragColor = vec4(col, max(a, glow));
        }`,
    })
    const card = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), m)
    card.userData = { off, home: new THREE.Vector3(off * 0.5, Math.abs(off) * -0.07, -Math.abs(off) * 0.25), rz: -off * 0.12 }
    card.position.copy(card.userData.home)
    card.rotation.z = card.userData.rz
    deck.add(card)
    cards.push(card)

    // pixels → particles
    const c = document.createElement('canvas')
    c.width = res[0]; c.height = res[1]
    const g = c.getContext('2d')
    g.drawImage(im, 0, 0, res[0], res[1])
    const px = g.getImageData(0, 0, res[0], res[1]).data
    const N = res[0] * res[1]
    const start = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    const rnd = new Float32Array(N * 2)
    const vy = new Float32Array(N)
    for (let y = 0, k = 0; y < res[1]; y++)
      for (let x = 0; x < res[0]; x++, k++) {
        start[k * 3] = (x / (res[0] - 1) - 0.5) * CW
        start[k * 3 + 1] = (0.5 - y / (res[1] - 1)) * CH
        start[k * 3 + 2] = 0
        col[k * 3] = px[k * 4] / 255; col[k * 3 + 1] = px[k * 4 + 1] / 255; col[k * 3 + 2] = px[k * 4 + 2] / 255
        rnd[k * 2] = Math.random(); rnd[k * 2 + 1] = Math.random()
        vy[k] = y / (res[1] - 1)
      }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(start, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 2))
    geo.setAttribute('aV', new THREE.BufferAttribute(vy, 1))
    const pm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uFront: { value: 1.2 }, uTime: { value: 0 }, uCard: { value: new THREE.Matrix4() }, uGate: gateU.P, uAcross: gateU.B, uAlong: gateU.T, uPx: { value: Math.min(devicePixelRatio, 2) }, uSize: { value: mobile ? 3.4 : 2.6 } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor; attribute vec2 aRand; attribute float aV;
        uniform float uFront, uTime, uPx, uSize; uniform mat4 uCard; uniform vec3 uGate, uAcross, uAlong;
        varying vec3 vC; varying float vA;
        vec3 spectrum(float t){ return clamp(abs(mod(t*6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
        void main(){
          // released once the dissolve front passes this row; 0→1 is the fall, 1→1.5 is the ride up the strip
          float rel = clamp((uFront - aV - aRand.x * 0.05) * 1.6, 0.0, 1.5);
          float t = min(rel, 1.0);
          vec3 p0 = (uCard * vec4(position, 1.0)).xyz;
          float lane = (aRand.y - 0.5);
          // every particle lands on the strip itself, across its width, inside the gate
          vec3 g = uGate + uAcross * lane * 0.92;
          vec3 c1 = p0 + vec3(lane * 0.8 + sin(aRand.x * 30.0) * 0.4, 0.4 + aRand.x * 0.5, 1.0 + aRand.y * 0.8);
          vec3 c2 = mix(p0, g, 0.6) + vec3(lane * 1.6 + sin(aV * 12.0 + uTime) * 0.2, 0.0, 1.2);
          float e = t * t * (3.0 - 2.0 * t);
          vec3 p = mix(mix(mix(p0, c1, e), mix(c1, c2, e), e), mix(mix(c1, c2, e), g, e), e);
          p.x += sin(uTime * 3.0 + aRand.x * 40.0) * 0.04 * t * (1.0 - t);
          // after the gate: carried up with the film, pressed flat into the emulsion
          float ride = max(0.0, rel - 1.0) * 2.0;
          p += uAlong * ride * (0.12 + aRand.x * 0.22);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uSize * uPx * (1.0 - t * 0.5) * (1.0 - ride * 0.6) * (9.0 / -mv.z) * (rel > 0.0 ? 1.0 : 0.0);
          vec3 spec = spectrum(aRand.x + aV * 0.6 + uTime * 0.2);
          vC = mix(aColor, spec * 1.2, smoothstep(0.1, 0.6, t));
          vC = mix(vC, vec3(1.0, 0.95, 0.86), smoothstep(0.85, 1.0, t));
          vA = rel > 0.0 ? (1.0 - smoothstep(0.2, 1.0, ride)) * 0.9 : 0.0;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC * a, 1.0); }`,
    })
    const pts = new THREE.Points(geo, pm)
    pts.frustumCulled = false
    scene.add(pts)
    particleSets.push({ pts, card })
  })

  // ── the gate: a slit of light laid across the strip, where the posters land
  const gate = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.0),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      uniforms: { uI: { value: 0 }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uI, uTime; varying vec2 vUv;
        void main(){
          vec2 p = (vUv - 0.5) * vec2(3.2, 1.0);
          float core = exp(-pow(p.y * 34.0, 2.0)) * smoothstep(0.75, 0.5, abs(p.x));
          float halo = exp(-dot(p * vec2(1.2, 3.0), p * vec2(1.2, 3.0)) * 1.4);
          float jaws = smoothstep(0.02, 0.0, abs(abs(p.x) - 0.62)) * smoothstep(0.32, 0.0, abs(p.y));
          vec3 c = vec3(1.0, 0.98, 0.95) * core * 1.3 + vec3(0.8, 0.85, 1.0) * halo * 0.12 + vec3(1.0) * jaws * 0.25;
          gl_FragColor = vec4(c * uI, 1.0);
        }`,
    }),
  )
  gate.position.copy(gateU.P.value).add(new THREE.Vector3(0, 0, 0.08))
  gate.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), gateU.B.value.clone().normalize())
  scene.add(gate)

  const motes = dust(mobile ? 140 : 320, [12, 12, 10])
  motes.material.uniforms.uAlpha.value = 0.32
  scene.add(motes)

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.5, 0.68)
  composer.addPass(bloom)
  const finish = new ShaderPass(FinishShader)
  finish.uniforms.uCA.value = 0.003
  finish.uniforms.uFlicker.value = 0.6
  composer.addPass(finish)
  composer.addPass(new OutputPass())

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight
    renderer.setSize(w, h, false); composer.setSize(w, h)
    bloom.resolution.set(w * 0.5, h * 0.5)
    camera.aspect = w / h
    camera.position.z = w / h < 0.8 ? 12.5 : 9
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize); ro.observe(canvas)

  const T = { deck: 1.4, dissolve: 2.8 }
  const expStart = T.deck + 0.2 * T.dissolve
  const expEnd = T.deck + 1.3 * T.dissolve + 0.35
  const total = Math.max(duration, expEnd + 2.3)
  let t = 0, last = performance.now(), raf, done = false
  let expHi = null, expLo = -1e4
  smat.uniforms.uExpLo.value = -1e4; smat.uniforms.uExpHi.value = -1e4
  const ease = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3)
  const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x) }

  function loop() {
    const now = performance.now()
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    t += dt
    const time = t
    // A — the deck floats in, in front of a film already running
    const a = ease(t / 1.1)
    deck.position.y = (1 - a) * -0.8 + Math.sin(time * 1.4) * 0.05 + 0.7
    deck.rotation.y = Math.sin(time * 0.7) * 0.22
    deck.rotation.x = -0.1 + Math.sin(time * 0.5) * 0.05
    cards.forEach((c, i) => {
      const spread = 1 + Math.sin(time * 1.2 + i) * 0.04
      c.position.x = c.userData.home.x * spread * a
      c.rotation.z = c.userData.rz * a
    })
    smat.uniforms.uBright.value = 0.3 + 0.55 * ease((t - 0.3) / 1.4)
    // B — each poster comes apart top-down; every pixel falls into the gate and onto the film
    const b = (t - T.deck) / T.dissolve
    deck.updateMatrixWorld(true)
    particleSets.forEach(({ pts, card }, i) => {
      const f = Math.max(-0.2, Math.min(2.4, (b - i * 0.08) * 2.4))
      card.material.uniforms.uFront.value = b <= 0 ? -0.2 : f
      pts.material.uniforms.uFront.value = b <= 0 ? -0.5 : f
      pts.material.uniforms.uTime.value = time
      pts.material.uniforms.uCard.value.copy(card.matrixWorld)
    })
    // C — exposure: the film runs faster while light is landing on it
    const exposing = t >= expStart && t <= expEnd
    const speed = t < expStart ? 0.25 + 0.6 * smooth((t - expStart + 0.6) / 0.6) : exposing ? 0.85 : 0.85 - 0.45 * smooth((t - expEnd) / 1.2)
    smat.uniforms.uOffset.value -= dt * speed
    if (t >= expStart && expHi === null) expHi = smat.uniforms.uGateU.value + smat.uniforms.uOffset.value + 0.5
    if (expHi !== null) {
      if (t <= expEnd) expLo = smat.uniforms.uGateU.value + smat.uniforms.uOffset.value
      smat.uniforms.uExpHi.value = expHi
      smat.uniforms.uExpLo.value = expLo
    }
    const gi = smooth((t - expStart + 0.5) / 0.6) * (1 - smooth((t - expEnd) / 0.8))
    gate.material.uniforms.uI.value = gi * (0.94 + Math.sin(time * 9) * 0.03)
    gate.material.uniforms.uTime.value = time
    // D — the exposed run develops: negative to print, with the films' own colour coming through
    smat.uniforms.uTime.value = time
    smat.uniforms.uDevelopAll.value = ease((t - expEnd - 0.3) / 1.6)
    const c = smooth((t - expEnd + 0.4) / 2.2)
    camera.position.y = 0.2 + c * 0.5
    camera.position.x = Math.sin(time * 0.3) * 0.15
    camera.lookAt(0, -0.2 + c * 0.9, -0.8)
    motes.material.uniforms.uTime.value = time
    finish.uniforms.uTime.value = time
    finish.uniforms.uFade.value = Math.min(1, t * 2)
    composer.render()
    onProgress && onProgress(Math.min(1, t / total), { exposing, developed: smat.uniforms.uDevelopAll.value })
    if (t >= total && !done) { done = true; onDone && onDone() }
    raf = requestAnimationFrame(loop)
  }
  loop()
  return {
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect()
      scene.traverse((o) => { o.geometry && o.geometry.dispose(); if (o.material) { o.material.uniforms?.uMap?.value?.dispose?.(); o.material.dispose() } })
      atlas.tex.dispose(); edge.dispose(); renderer.dispose()
    },
  }
}

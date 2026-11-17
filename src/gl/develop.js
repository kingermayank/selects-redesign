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
      uniforms: { uFront: { value: 1.2 }, uTime: { value: 0 }, uCard: { value: new THREE.Matrix4() }, uGate: { value: new THREE.Vector3(0, -3.1, 0.6) }, uPx: { value: Math.min(devicePixelRatio, 2) }, uSize: { value: mobile ? 3.4 : 2.6 } },
      vertexShader: /* glsl */ `
        attribute vec3 aColor; attribute vec2 aRand; attribute float aV;
        uniform float uFront, uTime, uPx, uSize; uniform mat4 uCard; uniform vec3 uGate;
        varying vec3 vC; varying float vA;
        vec3 spectrum(float t){ return clamp(abs(mod(t*6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
        void main(){
          // released once the front passes this row
          float rel = clamp((uFront - aV - aRand.x * 0.05) * 1.6, 0.0, 1.0);
          float t = rel;
          vec3 p0 = (uCard * vec4(position, 1.0)).xyz;
          float lane = (aRand.y - 0.5);
          vec3 g = uGate + vec3(lane * 2.6, 0.0, (aRand.x - 0.5) * 0.4);
          // a falling ribbon: drift out, twist, then pour into the gate
          vec3 c1 = p0 + vec3(lane * 0.8 + sin(aRand.x * 30.0) * 0.4, 0.5 + aRand.x * 0.6, 1.2 + aRand.y * 0.8);
          vec3 c2 = vec3(lane * 0.9 + sin(aV * 12.0 + uTime) * 0.25, -1.4, 0.8);
          float e = t * t * (3.0 - 2.0 * t);
          vec3 p = mix(mix(mix(p0, c1, e), mix(c1, c2, e), e), mix(mix(c1, c2, e), g, e), e);
          p.x += sin(uTime * 3.0 + aRand.x * 40.0) * 0.04 * t;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uSize * uPx * (1.0 - t * 0.55) * (9.0 / -mv.z) * (rel > 0.0 ? 1.0 : 0.0);
          vec3 spec = spectrum(aRand.x + aV * 0.6 + uTime * 0.2);
          vC = mix(aColor, spec * 1.2, smoothstep(0.1, 0.6, t));
          vC = mix(vC, vec3(1.0, 0.85, 0.65), smoothstep(0.8, 1.0, t));
          vA = rel > 0.0 ? (1.0 - smoothstep(0.92, 1.0, t)) * 0.9 : 0.0;
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

  // ── the gate: where the light lands
  const gate = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 1.4),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uI: { value: 0 }, uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uI, uTime; varying vec2 vUv;
        void main(){
          vec2 p = (vUv - 0.5) * vec2(6.0, 1.4);
          float core = exp(-pow(p.y * 9.0, 2.0)) * smoothstep(2.4, 0.0, abs(p.x));
          float halo = exp(-dot(p, p) * 0.9);
          float rays = pow(max(0.0, 1.0 - abs(p.y) * 1.2), 3.0) * (0.6 + 0.4 * sin(p.x * 30.0 + uTime * 4.0));
          vec3 c = vec3(1.0, 0.99, 0.97) * core * 1.6 + vec3(0.8, 0.85, 1.0) * halo * 0.3 + vec3(0.9, 0.9, 1.0) * rays * 0.05;
          gl_FragColor = vec4(c * uI, 1.0);
        }`,
    }),
  )
  gate.position.set(0, -3.1, 0.6)
  scene.add(gate)

  // ── the negative rises
  const curve = new THREE.CatmullRomCurve3([[3.5, -9, -2], [1.2, -4.5, 0.2], [-0.6, -1, 0.6], [0.4, 2.4, -0.2], [-1.6, 6.5, -2.5], [-4, 10, -6]].map((p) => new THREE.Vector3(...p)))
  const smat = stripMaterial({ atlas, edge })
  smat.uniforms.uFog.value.set(6, 20)
  smat.uniforms.uFocusR.value = 0.001
  const strip = new THREE.Mesh(ribbon(curve, { segments: mobile ? 360 : 520, width: 1.05, twist: (t) => Math.sin(t * 5.0) * 0.7 + t * 1.5 }), smat)
  strip.position.y = -14
  scene.add(strip)

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

  const T = { deck: 1.5, dissolve: 2.7, rise: 2.9 }
  const total = Math.max(duration, T.deck + T.dissolve + T.rise)
  let t = 0, last = performance.now(), raf, done = false
  const ease = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3)

  function loop() {
    const now = performance.now()
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    t += dt
    const time = t
    // A — the deck floats in
    const a = ease(t / 1.1)
    deck.position.y = (1 - a) * -0.8 + Math.sin(time * 1.4) * 0.05 + 0.5
    deck.rotation.y = Math.sin(time * 0.7) * 0.22
    deck.rotation.x = -0.1 + Math.sin(time * 0.5) * 0.05
    cards.forEach((c, i) => {
      const spread = 1 + Math.sin(time * 1.2 + i) * 0.04
      c.position.x = c.userData.home.x * spread * a
      c.rotation.z = c.userData.rz * a
      c.material.opacity = a
    })
    // B — dissolve, top down, card after card
    const b = (t - T.deck) / T.dissolve
    deck.updateMatrixWorld(true)
    particleSets.forEach(({ pts, card }, i) => {
      const f = Math.max(-0.2, Math.min(1.3, (b - i * 0.09) * 1.45))
      const front = b <= 0 ? 0 : f
      card.material.uniforms.uFront.value = b <= 0 ? -0.2 : front
      pts.material.uniforms.uFront.value = b <= 0 ? -0.5 : front
      pts.material.uniforms.uTime.value = time
      pts.material.uniforms.uCard.value.copy(card.matrixWorld)
    })
    const gi = Math.max(0, Math.min(1, b * 1.6)) * (1 - ease((t - T.deck - T.dissolve - 0.6) / 1.2))
    gate.material.uniforms.uI.value = gi * (0.9 + Math.sin(time * 30) * 0.05)
    gate.material.uniforms.uTime.value = time
    // C — the negative rises out of the gate and develops
    const c = (t - T.deck - T.dissolve + 0.4) / T.rise
    strip.position.y = -14 + ease(c) * 14
    strip.rotation.y = (1 - ease(c)) * 0.6
    smat.uniforms.uOffset.value += dt * (0.5 + (1 - ease(c)) * 1.5)
    smat.uniforms.uTime.value = time
    smat.uniforms.uDevelopAll.value = ease((c - 0.45) / 0.55)
    camera.position.y = 0.2 + ease(c) * 0.4
    camera.lookAt(0, ease(c) * 0.6, 0)
    motes.material.uniforms.uTime.value = time
    finish.uniforms.uTime.value = time
    finish.uniforms.uFade.value = Math.min(1, t * 2) * (1 - ease((t - total + 0.5) / 0.5) * 0.0)
    composer.render()
    onProgress && onProgress(Math.min(1, t / total))
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

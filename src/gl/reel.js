import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { loadAtlas, edgeTexture, stripMaterial, ribbon, dust, FinishShader } from './strip.js'

/* The landing hero: a reel unspooling through a projector beam. */
export async function createReel(canvas, { images, portrait = false, onReady } = {}) {
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' })
  const dpr = Math.min(devicePixelRatio || 1, mobile ? 1.6 : 1.75)
  renderer.setPixelRatio(dpr)
  renderer.setClearColor('#040405', 1)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(portrait ? 46 : 34, 1, 0.1, 80)
  camera.position.set(0, 0, 10)

  await document.fonts?.ready?.catch?.(() => {})
  const atlas = await loadAtlas(images, { cell: [512, 288], cols: 4 })
  const edge = edgeTexture()

  // ── the hero strip: an S that comes from deep right, crosses the light, leaves past your shoulder
  const pts = portrait
    ? [[4.6, -9, -10], [3.0, -4.5, -4], [1.5, -1.4, -0.5], [0.9, 1.2, 0.8], [1.9, 4.2, 0.2], [3.6, 8, -2.5]]
    : [[11, -5.5, -16], [6.5, -2.8, -7], [2.6, -0.7, -1.6], [-0.4, 0.5, 0.6], [-3.4, 1.4, 1.2], [-7.5, 3.6, -0.4], [-13, 6.5, -5]]
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.5)
  const mat = stripMaterial({ atlas, edge })
  const strip = new THREE.Mesh(ribbon(curve, { segments: mobile ? 420 : 700, width: 1.0, twist: (t) => Math.sin(t * Math.PI * 1.6 + 0.4) * 0.85 + t * 0.6 }), mat)
  scene.add(strip)

  // ── a second strip behind, out of focus, running the other way
  const curve2 = new THREE.CatmullRomCurve3(
    (portrait
      ? [[-6, 9, -14], [-3, 3, -11], [-4.5, -2, -9], [-1, -8, -12]]
      : [[-14, -6, -18], [-6, -3.5, -13], [1, -4.6, -11], [8, -1.5, -13], [15, 2, -17]]
    ).map((p) => new THREE.Vector3(...p)),
  )
  const mat2 = stripMaterial({ atlas, edge })
  mat2.uniforms.uBright.value = 0.55
  mat2.uniforms.uFog.value.set(8, 26)
  const strip2 = new THREE.Mesh(ribbon(curve2, { segments: 300, width: 1.0, twist: (t) => t * 2.2 }), mat2)
  scene.add(strip2)

  // ── beam: the projector, from up and behind
  const beam = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 30),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; varying vec2 vUv;
        void main(){
          vec2 p = vUv - vec2(0.18, 1.02);
          float ang = atan(p.x, -p.y);
          float cone = smoothstep(0.42, 0.0, abs(ang - 0.62)) ;
          float fall = smoothstep(1.3, 0.0, length(p));
          float flick = 0.92 + 0.08 * sin(uTime * 37.0) * sin(uTime * 11.0);
          float rays = 0.75 + 0.25 * sin(ang * 90.0 + uTime * 0.6);
          vec3 c = vec3(0.86, 0.89, 1.0) * cone * fall * rays * 0.028 * flick;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  )
  beam.position.set(0, 0, -9)
  scene.add(beam)

  const motes = dust(mobile ? 260 : 620)
  scene.add(motes)

  // ── post
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), mobile ? 0.45 : 0.55, 0.5, 0.8)
  composer.addPass(bloom)
  const finish = new ShaderPass(FinishShader)
  composer.addPass(finish)
  composer.addPass(new OutputPass())

  // ── interaction
  const pointer = new THREE.Vector2(0, 0)
  const target = new THREE.Vector2(0, 0)
  const ray = new THREE.Raycaster()
  const focus = new THREE.Vector3()
  const focusTarget = new THREE.Vector3(1.5, -0.3, 0)
  let scroll = 0
  let speed = 0.16
  let boost = 0
  let hasPointer = false
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

  function resize() {
    const w = canvas.clientWidth || innerWidth
    const h = canvas.clientHeight || innerHeight
    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    bloom.resolution.set(w * 0.5, h * 0.5)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)

  const onMove = (e) => {
    const r = canvas.getBoundingClientRect()
    target.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    if (e.pointerType !== 'touch') hasPointer = true
    boost = Math.min(1.2, boost + Math.hypot(e.movementX || 0, e.movementY || 0) * 0.004)
  }
  addEventListener('pointermove', onMove, { passive: true })

  // ── loop
  let raf = 0, last = performance.now(), t = 0, visible = true, fade = 0
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { last = performance.now(); loop() } }, { threshold: 0 })
  io.observe(canvas)
  const onVis = () => { if (!document.hidden && visible) { last = performance.now(); loop() } }
  document.addEventListener('visibilitychange', onVis)
  const sample = new THREE.Vector3()

  function loop() {
    cancelAnimationFrame(raf)
    if (!visible || document.hidden) return
    const now = performance.now()
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    t += dt
    fade = Math.min(1, fade + dt * 0.7)
    boost *= 0.95
    pointer.lerp(target, 0.06)
    const sp = reduce ? 0.02 : speed + boost * 0.9 + scroll * 1.2
    mat.uniforms.uOffset.value += dt * sp
    mat2.uniforms.uOffset.value -= dt * sp * 0.6
    ;[mat, mat2].forEach((m) => (m.uniforms.uTime.value = t))
    motes.material.uniforms.uTime.value = t
    beam.material.uniforms.uTime.value = t
    finish.uniforms.uTime.value = t

    // where the light lands: pointer on desktop, a slow wander on touch
    if (hasPointer) {
      ray.setFromCamera(pointer, camera)
      ray.ray.intersectPlane(plane, focusTarget)
    } else {
      curve.getPointAt(0.48 + Math.sin(t * 0.22) * 0.16, sample)
      focusTarget.copy(sample)
    }
    focus.lerp(focusTarget, 0.08)
    mat.uniforms.uFocus.value.copy(focus)
    mat.uniforms.uFocusR.value = 2.6 + Math.sin(t * 0.7) * 0.2
    mat2.uniforms.uFocus.value.copy(focus)

    camera.position.x = pointer.x * 0.55
    camera.position.y = pointer.y * 0.35 - scroll * 0.6
    camera.position.z = 10 - scroll * 3.2
    camera.lookAt(0, -scroll * 0.4, 0)
    strip.rotation.z = Math.sin(t * 0.12) * 0.03
    finish.uniforms.uFade.value = fade * (1 - scroll * 0.55)
    composer.render()
    raf = requestAnimationFrame(loop)
  }
  loop()
  onReady && onReady()

  return {
    setScroll(p) { scroll = Math.max(0, Math.min(1, p)) },
    develop(v) { mat.uniforms.uDevelopAll.value = v },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect(); io.disconnect()
      removeEventListener('pointermove', onMove)
      document.removeEventListener('visibilitychange', onVis)
      scene.traverse((o) => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose() })
      atlas.tex.dispose(); edge.dispose()
      composer.dispose?.()
      renderer.dispose()
    },
  }
}

export function webglOK() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch { return false }
}

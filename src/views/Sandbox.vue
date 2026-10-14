<script setup lang="ts">
/**
 * 基地三维沙盘（规划示意）：Three.js 手工搭建的示意场景
 * 注意：这是规划布局示意模型，不是真实测绘三维重建。
 * POI 节点可点击 → 弹出节点详情与关联课程（与业务数据层 ID 联动）
 */
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getBase, poisOfBase, getCourse, coursesOfBase, type Poi, type Course } from '../data/store'

const route = useRoute()
const router = useRouter()
const base = getBase(route.params.id as string)
const pois = poisOfBase(base?.id ?? '')
const courses = coursesOfBase(base?.id ?? '')

const container = ref<HTMLDivElement | null>(null)
const activePoi = ref<Poi | null>(null)
const activeCourse = ref<Course | null>(null)

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let controls: OrbitControls
let raf = 0
const pickables: THREE.Object3D[] = []
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

/** 沙盘内各 POI 的示意布点（x, z 平面坐标，非真实地理坐标） */
const POI_LAYOUT: Record<string, { x: number; z: number; build: string }> = {
  'poi-visitor':     { x: 0,   z: 34,  build: 'hut' },
  'poi-forest-bath': { x: -18, z: 2,   build: 'grove' },
  'poi-meditation':  { x: 16,  z: -8,  build: 'platform' },
  'poi-aroma':       { x: -8,  z: 16,  build: 'garden' },
  'poi-trail-start': { x: 6,   z: 26,  build: 'gate' },
  'poi-rest':        { x: 12,  z: 8,   build: 'pavilion' },
  'poi-edu':         { x: -14, z: 24,  build: 'classroom' },
  'poi-view':        { x: 22,  z: -22, build: 'tower' },
  'poi-science':     { x: -2,  z: -16, build: 'sign' }
}

function terrainHeight(x: number, z: number): number {
  // 四周高、中间溪谷低的示意地形
  const d = Math.sqrt(x * x + z * z)
  const rim = Math.max(0, (d - 26) * 0.45)
  const ripple = Math.sin(x * 0.16) * Math.cos(z * 0.14) * 1.6
  const valley = -Math.exp(-Math.pow(x * 0.09, 2)) * 2.2 // 沿 z 轴的溪谷
  return rim + ripple + valley
}

function buildTerrain() {
  const seg = 90
  const geo = new THREE.PlaneGeometry(110, 110, seg, seg)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors: number[] = []
  const cLow = new THREE.Color('#4a7d4f'), cHigh = new THREE.Color('#8a9a6a'), cValley = new THREE.Color('#3d6b46')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    const h = terrainHeight(x, z)
    pos.setY(i, h)
    const t = Math.min(1, Math.max(0, (h + 2) / 10))
    const c = h < -1 ? cValley : cLow.clone().lerp(cHigh, t)
    colors.push(c.r, c.g, c.b)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.receiveShadow = true
  scene.add(mesh)
}

function buildStream() {
  const pts: THREE.Vector3[] = []
  for (let z = -52; z <= 52; z += 4) {
    const x = Math.sin(z * 0.12) * 3
    pts.push(new THREE.Vector3(x, terrainHeight(x, z) + 0.25, z))
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  const geo = new THREE.TubeGeometry(curve, 64, 0.9, 8, false)
  const mat = new THREE.MeshStandardMaterial({
    color: '#5aa3c4', roughness: 0.12, metalness: 0.15,
    transparent: true, opacity: 0.78, emissive: '#1a4a66', emissiveIntensity: 0.25
  })
  scene.add(new THREE.Mesh(geo, mat))
}

function treeAt(x: number, z: number, s = 1) {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22 * s, 0.3 * s, 1.6 * s, 6),
    new THREE.MeshStandardMaterial({ color: '#5d4a35', roughness: 1 })
  )
  trunk.position.y = 0.8 * s
  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(1.5 * s, 3.4 * s, 7),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#2f5d3a').offsetHSL(0, 0, Math.random() * 0.06), roughness: 1 })
  )
  crown.position.y = 1.6 * s + 1.7 * s
  crown.castShadow = true
  g.add(trunk, crown)
  g.position.set(x, terrainHeight(x, z), z)
  scene.add(g)
}

function buildForest() {
  const rand = mulberry(42)
  // —— 主林层：InstancedMesh 实例化渲染，一棵树一帧一个 drawcall ——
  const spots: { x: number; z: number; s: number }[] = []
  for (let i = 0; i < 700; i++) {
    const x = (rand() - 0.5) * 104
    const z = (rand() - 0.5) * 104
    if (Math.abs(x) < 4.5 && Math.abs(z) < 50) continue // 让开溪谷
    let nearPoi = false
    for (const k in POI_LAYOUT) {
      const p = POI_LAYOUT[k]
      if ((x - p.x) ** 2 + (z - p.z) ** 2 < 34) { nearPoi = true; break }
    }
    if (nearPoi) continue
    spots.push({ x, z, s: 0.75 + rand() * 1.0 })
  }
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.32, 1.7, 5)
  const crownGeo = new THREE.ConeGeometry(1.5, 3.4, 6)
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#5d4a35', roughness: 1 }), spots.length)
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: '#2f5d3a', roughness: 1 }), spots.length)
  crowns.castShadow = true
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), tv = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const col = new THREE.Color()
  spots.forEach((p, i) => {
    const y = terrainHeight(p.x, p.z)
    q.setFromAxisAngle(up, rand() * Math.PI * 2)
    sc.set(p.s, p.s, p.s)
    m.compose(tv.set(p.x, y + 0.85 * p.s, p.z), q, sc)
    trunks.setMatrixAt(i, m)
    m.compose(tv.set(p.x, y + 3.25 * p.s, p.z), q, sc)
    crowns.setMatrixAt(i, m)
    col.set('#2f5d3a').offsetHSL(rand() * 0.02 - 0.01, rand() * 0.08, rand() * 0.07 - 0.02)
    crowns.setColorAt(i, col)
  })
  trunks.instanceMatrix.needsUpdate = true
  crowns.instanceMatrix.needsUpdate = true
  if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true
  scene.add(trunks, crowns)

  // —— 林下灌木层 ——
  const bushCount = 280
  const bushes = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.7, 0),
    new THREE.MeshStandardMaterial({ color: '#3a6b42', roughness: 1 }),
    bushCount
  )
  for (let i = 0; i < bushCount; i++) {
    const x = (rand() - 0.5) * 100, z = (rand() - 0.5) * 100
    const s = 0.5 + rand() * 0.9
    q.setFromAxisAngle(up, rand() * Math.PI)
    m.compose(tv.set(x, terrainHeight(x, z) + 0.3 * s, z), q, sc.set(s, s * 0.7, s))
    bushes.setMatrixAt(i, m)
    col.set('#3a6b42').offsetHSL(0, rand() * 0.06, rand() * 0.06)
    bushes.setColorAt(i, col)
  }
  bushes.instanceMatrix.needsUpdate = true
  if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true
  scene.add(bushes)

  // —— 古树林（森林浴场）独立大树 ——
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    treeAt(-18 + Math.cos(a) * 6, 2 + Math.sin(a) * 6, 1.7 + (i % 3) * 0.25)
  }
}

function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function groundY(x: number, z: number) { return terrainHeight(x, z) }

function hut(x: number, z: number, color = '#8a6b4a') {
  const g = new THREE.Group()
  const base = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 3.2), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }))
  base.position.y = 1.2
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.8, 4), new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 1 }))
  roof.position.y = 3.3; roof.rotation.y = Math.PI / 4
  base.castShadow = roof.castShadow = true
  // 暖光窗
  const winMat = new THREE.MeshStandardMaterial({ color: '#ffd98a', emissive: '#ffbf5a', emissiveIntensity: 0.85, roughness: 0.4 })
  const win1 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.6), winMat)
  win1.position.set(-0.8, 1.3, 1.62)
  const win2 = win1.clone(); win2.position.x = 0.8
  // 门
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.4), new THREE.MeshStandardMaterial({ color: '#4a3524', roughness: 1 }))
  door.position.set(0, 0.9, 1.62)
  g.add(base, roof, win1, win2, door)
  g.position.set(x, groundY(x, z), z)
  scene.add(g)
}

function platform(x: number, z: number, r = 3.4) {
  const g = new THREE.Group()
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.4, 10), new THREE.MeshStandardMaterial({ color: '#a08050', roughness: 0.85 }))
  deck.position.y = 1.5
  deck.castShadow = true
  g.add(deck)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.5, 5), new THREE.MeshStandardMaterial({ color: '#6b5335' }))
    leg.position.set(Math.cos(a) * (r - 0.5), 0.75, Math.sin(a) * (r - 0.5))
    g.add(leg)
  }
  g.position.set(x, groundY(x, z), z)
  scene.add(g)
}

function pavilion(x: number, z: number) {
  const g = new THREE.Group()
  const deck = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.3, 4.6), new THREE.MeshStandardMaterial({ color: '#a08050' }))
  deck.position.y = 0.7
  g.add(deck)
  for (const [dx, dz] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 2.6, 6), new THREE.MeshStandardMaterial({ color: '#6b5335' }))
    p.position.set(dx, 2, dz)
    g.add(p)
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 1.6, 4), new THREE.MeshStandardMaterial({ color: '#3f5a44', roughness: 1 }))
  roof.position.y = 4.1; roof.rotation.y = Math.PI / 4
  roof.castShadow = true
  g.add(roof)
  g.position.set(x, groundY(x, z), z)
  scene.add(g)
}

function tower(x: number, z: number) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 6, 8), new THREE.MeshStandardMaterial({ color: '#7d6545', roughness: 0.9 }))
  body.position.y = 3
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.35, 8), new THREE.MeshStandardMaterial({ color: '#a08050' }))
  top.position.y = 6.2
  body.castShadow = top.castShadow = true
  g.add(body, top)
  g.position.set(x, groundY(x, z), z)
  scene.add(g)
}

function gate(x: number, z: number) {
  const g = new THREE.Group()
  for (const dx of [-1.6, 1.6]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3.4, 6), new THREE.MeshStandardMaterial({ color: '#6b5335' }))
    p.position.set(dx, 1.7, 0)
    g.add(p)
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.35, 0.5), new THREE.MeshStandardMaterial({ color: '#8a6b4a' }))
  beam.position.y = 3.4
  g.add(beam)
  g.position.set(x, groundY(x, z), z)
  scene.add(g)
}

function signBoard(x: number, z: number) {
  const g = new THREE.Group()
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), new THREE.MeshStandardMaterial({ color: '#6b5335' }))
  post.position.y = 1.1
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 0.12), new THREE.MeshStandardMaterial({ color: '#d8cba8' }))
  board.position.y = 2.4
  g.add(post, board)
  g.position.set(x, groundY(x, z), z)
  scene.add(g)
}

function garden(x: number, z: number) {
  const g = new THREE.Group()
  const rand = mulberry(7)
  for (let i = 0; i < 12; i++) {
    const dx = (rand() - 0.5) * 7, dz = (rand() - 0.5) * 7
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(0.7 + rand() * 0.5, 7, 6),
      new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.28 + rand() * 0.08, 0.5, 0.32 + rand() * 0.12), roughness: 1 })
    )
    bush.position.set(dx, 0.5, dz)
    g.add(bush)
  }
  g.position.set(x, groundY(x, z), z)
  scene.add(g)
}

function buildStructures() {
  hut(0, 34); hut(-3.5, 36.5, '#7d6545'); hut(3.5, 36, '#94805e')       // 游客服务点·康养小屋群
  platform(16, -8, 3.4)                                                  // 冥想平台
  platform(22, -22, 0.1)                                                 // 占位（被 tower 替换视觉）
  pavilion(12, 8)                                                        // 休憩区
  tower(22, -22)                                                         // 观景平台
  gate(6, 26)                                                            // 步道起点
  signBoard(-2, -16)                                                     // 科普解说点
  garden(-8, 16)                                                         // 芳疗小径
  hut(-14, 24, '#5d6b4a')                                                // 自然教育课堂
}

function buildTrail() {
  const order = ['poi-visitor', 'poi-trail-start', 'poi-aroma', 'poi-forest-bath', 'poi-rest', 'poi-meditation', 'poi-view']
  const pts = order.map(id => {
    const p = POI_LAYOUT[id]
    return new THREE.Vector3(p.x, groundY(p.x, p.z) + 0.18, p.z)
  })
  const curve = new THREE.CatmullRomCurve3(pts)
  const geo = new THREE.TubeGeometry(curve, 80, 0.42, 6, false)
  const mat = new THREE.MeshStandardMaterial({ color: '#c9b287', roughness: 1 })
  scene.add(new THREE.Mesh(geo, mat))
}

function makeLabel(text: string): THREE.Sprite {
  const cv = document.createElement('canvas')
  cv.width = 512; cv.height = 128
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = 'rgba(22, 48, 36, 0.88)'
  ctx.beginPath(); ctx.roundRect(6, 20, 500, 88, 26); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 46px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, 256, 64)
  const tex = new THREE.CanvasTexture(cv)
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  sp.scale.set(9, 2.25, 1)
  return sp
}

function buildPoiNodes() {
  for (const poi of pois) {
    const layout = POI_LAYOUT[poi.id]
    if (!layout) continue
    const g = new THREE.Group()
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 16, 16),
      new THREE.MeshStandardMaterial({ color: '#c9a86a', emissive: '#8a6b2a', emissiveIntensity: 0.55, roughness: 0.4 })
    )
    marker.position.y = 5.2
    marker.userData.poiId = poi.id
    pickables.push(marker)
    const label = makeLabel(poi.name)
    label.position.y = 7.6
    g.add(marker, label)
    g.position.set(layout.x, groundY(layout.x, layout.z), layout.z)
    g.userData.marker = marker
    scene.add(g)
    ;(marker as any)._baseY = 5.2
  }
}

function onClick(ev: MouseEvent) {
  if (!renderer) return
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(pickables, false)
  if (hits.length) {
    const id = hits[0].object.userData.poiId
    const poi = pois.find(p => p.id === id)
    if (poi) { activePoi.value = poi; activeCourse.value = null }
  }
}

function openCourse(c: Course) { activeCourse.value = c }
function closePanels() { activePoi.value = null; activeCourse.value = null }

// 调试/测试钩子（自动化验收用）
;(window as any).__SANDBOX__ = {
  openPoi(id: string) {
    const p = pois.find(x => x.id === id)
    if (p) { activePoi.value = p; activeCourse.value = null }
  },
  openCourse(id: string) {
    const c = getCourse(id)
    if (c) activeCourse.value = c
  },
  get activePoi() { return activePoi.value?.id ?? null },
  get activeCourse() { return activeCourse.value?.id ?? null },
  get pickableCount() { return pickables.length }
}

let markersAnim: THREE.Object3D[] = []
function animate(t: number) {
  raf = requestAnimationFrame(animate)
  for (const m of pickables) {
    m.position.y = (m as any)._baseY + Math.sin(t * 0.002 + m.id) * 0.45
    m.rotation.y = t * 0.001
  }
  controls.update()
  renderer!.render(scene, camera)
}

function onResize() {
  if (!renderer || !container.value) return
  const w = container.value.clientWidth, h = container.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

onMounted(() => {
  const w = container.value!.clientWidth, h = container.value!.clientHeight
  scene = new THREE.Scene()
  // 天空渐变背景
  const skyCv = document.createElement('canvas')
  skyCv.width = 4; skyCv.height = 256
  const sctx = skyCv.getContext('2d')!
  const grad = sctx.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, '#6fa8dc'); grad.addColorStop(0.55, '#a8cbe6')
  grad.addColorStop(0.8, '#dcebf0'); grad.addColorStop(1, '#cfe0d5')
  sctx.fillStyle = grad; sctx.fillRect(0, 0, 4, 256)
  const skyTex = new THREE.CanvasTexture(skyCv)
  skyTex.colorSpace = THREE.SRGBColorSpace
  scene.background = skyTex
  scene.fog = new THREE.Fog('#c3dcea', 85, 235)

  camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 500)
  camera.position.set(30, 48, 58)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.18
  container.value!.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 2, 0)
  controls.enableDamping = true
  controls.maxPolarAngle = Math.PI * 0.46
  controls.minDistance = 18
  controls.maxDistance = 160

  scene.add(new THREE.HemisphereLight('#bcd8ee', '#41603f', 0.6))
  scene.add(new THREE.AmbientLight('#eaf2e4', 0.4))
  const sun = new THREE.DirectionalLight('#ffedd0', 1.9)
  sun.position.set(50, 70, 30)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70 })
  scene.add(sun)

  buildTerrain(); buildStream(); buildForest(); buildStructures(); buildTrail(); buildPoiNodes()
  markersAnim = pickables

  renderer.domElement.addEventListener('click', onClick)
  window.addEventListener('resize', onResize)
  raf = requestAnimationFrame(animate)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', onResize)
  renderer?.domElement.removeEventListener('click', onClick)
  controls?.dispose()
  renderer?.dispose()
})
</script>

<template>
  <div class="sandbox" v-if="base">
    <div ref="container" class="sb-canvas"></div>

    <header class="sb-top">
      <button class="back" @click="router.push(`/base/${base.id}`)">‹ 返回{{ base.shortName }}详情</button>
      <div class="sb-title">
        <h1>{{ base.name }} · 规划布局沙盘</h1>
        <p>三维示意模型（非真实测绘重建） · 点击金色节点查看设施与关联课程</p>
      </div>
    </header>

    <!-- POI 详情面板 -->
    <transition name="fade">
      <aside class="sb-panel" v-if="activePoi && !activeCourse">
        <button class="x" @click="closePanels">×</button>
        <span class="p-type">{{ activePoi.type }} · 规划示意</span>
        <h2>{{ activePoi.name }}</h2>
        <p class="p-desc">{{ activePoi.description }}</p>
        <p class="p-func">功能：{{ activePoi.function }}</p>
        <p class="p-tips">💡 {{ activePoi.tips }}</p>
        <div class="p-courses">
          <b>适合该节点的课程</b>
          <div v-for="cid in activePoi.courses" :key="cid" class="c-link" @click="openCourse(getCourse(cid)!)">
            <template v-if="getCourse(cid)">
              <img class="c-thumb" :src="`./images/${cid}.png`" :alt="getCourse(cid)!.title" loading="lazy" />
              <span class="c-link-text">
                <span class="c-cat" :class="getCourse(cid)!.category === '森林康养' ? 'h' : 'e'">{{ getCourse(cid)!.category }}</span>
                {{ getCourse(cid)!.title }} →
              </span>
            </template>
          </div>
        </div>
      </aside>
    </transition>

    <!-- 课程详情面板 -->
    <transition name="fade">
      <aside class="sb-panel wide" v-if="activeCourse">
        <button class="x" @click="activeCourse = null">×</button>
        <img class="sp-cover" :src="`./images/${activeCourse.id}.png`" :alt="activeCourse.title" />
        <span class="p-type">{{ activeCourse.category }} · 示范课程方案</span>
        <h2>{{ activeCourse.title }}</h2>
        <p class="p-desc">{{ activeCourse.goal }}</p>
        <div class="c-meta">
          <span>⏱ {{ activeCourse.duration }}</span>
          <span>👥 {{ activeCourse.audience.split('、')[0] }}</span>
          <button class="full-btn" @click="router.push(`/course/${activeCourse.id}`)">图文完整版 ›</button>
        </div>
        <div class="c-steps">
          <div v-for="st in activeCourse.steps" :key="st.order" class="c-step"
               :class="{ hl: st.poiId === activePoi?.id }">
            <i>{{ st.order }}</i>
            <div><b>{{ st.name }}</b><em>{{ st.minutes }}分钟</em><p>{{ st.content }}</p></div>
          </div>
        </div>
        <p class="p-tips">⚠️ {{ activeCourse.safety }}</p>
      </aside>
    </transition>

    <footer class="sb-foot">沙盘为规划布局示意，设施位置非实测 · 数据来源：平台业务数据层（ID 联动） · Three.js 实时渲染</footer>
  </div>
</template>

<style scoped>
.sandbox { position: absolute; inset: 0; background: #cfe3ee; }
.sb-canvas { position: absolute; inset: 0; }
.c-thumb { width: 56px; height: 38px; object-fit: cover; border-radius: 6px; flex: none; }
.c-link { display: flex; align-items: center; gap: 9px; }
.c-link-text { flex: 1; }
.sp-cover { width: 100%; height: 150px; object-fit: cover; border-radius: 10px; margin-bottom: 10px; display: block; }
.full-btn {
  margin-left: auto; padding: 4px 12px; border-radius: 7px;
  border: 1px solid rgba(201, 168, 106, .55); background: rgba(201, 168, 106, .12);
  color: #e8dcc0; font-size: 11.5px; cursor: pointer;
}
.full-btn:hover { background: rgba(201, 168, 106, .28); }
.sb-top {
  position: absolute; top: 0; left: 0; right: 0; z-index: 10;
  display: flex; align-items: center; gap: 14px; padding: 12px 18px;
  background: linear-gradient(180deg, rgba(20, 40, 30, .82), transparent);
}
.back { background: rgba(255,255,255,.16); color: #fff; border: none; border-radius: 8px; padding: 8px 13px; cursor: pointer; font-size: 13px; }
.sb-title h1 { font-size: 16.5px; color: #fff; }
.sb-title p { font-size: 11.5px; color: rgba(255,255,255,.7); margin-top: 3px; }

.sb-panel {
  position: absolute; top: 76px; right: 16px; bottom: 44px; z-index: 11;
  width: 350px; overflow-y: auto;
  background: rgba(255,255,255,.96); backdrop-filter: blur(10px);
  border-radius: 14px; padding: 18px; box-shadow: 0 8px 32px rgba(0,0,0,.22);
}
.sb-panel.wide { width: 400px; }
.x { position: absolute; top: 10px; right: 12px; border: none; background: #eef2ee; width: 26px; height: 26px; border-radius: 50%; cursor: pointer; }
.p-type { font-size: 11px; color: #a07828; background: #faf3e3; padding: 3px 9px; border-radius: 8px; }
.sb-panel h2 { font-size: 17px; color: #1e3a2c; margin: 8px 0; }
.p-desc { font-size: 13px; color: #3d4f42; line-height: 1.75; }
.p-func { font-size: 12px; color: #37654a; margin-top: 8px; }
.p-tips { font-size: 12px; color: #7a6535; margin-top: 8px; line-height: 1.6; }
.p-courses { margin-top: 12px; border-top: 1px solid #e4eae4; padding-top: 10px; }
.p-courses b { font-size: 12.5px; color: #37654a; }
.c-link { font-size: 13px; color: #2e6b4a; padding: 6px 0; cursor: pointer; }
.c-link:hover { text-decoration: underline; }
.c-cat { font-size: 10px; padding: 1px 7px; border-radius: 7px; margin-right: 4px; }
.c-cat.h { background: #e4efe6; }
.c-cat.e { background: #e6ecf5; color: #3a5a8a; }

.c-meta { display: flex; gap: 14px; font-size: 12px; color: #6b7d6e; margin: 8px 0; }
.c-steps { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.c-step { display: flex; gap: 9px; padding: 7px 8px; border-radius: 9px; background: #f7f9f7; }
.c-step.hl { background: #eaf4ec; outline: 1.5px solid #2e6b4a; }
.c-step i {
  width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0; font-style: normal;
  background: #2e6b4a; color: #fff; font-size: 11px; display: flex; align-items: center; justify-content: center;
}
.c-step b { font-size: 12.5px; color: #2a3a2e; }
.c-step em { font-size: 10.5px; color: #a08a55; font-style: normal; margin-left: 6px; }
.c-step p { font-size: 12px; color: #5a6b5e; line-height: 1.6; margin-top: 3px; }

.sb-foot {
  position: absolute; bottom: 0; left: 0; right: 0; z-index: 8;
  text-align: center; font-size: 10.5px; color: rgba(22, 48, 36, .8);
  background: linear-gradient(0deg, rgba(255,255,255,.85), transparent);
  padding: 12px 8px 6px;
}
.fade-enter-active, .fade-leave-active { transition: all .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(12px); }

@media (max-width: 768px) {
  .sb-panel, .sb-panel.wide { width: calc(100vw - 24px); right: 12px; top: auto; bottom: 40px; max-height: 56vh; }
  .sb-title h1 { font-size: 13.5px; }
}
</style>

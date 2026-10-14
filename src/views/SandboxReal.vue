<script setup lang="ts">
/**
 * 云灵山真实场景沙盘：高德卫星影像 × NASA SRTM 真实地形（MapLibre 三维）
 * —— 替代原 Three.js 卡通示意沙盘，呈现基地所在场地真实地貌 ——
 * 布点/路线：基于 DEM 溪谷追踪生成，贴合真实地形起伏；
 * 节点为规划示意布点，点击金色节点 → 弹出设施详情与关联课程（业务数据层 ID 联动，与原沙盘一致）
 */
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import maplibregl from 'maplibre-gl'
import { IMAGERY_SOURCES, TERRAIN_SOURCES, ACTIVE_IMAGERY, ACTIVE_TERRAIN } from '../config/dataSources'
import { getBase, poisOfBase, getCourse, coursesOfBase, type Poi, type Course } from '../data/store'
import scene from '../data/yls_scene.json'

const route = useRoute()
const router = useRouter()
const base = getBase(route.params.id as string)
const pois = poisOfBase(base?.id ?? '')
const courses = coursesOfBase(base?.id ?? '')

const container = ref<HTMLDivElement | null>(null)
const activePoi = ref<Poi | null>(null)
const activeCourse = ref<Course | null>(null)
const is3D = ref(true)

let map: maplibregl.Map | null = null
let pulseRaf = 0

const imagery = IMAGERY_SOURCES[ACTIVE_IMAGERY]
const terrainSrc = TERRAIN_SOURCES[ACTIVE_TERRAIN]

/** 仅云灵山基地提供实景沙盘 */
const isYunlingshan = base?.id === 'yunlingshan'

// —— GeoJSON 构造 ——
function poisFC(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pois
      .filter(p => (scene.poiCoords as Record<string, number[]>)[p.id])
      .map(p => ({
        type: 'Feature' as const,
        properties: { id: p.id, name: p.name },
        geometry: { type: 'Point' as const, coordinates: (scene.poiCoords as Record<string, number[]>)[p.id] }
      }))
  }
}
function routeFC(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: scene.route } }]
  }
}
function spursFC(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: scene.spurs.map(s => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: s } }))
  }
}
function streamFC(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { name: '福禅溪' }, geometry: { type: 'LineString', coordinates: scene.stream } }]
  }
}
function summitFC(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { label: `▲ ${scene.summit.name} ${scene.summit.elevText}` },
      geometry: { type: 'Point', coordinates: scene.summit.coord }
    }]
  }
}

function buildStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    // 字形自托管（构建后随站点发布）；中文(CJK)由 localIdeographFontFamily 本机渲染
    glyphs: `${import.meta.env.BASE_URL}fonts/{fontstack}/{range}.pbf`,
    sources: {
      imagery: { type: 'raster', tiles: imagery.tiles, tileSize: 256, maxzoom: imagery.maxzoom, attribution: imagery.attribution },
      dem: { type: 'raster-dem', tiles: terrainSrc.tiles, tileSize: 256, maxzoom: 15, encoding: 'terrarium', attribution: terrainSrc.attribution },
      'dem-hs': { type: 'raster-dem', tiles: terrainSrc.tiles, tileSize: 256, maxzoom: 15, encoding: 'terrarium' },
      pois: { type: 'geojson', data: poisFC() as any },
      route: { type: 'geojson', data: routeFC() as any },
      spurs: { type: 'geojson', data: spursFC() as any },
      stream: { type: 'geojson', data: streamFC() as any },
      summit: { type: 'geojson', data: summitFC() as any }
    },
    layers: [
      { id: 'imagery', type: 'raster', source: 'imagery', paint: { 'raster-saturation': -0.05 } },
      { id: 'hillshade', type: 'hillshade', source: 'dem-hs',
        paint: { 'hillshade-exaggeration': 0.42, 'hillshade-shadow-color': '#16281c', 'hillshade-highlight-color': '#fff4dc', 'hillshade-accent-color': '#2a4a34' } },
      // 福禅溪（真实溪谷走向，DEM 追踪）
      { id: 'stream-glow', type: 'line', source: 'stream',
        paint: { 'line-color': '#7fc4e8', 'line-width': 6, 'line-blur': 5, 'line-opacity': 0.4 } },
      { id: 'stream-line', type: 'line', source: 'stream',
        paint: { 'line-color': '#a8d8f0', 'line-width': 2.2, 'line-opacity': 0.9 } },
      { id: 'stream-label', type: 'symbol', source: 'stream',
        layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-size': 11.5, 'text-font': ['Noto Sans Regular'], 'text-letter-spacing': 2 },
        paint: { 'text-color': '#cfe9f8', 'text-halo-color': '#10303f', 'text-halo-width': 1.6 } },
      // 步道支线（通往坡地节点的虚线小径）
      { id: 'spurs-line', type: 'line', source: 'spurs',
        paint: { 'line-color': '#e8dcc0', 'line-width': 1.6, 'line-dasharray': [2, 1.6], 'line-opacity': 0.85 } },
      // 课程主路线（贴地：深色描边 + 暖沙色芯线）
      { id: 'route-casing', type: 'line', source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#2a2416', 'line-width': 6.5, 'line-opacity': 0.75 } },
      { id: 'route-core', type: 'line', source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffcf5c', 'line-width': 3.2, 'line-opacity': 0.98 } },
      // 云灵山峰标注（DEM 最高点，1370m）
      { id: 'summit-label', type: 'symbol', source: 'summit',
        layout: { 'text-field': ['get', 'label'], 'text-size': 12.5, 'text-font': ['Noto Sans Regular'], 'text-anchor': 'bottom', 'text-allow-overlap': true },
        paint: { 'text-color': '#ffffff', 'text-halo-color': '#20402c', 'text-halo-width': 2 } },
      // POI 脉冲光晕（动画驱动半径/透明度）
      { id: 'poi-glow', type: 'circle', source: 'pois',
        paint: { 'circle-radius': 12, 'circle-color': '#ffcf5c', 'circle-opacity': 0.35, 'circle-blur': 0.7 } },
      { id: 'poi-label', type: 'symbol', source: 'pois',
        layout: { 'text-field': ['get', 'name'], 'text-size': 13, 'text-font': ['Noto Sans Regular'], 'text-anchor': 'bottom', 'text-offset': [0, -2.6], 'text-allow-overlap': true, 'text-ignore-placement': true },
        paint: { 'text-color': '#fff', 'text-halo-color': '#10211a', 'text-halo-width': 2.4 } }
    ]
  }
}

function applyTerrain() {
  if (!map) return
  map.setTerrain(is3D.value ? { source: 'dem', exaggeration: 1.6 } : null)
}

/** Canvas 绘制金色图钉（与首页基地图钉同一视觉语言）→ ImageData → addImage */
function drawPinImage() {
  if (!map || map.hasImage('poi-pin')) return
  const s = 2, w = 44, h = 56
  const c = document.createElement('canvas')
  c.width = w * s; c.height = h * s
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.scale(s, s)
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2
  const grad = ctx.createLinearGradient(0, 3, 0, 53)
  grad.addColorStop(0, '#ffe7ad'); grad.addColorStop(0.55, '#ffcf5c'); grad.addColorStop(1, '#e2a433')
  ctx.beginPath()
  ctx.moveTo(22, 3)
  ctx.bezierCurveTo(32.5, 3, 41, 11.5, 41, 22)
  ctx.bezierCurveTo(41, 36, 24, 47, 22, 53)
  ctx.bezierCurveTo(20, 47, 3, 36, 3, 22)
  ctx.bezierCurveTo(3, 11.5, 11.5, 3, 22, 3)
  ctx.closePath()
  ctx.fillStyle = grad; ctx.fill()
  ctx.restore()
  ctx.lineWidth = 2.6; ctx.strokeStyle = '#ffffff'; ctx.stroke()
  ctx.beginPath(); ctx.arc(22, 21, 8, 0, Math.PI * 2); ctx.fillStyle = 'rgba(22,48,31,0.5)'; ctx.fill()
  ctx.beginPath(); ctx.arc(22, 21, 4.2, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill()
  try {
    const imgData = ctx.getImageData(0, 0, c.width, c.height)
    map.addImage('poi-pin', imgData, { pixelRatio: s })
  } catch { /* 精灵图未就绪，由 ensurePin 下帧重试 */ }
}

function ensurePin() {
  if (!map) return
  try { drawPinImage() } catch { /* 忽略 */ }
  if (map.hasImage('poi-pin')) {
    if (!map.getLayer('poi-pin')) {
      map.addLayer({
        id: 'poi-pin', type: 'symbol', source: 'pois',
        layout: { 'icon-image': 'poi-pin', 'icon-size': 0.5, 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true },
        paint: {}
      }, 'poi-label')
    }
    bindClicks()
    pulse()
  } else {
    requestAnimationFrame(ensurePin)
  }
}

/** POI 脉冲呼吸动画 */
function pulse() {
  if (!map || !map.getLayer('poi-glow')) return
  const t = (performance.now() % 2200) / 2200
  map.setPaintProperty('poi-glow', 'circle-radius', 9 + t * 15)
  map.setPaintProperty('poi-glow', 'circle-opacity', 0.5 * (1 - t))
  pulseRaf = requestAnimationFrame(pulse)
}

function bindClicks() {
  if (!map) return
  for (const id of ['poi-pin', 'poi-glow', 'poi-label']) {
    map.on('click', id, (ev) => {
      const fid = (ev as any).features?.[0]?.properties?.id
      const poi = pois.find(p => p.id === fid)
      if (poi) { activePoi.value = poi; activeCourse.value = null }
    })
  }
  map.on('mouseenter', 'poi-pin', () => { if (map) map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'poi-pin', () => { if (map) map.getCanvas().style.cursor = '' })
}

function toggle3D() {
  is3D.value = !is3D.value
  applyTerrain()
  map?.easeTo({ pitch: is3D.value ? 60 : 0, duration: 800 })
}

function refit() {
  if (!map) return
  // 沿溪谷向南望的电影感视角：整条课程路线尽收，近景为谷底、远景为山脊
  map.flyTo({
    center: [117.3962, 27.4102],
    zoom: 13.65,
    pitch: is3D.value ? 62 : 0,
    bearing: -14,
    duration: 1600
  })
}

function openCourse(c: Course) { activeCourse.value = c }
function closePanels() { activePoi.value = null; activeCourse.value = null }

// 调试/测试钩子（自动化验收用，与原沙盘同名）
;(window as any).__SANDBOX__ = {
  openPoi(id: string) {
    const p = pois.find(x => x.id === id)
    if (p) { activePoi.value = p; activeCourse.value = null }
  },
  openCourse(id: string) {
    const c = getCourse(id)
    if (c) activeCourse.value = c
  },
  zoomTo(zoom?: number) {
    if (!map) return
    map.easeTo({ zoom: zoom ?? 15.2, duration: 1200 })
  },
  get activePoi() { return activePoi.value?.id ?? null },
  get activeCourse() { return activeCourse.value?.id ?? null },
  get pickableCount() { return pois.length }
}

onMounted(() => {
  if (!isYunlingshan) return
  map = new maplibregl.Map({
    container: container.value!,
    style: buildStyle(),
    center: [117.396, 27.408],
    zoom: 12.3,
    pitch: 30,
    bearing: scene.camera.bearing,
    maxPitch: 75,
    attributionControl: { compact: true },
    localIdeographFontFamily: 'sans-serif'
  })
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

  // 图钉/地形/初始视角不单依赖 load 事件：字体源偶发挂起会使 load 不触发，styledata 兜底
  let readyDone = false
  function onReady() {
    if (readyDone || !map) return
    readyDone = true
    applyTerrain()
    try {
      ;(map as any).setSky?.({
        'sky-color': '#8fb8d8', 'horizon-color': '#dcebf4', 'fog-color': '#e8f0f5',
        'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.4
      })
    } catch { /* 忽略 */ }
    ensurePin()
    refit()
  }
  map.on('styledata', onReady)
  map.on('load', onReady)
})

onBeforeUnmount(() => { cancelAnimationFrame(pulseRaf); map?.remove(); map = null })
</script>

<template>
  <div class="sandbox" v-if="base">
    <template v-if="isYunlingshan">
      <div ref="container" class="sb-canvas"></div>

      <header class="sb-top">
        <button class="back" @click="router.push(`/base/${base.id}`)">‹ 返回{{ base.shortName }}详情</button>
        <div class="sb-title">
          <h1>{{ base.name }} · 真实场景沙盘</h1>
          <p>高德卫星影像 × SRTM 真实地形 · 点击金色节点查看设施与关联课程</p>
        </div>
        <button class="mode" @click="toggle3D">{{ is3D ? '切换 2D 俯视' : '切换 3D 地形' }}</button>
        <button class="mode" @click="refit">复位视角</button>
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

      <footer class="sb-foot">节点与路线为规划示意布点（待无人机激光雷达点云 + RGB 实测后升级为厘米级实景模型） · 影像 © 高德地图 · 地形 © NASA SRTM · MapLibre 实时渲染</footer>
    </template>

    <template v-else>
      <div class="sb-empty">
        <p>该基地暂未建设实景沙盘。</p>
        <button class="back" @click="router.push(`/base/${base.id}`)">‹ 返回{{ base.shortName }}详情</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sandbox { position: absolute; inset: 0; background: #0d1a12; }
.sb-canvas { position: absolute; inset: 0; }
.sb-empty { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 16px; align-items: center; justify-content: center; color: #cfe0d5; }
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
.mode { background: rgba(255,255,255,.14); color: #ffe9bd; border: 1px solid rgba(255,207,92,.4); border-radius: 8px; padding: 7px 12px; cursor: pointer; font-size: 12.5px; }
.mode:hover { background: rgba(255,207,92,.22); }
.sb-title { flex: 1; }
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
  text-align: center; font-size: 10.5px; color: rgba(255, 255, 255, .85);
  background: linear-gradient(0deg, rgba(13, 26, 18, .85), transparent);
  padding: 12px 8px 6px;
}
.fade-enter-active, .fade-leave-active { transition: all .25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(12px); }

@media (max-width: 768px) {
  .sb-panel, .sb-panel.wide { width: calc(100vw - 24px); right: 12px; top: auto; bottom: 40px; max-height: 56vh; }
  .sb-title h1 { font-size: 13.5px; }
}
</style>

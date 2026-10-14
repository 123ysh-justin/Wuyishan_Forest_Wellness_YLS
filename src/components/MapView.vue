<script setup lang="ts">
/**
 * 真实地理数据层：高德卫星影像（国内 CDN，快）+ AWS SRTM 地形
 * + 环带四区县（武夷山市/建阳区/邵武市/光泽县）真实行政边界
 * + 山峰/河流/乡镇/景区地名标注
 * + 基地节点（SVG 高级图钉 + 脉冲光晕，地形贴合固定）+ 交通枢纽点位（机场/动车站/公交站）
 *
 * 关键修正：基地改用 MapLibre SVG 符号图钉（随三维地形贴合，固定不漂浮），
 * 不再使用 HTML Marker，避免 3D 视角下点位漂浮、随缩放错位的问题。
 */
import { onMounted, onBeforeUnmount, ref } from 'vue'
import maplibregl from 'maplibre-gl'
import { IMAGERY_SOURCES, TERRAIN_SOURCES, ACTIVE_TERRAIN, ACTIVE_IMAGERY } from '../config/dataSources'
import { store, transportHubs, type Base } from '../data/store'
import { buildRegionMask, regionBounds } from '../utils/mask'
import beltGeo from '../data/belt_cities.json'
import placesGeo from '../data/wuyishan_places.json'

const props = withDefaults(defineProps<{
  center?: [number, number]
  zoom?: number
  pitch?: number
  bearing?: number
  showBases?: boolean
  showTransport?: boolean
  focusBaseId?: string
  interactive?: boolean
  /** 是否掩膜掉环带（四区县）以外区域 */
  maskOutside?: boolean
  /** 是否锁定平移范围在环带附近 */
  lockRegion?: boolean
  /** 加载完成后自动聚焦环带（首页总览用） */
  fitOnLoad?: boolean
}>(), {
  center: () => [117.78, 27.66],
  zoom: 8.8,
  pitch: 42,
  bearing: -10,
  showBases: true,
  showTransport: true,
  interactive: true,
  maskOutside: true,
  lockRegion: false,
  fitOnLoad: false
})

const emit = defineEmits<{
  (e: 'select-base', base: Base): void
  (e: 'select-hub', hub: any): void
  (e: 'ready', map: maplibregl.Map): void
}>()

const container = ref<HTMLDivElement | null>(null)
let map: maplibregl.Map | null = null
const is3D = ref(true)
const labelsOn = ref(true)
const terrainOn = ref(true)

const imagery = IMAGERY_SOURCES[ACTIVE_IMAGERY]
const terrainSrc = TERRAIN_SOURCES[ACTIVE_TERRAIN]

// —— 数据构造 ——
function basesFC(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: store.bases.map(b => ({
      type: 'Feature',
      properties: { id: b.id, name: b.shortName, color: b.coverColor, city: b.city },
      geometry: { type: 'Point', coordinates: b.coord }
    }))
  }
}
function transportFC(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: transportHubs.map(h => ({
      type: 'Feature',
      properties: { id: h.id, name: h.name, type: h.type, color: h.type === 'airport' ? '#e8c97e' : h.type === 'rail' ? '#6fb0c9' : '#c98ab0' },
      geometry: { type: 'Point', coordinates: h.coord }
    }))
  }
}

function buildStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    // 字形自托管于 public/fonts（构建后随站点发布，国内直连不挂起）；中文(CJK)由 localIdeographFontFamily 用系统字体本机渲染，不请求服务器
    glyphs: `${import.meta.env.BASE_URL}fonts/{fontstack}/{range}.pbf`,
    sources: {
      imagery: { type: 'raster', tiles: imagery.tiles, tileSize: 256, maxzoom: imagery.maxzoom, attribution: imagery.attribution },
      dem: { type: 'raster-dem', tiles: terrainSrc.tiles, tileSize: 256, maxzoom: 15, encoding: 'terrarium', attribution: terrainSrc.attribution },
      'dem-hs': { type: 'raster-dem', tiles: terrainSrc.tiles, tileSize: 256, maxzoom: 15, encoding: 'terrarium' },
      belt: { type: 'geojson', data: beltGeo as any },
      places: { type: 'geojson', data: placesGeo as any },
      mask: { type: 'geojson', data: buildRegionMask() as any },
      bases: { type: 'geojson', data: basesFC() as any },
      transport: { type: 'geojson', data: transportFC() as any }
    },
    layers: [
      { id: 'imagery', type: 'raster', source: 'imagery', paint: { 'raster-saturation': -0.08 } },
      { id: 'hillshade', type: 'hillshade', source: 'dem-hs', paint: { 'hillshade-exaggeration': 0.3, 'hillshade-shadow-color': '#16281c' } },
      // 环带（四区县）3D 加厚板块：边界纵向挤出，形成有厚度的立体边缘
      { id: 'belt-extrude', type: 'fill-extrusion', source: 'belt',
        paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': 7000, 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.22 } },
      // 环带（四区县）外掩膜
      { id: 'outside-mask', type: 'fill', source: 'mask',
        layout: { visibility: props.maskOutside ? 'visible' : 'none' },
        paint: { 'fill-color': '#0d1a12', 'fill-opacity': 0.85 } },
      // 四区县行政边界（按区县配色，金色描边光晕 + 实线）
      { id: 'belt-glow', type: 'line', source: 'belt',
        paint: { 'line-color': ['get', 'color'], 'line-width': 9, 'line-blur': 7, 'line-opacity': 0.35 } },
      { id: 'belt-line', type: 'line', source: 'belt',
        paint: { 'line-color': ['get', 'color'], 'line-width': 2.6, 'line-opacity': 0.95 } },
      { id: 'belt-label', type: 'symbol', source: 'belt',
        layout: { 'text-field': ['get', 'name'], 'text-size': 13.5, 'text-font': ['Noto Sans Regular'], 'text-letter-spacing': 0.4, 'text-offset': [0, 0.4], 'text-anchor': 'center' },
        paint: { 'text-color': '#fff', 'text-halo-color': '#1a2e22', 'text-halo-width': 2 } },
      // —— 地名标注 ——
      { id: 'place-peak', type: 'symbol', source: 'places', filter: ['==', ['get', 'kind'], 'peak'],
        layout: { 'text-field': ['concat', '▲ ', ['get', 'name']], 'text-size': 12.5, 'text-font': ['Noto Sans Regular'], 'text-anchor': 'bottom', 'text-allow-overlap': false },
        paint: { 'text-color': '#ffffff', 'text-halo-color': '#20402c', 'text-halo-width': 1.8 } },
      { id: 'place-river', type: 'symbol', source: 'places', filter: ['==', ['get', 'kind'], 'river'],
        layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-font': ['Noto Sans Regular'], 'text-letter-spacing': 0.5 },
        paint: { 'text-color': '#9fd4f0', 'text-halo-color': '#12303f', 'text-halo-width': 1.6 } },
      { id: 'place-park', type: 'symbol', source: 'places', filter: ['in', ['get', 'kind'], ['literal', ['park', 'scenic']]],
        layout: { 'text-field': ['get', 'name'], 'text-size': 12.5, 'text-font': ['Noto Sans Regular'], 'text-letter-spacing': 0.2 },
        paint: { 'text-color': '#b9e6c5', 'text-halo-color': '#16301f', 'text-halo-width': 1.8 } },
      { id: 'place-town', type: 'symbol', source: 'places', filter: ['==', ['get', 'kind'], 'town'],
        layout: { 'text-field': ['get', 'name'], 'text-size': 11.5, 'text-font': ['Noto Sans Regular'], 'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.5 },
        paint: { 'text-color': '#f2ead6', 'text-halo-color': '#2a2416', 'text-halo-width': 1.5 } },
      // —— 交通枢纽点位（机场/动车站/公交站，示意）——
      { id: 'transport-dot', type: 'circle', source: 'transport',
        layout: { visibility: props.showTransport ? 'visible' : 'none' },
        paint: { 'circle-radius': ['match', ['get', 'type'], 'airport', 7, 'rail', 6, 5], 'circle-color': ['get', 'color'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff', 'circle-opacity': 0.95 } },
      { id: 'transport-label', type: 'symbol', source: 'transport',
        layout: { visibility: props.showTransport ? 'visible' : 'none', 'text-field': ['get', 'name'], 'text-size': 10.5, 'text-font': ['Noto Sans Regular'], 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false },
        paint: { 'text-color': '#eaf2ec', 'text-halo-color': '#10211a', 'text-halo-width': 1.6 } },
      // —— 基地节点：base-glow 脉冲光晕（静态）；base-pin 图钉在地图加载后动态 addImage + addLayer ——
      { id: 'base-glow', type: 'circle', source: 'bases',
        layout: { visibility: props.showBases ? 'visible' : 'none' },
        paint: { 'circle-radius': 14, 'circle-color': '#ffcf5c', 'circle-opacity': 0.35, 'circle-blur': 0.7 } },
      { id: 'base-label', type: 'symbol', source: 'bases',
        layout: { visibility: props.showBases ? 'visible' : 'none', 'text-field': ['get', 'name'], 'text-size': 12, 'text-font': ['Noto Sans Regular'], 'text-anchor': 'bottom', 'text-offset': [0, -3.0] },
        paint: { 'text-color': '#fff', 'text-halo-color': '#10211a', 'text-halo-width': 2 } }
    ]
  }
}

function applyTerrain() {
  if (!map) return
  if (terrainOn.value && is3D.value) map.setTerrain({ source: 'dem', exaggeration: 1.35 })
  else map.setTerrain(null)
}

// —— 基地脉冲动画（圆形图层，所有基地同步呼吸）——
let pulseRaf = 0
function pulse() {
  if (!map || !map.getLayer('base-glow')) return
  const t = (performance.now() % 2200) / 2200
  const radius = 10 + t * 16
  const op = 0.5 * (1 - t)
  map.setPaintProperty('base-glow', 'circle-radius', radius)
  map.setPaintProperty('base-glow', 'circle-opacity', op)
  pulseRaf = requestAnimationFrame(pulse)
}

function flyTo(coord: [number, number], zoom = 11.5) {
  map?.flyTo({ center: coord, zoom, pitch: is3D.value ? 55 : 0, duration: 1800 })
}

function resetView() { fitRegion() }

/** 视野聚焦到环带（四区县并集） */
function fitRegion() {
  const [w, s, e, n] = regionBounds()
  map?.fitBounds([[w, s], [e, n]], {
    padding: { top: 70, bottom: 70, left: 70, right: 70 },
    pitch: props.pitch,
    bearing: props.bearing,
    duration: 1600
  })
}

/** 用 Canvas 绘制基地图钉（金色渐变 + 白边 + 投影），转 ImageData 后 addImage（MapLibre 对裸 canvas 的 addImage 有尺寸校验坑） */
function drawPinImage() {
  if (!map || map.hasImage('base-pin')) return
  const s = 2, w = 44, h = 56
  const c = document.createElement('canvas')
  c.width = w * s; c.height = h * s
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.scale(s, s)
  // 主体填充（带投影）
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
  // 白色描边
  ctx.lineWidth = 2.6; ctx.strokeStyle = '#ffffff'; ctx.stroke()
  // 内环（深色 + 白点）
  ctx.beginPath(); ctx.arc(22, 21, 8, 0, Math.PI * 2); ctx.fillStyle = 'rgba(22,48,31,0.5)'; ctx.fill()
  ctx.beginPath(); ctx.arc(22, 21, 4.2, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill()
  try {
    const imgData = ctx.getImageData(0, 0, c.width, c.height)
    map.addImage('base-pin', imgData, { pixelRatio: s })
  } catch { /* 精灵图未就绪，由 ensurePin 在下帧重试 */ }
}
/** 等待精灵图就绪后再注册图钉：addImage 在 map load 过早调用会静默失败，故用 rAF 重试 */
function ensurePin() {
  if (!map) return
  try { drawPinImage() } catch { /* 忽略 */ }
  if (map.hasImage('base-pin')) {
    if (!map.getLayer('base-pin')) {
      map.addLayer({
        id: 'base-pin', type: 'symbol', source: 'bases',
        layout: { visibility: props.showBases ? 'visible' : 'none', 'icon-image': 'base-pin', 'icon-size': 0.52, 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true },
        paint: {}
      }, 'base-label')
    }
    bindClicks()
    pulse()
  } else {
    requestAnimationFrame(ensurePin)
  }
}

function toggle3D() {
  is3D.value = !is3D.value
  applyTerrain()
  map?.easeTo({ pitch: is3D.value ? 55 : 0, duration: 700 })
}
function toggleLabels() {
  labelsOn.value = !labelsOn.value
  const v = labelsOn.value ? 'visible' : 'none'
  for (const id of ['belt-label', 'place-peak', 'place-river', 'place-park', 'place-town', 'transport-label', 'base-label']) {
    if (map?.getLayer(id)) map.setLayoutProperty(id, 'visibility', v)
  }
}
function toggleTransport() {
  const v = (map?.getLayer('transport-dot')?.getLayoutProperty('visibility') as string) === 'visible' ? 'none' : 'visible'
  for (const id of ['transport-dot', 'transport-label']) {
    if (map?.getLayer(id)) map.setLayoutProperty(id, 'visibility', v)
  }
}

function bindClicks() {
  if (!map) return
  const baseLayers = ['base-pin', 'base-glow', 'base-label']
  for (const id of baseLayers) {
    map.on('click', id, (ev) => {
      const fid = (ev as any).features?.[0]?.properties?.id
      const b = store.bases.find(x => x.id === fid)
      if (b) emit('select-base', b)
    })
  }
  map.on('mouseenter', 'base-pin', () => { if (map) map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'base-pin', () => { if (map) map.getCanvas().style.cursor = '' })
  map.on('click', 'transport-dot', (ev) => {
    const fid = (ev as any).features?.[0]?.properties?.id
    const h = transportHubs.find(x => x.id === fid)
    if (h) emit('select-hub', h)
  })
}

onMounted(() => {
  const bounds = regionBounds()
  const pad = 0.25
  map = new maplibregl.Map({
    container: container.value!,
    style: buildStyle(),
    center: props.center,
    zoom: props.zoom,
    pitch: props.pitch,
    bearing: props.bearing,
    maxPitch: 75,
    attributionControl: { compact: true },
    interactive: props.interactive,
    localIdeographFontFamily: 'sans-serif',
    maxBounds: props.lockRegion
      ? [[bounds[0] - pad, bounds[1] - pad], [bounds[2] + pad, bounds[3] + pad]]
      : undefined
  })
  if (props.interactive) {
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
  }
  // 图钉注册不单依赖 load 事件：字体源偶发挂起会导致 load 不触发，
  // 故加 styledata 兜底；ensurePin 内部以 hasImage 判重，重复调用无害
  // 图钉/地形/初始视角不单依赖 load 事件：字体源偶发挂起会使 load 不触发，
  // 故用 styledata 兜底；readyDone 守卫保证整套初始化只执行一次
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
    if (props.fitOnLoad) fitRegion()
    emit('ready', map!)
  }
  map.on('styledata', onReady)
  map.on('load', onReady)

  // 仅开发环境暴露调试句柄，便于自动化测试断言路线/地形状态（生产构建被剔除）
  if (import.meta.env.DEV) {
    (window as any).__mapDebug = {
      fitRegion, flyTo,
      map
    }
  }
})

onBeforeUnmount(() => { cancelAnimationFrame(pulseRaf); map?.remove(); map = null })

defineExpose({ flyTo, resetView, fitRegion, toggle3D, toggleLabels, toggleTransport, is3D, labelsOn })
</script>

<template>
  <div class="map-view">
    <div ref="container" class="map-canvas"></div>
  </div>
</template>

<style>
.map-view { position: absolute; inset: 0; }
.map-canvas { position: absolute; inset: 0; }
</style>

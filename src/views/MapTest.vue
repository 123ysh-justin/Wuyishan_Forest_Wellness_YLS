<script setup lang="ts">
/**
 * 阶段 A 验证页面：真实 Sentinel-2 影像 + 真实 SRTM DEM 三维地形
 * 验收点：定位武夷山 / 显示真实遥感影像 / 真实 DEM 起伏 / 可旋转倾斜缩放 /
 *        显示数据源 / 无严重错位 / 记录加载日志
 */
import { onMounted, onBeforeUnmount, ref, reactive } from 'vue'
import maplibregl from 'maplibre-gl'
import {
  IMAGERY_SOURCES,
  TERRAIN_SOURCES,
  ACTIVE_TERRAIN,
  WUYISHAN_VIEW
} from '../config/dataSources'

const mapContainer = ref<HTMLDivElement | null>(null)
let map: maplibregl.Map | null = null

const imagery = IMAGERY_SOURCES.eoxS2_2024
const terrainSrc = TERRAIN_SOURCES[ACTIVE_TERRAIN]

const state = reactive({
  loaded: false,
  is3D: true,
  exaggeration: 1.4,
  imageryTiles: 0,
  demTiles: 0,
  errors: [] as string[],
  center: WUYISHAN_VIEW.center,
  zoom: WUYISHAN_VIEW.zoom
})

const logs = ref<string[]>([])

function log(msg: string) {
  const line = `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${msg}`
  logs.value.push(line)
  // 暴露给自动化测试
  ;(window as any).__MAP_TEST__ = {
    logs: logs.value,
    errors: state.errors,
    get imageryTiles() { return state.imageryTiles },
    get demTiles() { return state.demTiles },
    get loaded() { return state.loaded }
  }
}

function buildStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      imagery: {
        type: 'raster',
        tiles: imagery.tiles,
        tileSize: imagery.tileSize,
        maxzoom: imagery.maxzoom,
        attribution: imagery.attribution
      },
      dem: {
        type: 'raster-dem',
        tiles: terrainSrc.tiles,
        tileSize: terrainSrc.tileSize,
        maxzoom: terrainSrc.maxzoom,
        encoding: terrainSrc.encoding,
        attribution: terrainSrc.attribution
      },
      // 山体阴影单独使用同名源实例（MapLibre 建议 terrain 与 hillshade 分离）
      'dem-hillshade': {
        type: 'raster-dem',
        tiles: terrainSrc.tiles,
        tileSize: terrainSrc.tileSize,
        maxzoom: terrainSrc.maxzoom,
        encoding: terrainSrc.encoding
      }
    },
    layers: [
      {
        id: 'imagery',
        type: 'raster',
        source: 'imagery',
        paint: { 'raster-saturation': -0.1 }
      },
      {
        id: 'hillshade',
        type: 'hillshade',
        source: 'dem-hillshade',
        paint: {
          'hillshade-exaggeration': 0.35,
          'hillshade-shadow-color': '#1a2f1a'
        }
      }
    ]
  }
}

function applyTerrain() {
  if (!map) return
  if (state.is3D) {
    map.setTerrain({ source: 'dem', exaggeration: state.exaggeration })
    map.easeTo({ pitch: 60, duration: 800 })
  } else {
    map.setTerrain(null)
    map.easeTo({ pitch: 0, bearing: 0, duration: 800 })
  }
}

function toggle3D() {
  state.is3D = !state.is3D
  applyTerrain()
  log(state.is3D ? '切换到三维地形模式' : '切换到二维模式')
}

function resetView() {
  map?.flyTo({ ...WUYISHAN_VIEW, duration: 1500 })
  log('重置视角到武夷山核心区')
}

function onExaggerationInput(e: Event) {
  state.exaggeration = Number((e.target as HTMLInputElement).value)
  if (state.is3D) map?.setTerrain({ source: 'dem', exaggeration: state.exaggeration })
}

onMounted(() => {
  log('初始化 MapLibre，定位武夷山核心区 (117.72°E, 27.72°N)')
  map = new maplibregl.Map({
    container: mapContainer.value!,
    style: buildStyle(),
    center: WUYISHAN_VIEW.center,
    zoom: WUYISHAN_VIEW.zoom,
    pitch: WUYISHAN_VIEW.pitch,
    bearing: WUYISHAN_VIEW.bearing,
    maxPitch: 80,
    hash: false,
    attributionControl: { compact: true }
  })

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
  map.addControl(new maplibregl.FullscreenControl(), 'bottom-right')
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')

  map.on('load', () => {
    state.loaded = true
    log('地图样式加载完成，应用三维地形 (exaggeration=1.4)')
    map!.setTerrain({ source: 'dem', exaggeration: state.exaggeration })
    // 天空/大气效果（MapLibre v4+，不支持时静默跳过）
    try {
      ;(map as any).setSky?.({
        'sky-color': '#8fb8d8',
        'horizon-color': '#dcebf4',
        'fog-color': '#e8f0f5',
        'sky-horizon-blend': 0.6,
        'horizon-fog-blend': 0.6,
        'fog-ground-blend': 0.4
      })
    } catch { /* 忽略 */ }
  })

  // 统计真实瓦片加载（按瓦片唯一 ID 去重）
  const seenImagery = new Set<string>()
  const seenDem = new Set<string>()
  map.on('data', (e: any) => {
    if (e.dataType !== 'source' || !e.tile) return
    const key = e.tile.tileID?.key
    if (key == null) return
    if (e.sourceId === 'imagery') {
      seenImagery.add(key)
      state.imageryTiles = seenImagery.size
    } else if (e.sourceId === 'dem' || e.sourceId === 'dem-hillshade') {
      seenDem.add(key)
      state.demTiles = seenDem.size
    }
  })

  map.on('error', (e: any) => {
    const msg = `地图错误: ${e?.error?.message || e?.message || '未知'}`
    state.errors.push(msg)
    log(msg)
  })

  map.on('moveend', () => {
    const c = map!.getCenter()
    state.center = [Number(c.lng.toFixed(4)), Number(c.lat.toFixed(4))]
    state.zoom = Number(map!.getZoom().toFixed(2))
  })
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div class="map-test">
    <div ref="mapContainer" class="map-container"></div>

    <!-- 验证信息面板 -->
    <aside class="panel">
      <h1>地图数据源验证 · 阶段 A</h1>
      <p class="subtitle">环武夷山森林康养平台 — 真实影像 + 真实 DEM</p>

      <section class="block">
        <h2>影像数据源</h2>
        <p>{{ imagery.name }}</p>
        <p class="attr">{{ imagery.attribution }}</p>
      </section>

      <section class="block">
        <h2>高程数据源</h2>
        <p>{{ terrainSrc.name }}</p>
        <p class="attr">{{ terrainSrc.attribution }}</p>
      </section>

      <section class="block status">
        <h2>加载状态</h2>
        <div class="row"><span>地图样式</span><b :class="{ ok: state.loaded }">{{ state.loaded ? '已加载' : '加载中…' }}</b></div>
        <div class="row"><span>影像瓦片请求</span><b :class="{ ok: state.imageryTiles > 0 }">{{ state.imageryTiles }}</b></div>
        <div class="row"><span>DEM 瓦片请求</span><b :class="{ ok: state.demTiles > 0 }">{{ state.demTiles }}</b></div>
        <div class="row"><span>当前中心</span><b>{{ state.center[0] }}°E, {{ state.center[1] }}°N</b></div>
        <div class="row"><span>缩放级别</span><b>{{ state.zoom }}</b></div>
        <div class="row"><span>加载错误</span><b :class="{ err: state.errors.length > 0 }">{{ state.errors.length }}</b></div>
      </section>

      <section class="block controls">
        <button @click="toggle3D">{{ state.is3D ? '切换二维' : '切换三维' }}</button>
        <button @click="resetView">重置视角</button>
        <label class="slider">
          地形夸张 {{ state.exaggeration.toFixed(1) }}×
          <input type="range" min="0.5" max="3" step="0.1" :value="state.exaggeration" @input="onExaggerationInput" />
        </label>
      </section>

      <section class="block log-block">
        <h2>加载日志</h2>
        <div class="logs">
          <div v-for="(l, i) in logs" :key="i" class="log-line">{{ l }}</div>
        </div>
      </section>
    </aside>
  </div>
</template>

<style scoped>
.map-test {
  position: relative;
  width: 100%;
  height: 100%;
}
.map-container {
  position: absolute;
  inset: 0;
}
.panel {
  position: absolute;
  top: 16px;
  left: 16px;
  width: 340px;
  max-height: calc(100% - 32px);
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
  font-size: 13px;
  color: #2d3a2e;
}
h1 {
  font-size: 16px;
  color: #1e4633;
}
.subtitle {
  color: #6b7d6e;
  margin: 4px 0 12px;
  font-size: 12px;
}
.block {
  border-top: 1px solid #e2e8e2;
  padding: 10px 0;
}
.block h2 {
  font-size: 13px;
  color: #37654a;
  margin-bottom: 4px;
}
.attr {
  color: #8a9a8d;
  font-size: 11px;
  margin-top: 2px;
}
.row {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}
.row b {
  font-weight: 600;
  color: #888;
}
.row b.ok {
  color: #2e7d4f;
}
.row b.err {
  color: #c0392b;
}
.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
button {
  background: #2e6b4a;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 13px;
  cursor: pointer;
}
button:hover {
  background: #255a3d;
}
.slider {
  width: 100%;
  font-size: 12px;
  color: #6b7d6e;
}
.slider input {
  width: 100%;
}
.logs {
  max-height: 140px;
  overflow-y: auto;
  background: #f4f7f4;
  border-radius: 6px;
  padding: 6px 8px;
  font-family: Consolas, monospace;
  font-size: 11px;
  color: #4a5a4d;
}
.log-line {
  padding: 1px 0;
  border-bottom: 1px dashed #e0e8e0;
}
@media (max-width: 640px) {
  .panel {
    width: calc(100% - 32px);
    max-height: 55%;
    top: auto;
    bottom: 16px;
  }
}
</style>

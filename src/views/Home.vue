<script setup lang="ts">
/**
 * 首页：环武夷山森林康养数字化展示驾驶舱（V3 重构）
 * 左侧——课程体系（森林康养 / 自然教育 两大类，统计 + 图片 + 点击进详情）
 * 右侧——武夷山实时气象 + 森林康养基地列表（单击基地定位地图）
 * 底部中央——科技感数据看板（动态计数 + 扫描光带）
 * 顶部——标题 / 实时时钟
 * 已移除：自动旋转、区域总览、自动演示、地名标注开关、平台更新记录、基地分布、数据源验证
 */
import { computed, onMounted, onBeforeUnmount, ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import MapView from '../components/MapView.vue'
import WeatherWidget from '../components/WeatherWidget.vue'
import CockpitChart from '../components/CockpitChart.vue'
import { store, stats, nearestHubs, type Base } from '../data/store'

const router = useRouter()
const mapRef = ref<InstanceType<typeof MapView> | null>(null)
const leftOpen = ref(true)
const rightOpen = ref(true)
const activeBaseId = ref<string>('')
const clock = ref('')
let clockTimer: ReturnType<typeof setInterval> | null = null

const s = computed(() => stats())

// —— 实时时钟 ——
function tickClock() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  clock.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
onMounted(() => { tickClock(); clockTimer = setInterval(tickClock, 1000) })
onBeforeUnmount(() => { if (clockTimer) clearInterval(clockTimer) })

// —— 课程体系分组 ——
const healthCourses = computed(() => store.courses.filter(c => c.category === '森林康养'))
const eduCourses = computed(() => store.courses.filter(c => c.category === '自然教育'))
const pieOption = computed(() => ({
  tooltip: { trigger: 'item' as const },
  series: [{
    type: 'pie' as const, radius: ['52%', '78%'], center: ['50%', '50%'],
    label: { show: false }, labelLine: { show: false },
    itemStyle: { borderColor: '#14231a', borderWidth: 3 },
    data: [
      { value: healthCourses.value.length, name: '森林康养', itemStyle: { color: '#3fae6a' } },
      { value: eduCourses.value.length, name: '自然教育', itemStyle: { color: '#c9a86a' } }
    ]
  }]
}))

// —— 基地交通信息 ——
function baseTransport(b: Base) {
  const nh = nearestHubs(b.coord)
  return {
    airport: nh.airport ? `${nh.airport.hub.name} 约 ${nh.airport.km.toFixed(0)} km` : '—',
    rail: nh.rail ? `${nh.rail.hub.name} 约 ${nh.rail.km.toFixed(0)} km` : '—',
    bus: b.bus ?? '—'
  }
}

// —— 底部数据看板 KPI（动态计数）——
interface Kpi { key: string; label: string; target: number; unit: string; decimals?: number }
const kpis: Kpi[] = [
  { key: 'area', label: '环带规划面积', target: 4252, unit: 'km²' },
  { key: 'city', label: '涉及区县', target: 4, unit: '个' },
  { key: 'base', label: '康养基地', target: s.value.baseCount, unit: '个' },
  { key: 'course', label: '示范课程', target: s.value.courseCount, unit: '门' },
  { key: 'poi', label: '设施节点', target: s.value.poiCount, unit: '个' },
  { key: 'park', label: '国家公园面积', target: 1280, unit: 'km²' }
]
const animVals = reactive<Record<string, number>>({})
kpis.forEach(k => (animVals[k.key] = 0))
function countUp() {
  const t0 = performance.now()
  const dur = 1500
  const tick = (t: number) => {
    const p = Math.min((t - t0) / dur, 1)
    const e = 1 - Math.pow(1 - p, 3)
    for (const k of kpis) animVals[k.key] = Math.round(k.target * e)
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
onMounted(() => setTimeout(countUp, 400))

// —— 交互 ——
function selectBase(b: Base) {
  activeBaseId.value = b.id
  mapRef.value?.flyTo(b.coord, 11.6)
}
function enterBase(b: Base) { router.push(`/base/${b.id}`) }
function overview() { activeBaseId.value = ''; mapRef.value?.fitRegion() }
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen?.()
}
</script>

<template>
  <div class="cockpit">
    <MapView ref="mapRef" :lock-region="true" :fit-on-load="true" @select-base="selectBase" />

    <!-- 顶部标题栏 -->
    <header class="top-bar glass">
      <div class="tb-left">
        <div class="logo">森</div>
        <div class="tb-title">
          <h1>环武夷山森林康养数字化交互展示与智慧管理平台</h1>
          <p>Sentinel-2 真实影像 · SRTM 真实地形 · 环武夷山国家公园保护发展带（武夷山 / 建阳 / 邵武 / 光泽）</p>
        </div>
      </div>
      <div class="tb-right">
        <span class="tb-live"></span>
        <span class="tb-clock">{{ clock }}</span>
      </div>
      <div class="scan-line"></div>
    </header>

    <!-- 左侧：课程体系 -->
    <aside class="side-panel left glass" :class="{ collapsed: !leftOpen }">
      <div class="sp-head">
        <span class="sp-title">课程体系</span>
        <button class="sp-fold" @click="leftOpen = false" title="收起">‹</button>
      </div>
      <div class="sp-body">
        <section class="sec course-overview">
          <div class="co-pie"><CockpitChart :option="pieOption" height="120px" /></div>
          <div class="co-legend">
            <div class="co-item"><span class="dot g"></span>森林康养 <b>{{ healthCourses.length }}</b> 门</div>
            <div class="co-item"><span class="dot y"></span>自然教育 <b>{{ eduCourses.length }}</b> 门</div>
          </div>
        </section>

        <div v-for="grp in [{ name: '森林康养', list: healthCourses }, { name: '自然教育', list: eduCourses }]" :key="grp.name" class="course-group">
          <h3 class="grp-title" :class="grp.name === '森林康养' ? 'g' : 'y'">{{ grp.name }}</h3>
          <div
            v-for="c in grp.list" :key="c.id"
            class="course-card" @click="router.push(`/course/${c.id}`)"
          >
            <img class="cc-img" :src="`./images/${c.id}.png`" :alt="c.title" loading="lazy" />
            <div class="cc-info">
              <b>{{ c.title }}</b>
              <div class="cc-bases">
                <span v-for="bid in (c.suitableBases || [c.baseId])" :key="bid" class="cb">{{ store.bases.find(b => b.id === bid)?.shortName }}</span>
              </div>
              <p>{{ c.duration }} · {{ c.audience.split('、')[0] }}</p>
            </div>
          </div>
        </div>
        <p class="sp-hint">课程为示范方案 · 点击查看完整图文</p>
      </div>
    </aside>
    <button v-if="!leftOpen" class="edge-open left glass" @click="leftOpen = true">›</button>

    <!-- 右侧：武夷山实时气象 + 森林康养基地列表 -->
    <aside class="side-panel right glass" :class="{ collapsed: !rightOpen }">
      <div class="sp-head">
        <button class="sp-fold" @click="rightOpen = false" title="收起">›</button>
      </div>
      <div class="sp-body">
        <WeatherWidget />
        <h4 class="list-title">森林康养基地列表</h4>
        <div
          v-for="b in store.bases" :key="b.id"
          class="base-card" :class="{ on: activeBaseId === b.id }"
          @click="selectBase(b)"
        >
          <img class="bc-img" :src="`./images/base-${b.id}.png`" :alt="b.shortName" loading="lazy" />
          <div class="bc-info">
            <div class="bc-name">{{ b.name }}</div>
            <div class="bc-meta">{{ b.city }} · {{ b.type.split('（')[0] }}</div>
            <div class="bc-trans">
              <div>✈ {{ baseTransport(b).airport }}</div>
              <div>🚄 {{ baseTransport(b).rail }}</div>
              <div>🚌 {{ baseTransport(b).bus }}</div>
            </div>
          </div>
          <button class="bc-enter" @click.stop="enterBase(b)">详情 ›</button>
        </div>
        <p class="sp-hint">单击基地在地图定位 · 点击「详情」进入基地页</p>
      </div>
    </aside>
    <button v-if="!rightOpen" class="edge-open right glass" @click="rightOpen = true">‹</button>

    <!-- 底部中央：科技感数据看板 -->
    <footer class="hud glass">
      <div class="hud-scan"></div>
      <div v-for="k in kpis" :key="k.key" class="hud-kpi">
        <div class="hk-num">{{ animVals[k.key] }}<span class="hk-unit">{{ k.unit }}</span></div>
        <div class="hk-label">{{ k.label }}</div>
      </div>
    </footer>

    <!-- 底部控制条 -->
    <div class="ctrl-bar glass">
      <button class="fn" @click="mapRef?.toggle3D()"><i>◆</i>{{ mapRef?.is3D ? '切换二维' : '切换三维' }}</button>
      <button class="fn" @click="toggleFullscreen"><i>⛶</i>全屏</button>
      <button class="fn" @click="overview"><i>↺</i>重置视角</button>
    </div>

    <div class="foot-note">
      影像 © EOX Sentinel-2 cloudless 2024（ESA Copernicus）· 地形 © AWS Open Data（SRTM）· 边界：环带四区县行政区划
    </div>
  </div>
</template>

<style scoped>
.cockpit { position: fixed; inset: 0; overflow: hidden; background: #0d1a12; }
.glass {
  background: rgba(13, 26, 18, .74);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(233, 241, 234, .1);
  box-shadow: 0 4px 28px rgba(0, 0, 0, .4);
}

/* —— 顶部 —— */
.top-bar {
  position: absolute; top: 10px; left: 10px; right: 10px; z-index: 20;
  display: flex; align-items: center; gap: 18px;
  padding: 8px 16px; border-radius: 12px; overflow: hidden;
}
.tb-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.logo {
  width: 38px; height: 38px; border-radius: 10px; flex: none;
  background: linear-gradient(135deg, #2e6b4a, #3fae6a);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; font-weight: 700; color: #fff;
  box-shadow: 0 0 16px rgba(63, 174, 106, .5);
}
.tb-title h1 { margin: 0; font-size: 16px; font-weight: 600; color: #f0f6f1; letter-spacing: 1px; white-space: nowrap; }
.tb-title p { margin: 1px 0 0; font-size: 10px; color: rgba(220, 232, 222, .5); white-space: nowrap; }
.tb-right { margin-left: auto; flex: none; display: flex; align-items: center; gap: 8px; }
.tb-clock { font-size: 13px; color: rgba(220, 232, 222, .8); font-variant-numeric: tabular-nums; letter-spacing: .5px; }
.tb-live { width: 8px; height: 8px; border-radius: 50%; background: #3fae6a; box-shadow: 0 0 0 0 rgba(63, 174, 106, .6); animation: live-blink 2s infinite; }
@keyframes live-blink { 0% { box-shadow: 0 0 0 0 rgba(63,174,106,.55); } 70% { box-shadow: 0 0 0 7px rgba(63,174,106,0); } 100% { box-shadow: 0 0 0 0 rgba(63,174,106,0); } }
.scan-line {
  position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(111,211,154,.9), transparent);
  background-size: 40% 100%; background-repeat: no-repeat;
  animation: bar-scan 5s ease-in-out infinite alternate;
}
@keyframes bar-scan { 0% { background-position: -20% 0; } 100% { background-position: 120% 0; } }

/* —— 侧栏 —— */
.side-panel {
  position: absolute; top: 74px; bottom: 150px; z-index: 15;
  width: 320px; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden;
  transition: transform .25s ease;
}
.side-panel.left { left: 10px; bottom: 90px; }
.side-panel.right { right: 10px; width: 312px; }
.side-panel.left.collapsed { transform: translateX(-110%); }
.side-panel.right.collapsed { transform: translateX(110%); }
.sp-head {
  display: flex; align-items: center; gap: 4px; padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, .07);
}
.sp-title {
  font-size: 13.5px; font-weight: 600; color: #9fd4b4; letter-spacing: 1px; flex: 1;
  background: linear-gradient(90deg, #9fd4b4 30%, #e6f7ec 50%, #9fd4b4 70%);
  background-size: 200% 100%; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  animation: title-shine 5s linear infinite;
}
@keyframes title-shine { 0% { background-position: 120% 0; } 100% { background-position: -120% 0; } }
.sp-fold { border: none; background: transparent; color: rgba(220,232,222,.55); font-size: 15px; cursor: pointer; padding: 0 4px; }
.sp-body { flex: 1; overflow-y: auto; padding: 12px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.15) transparent; }
.sp-hint { font-size: 10.5px; color: rgba(220,232,222,.4); text-align: center; margin: 10px 0 0; }

.sec { margin-bottom: 12px; }

/* 课程概览 */
.course-overview { display: flex; align-items: center; gap: 8px; }
.co-pie { width: 120px; flex: none; }
.co-legend { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.co-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: rgba(220,232,222,.75); }
.co-item b { color: #c9a86a; font-size: 15px; margin-left: auto; }
.dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.dot.g { background: #3fae6a; } .dot.y { background: #c9a86a; }

.course-group { margin-top: 6px; }
.grp-title { margin: 12px 0 8px; font-size: 12.5px; font-weight: 600; letter-spacing: 1px; padding-left: 8px; border-left: 3px solid; }
.grp-title.g { color: #6fd39a; border-color: #3fae6a; }
.grp-title.y { color: #e6c98a; border-color: #c9a86a; }
.course-card {
  display: flex; gap: 9px; align-items: center; padding: 7px; border-radius: 10px;
  background: rgba(255, 255, 255, .045); border: 1px solid rgba(255, 255, 255, .06);
  margin-bottom: 7px; cursor: pointer; transition: all .2s;
}
.course-card:hover { background: rgba(63, 174, 106, .14); border-color: rgba(63, 174, 106, .35); transform: translateX(3px); }
.cc-img { width: 60px; height: 44px; object-fit: cover; border-radius: 7px; flex: none; }
.cc-info { flex: 1; min-width: 0; }
.cc-info b { font-size: 12.5px; color: #eaf2ec; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cc-info p { font-size: 10.5px; color: rgba(220, 232, 222, .5); margin: 3px 0 0; }
.cc-bases { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.cb { font-size: 9px; padding: 1px 6px; border-radius: 7px; background: rgba(63,174,106,.18); color: #6fd39a; }

/* 基地卡片（右侧） */
.list-title { font-size: 12.5px; font-weight: 600; color: #9fd4b4; letter-spacing: 1px; margin: 8px 0 8px; padding-left: 2px; }
.base-card {
  position: relative; display: flex; gap: 10px; align-items: center; padding: 8px;
  border-radius: 10px; background: rgba(255, 255, 255, .045);
  border: 1px solid rgba(255, 255, 255, .06); margin-bottom: 8px; cursor: pointer; transition: all .2s;
}
.base-card:hover { background: rgba(63, 174, 106, .12); border-color: rgba(63, 174, 106, .3); }
.base-card.on { background: rgba(63, 174, 106, .18); border-color: #3fae6a; box-shadow: 0 0 14px rgba(63,174,106,.3); }
.bc-img { width: 72px; height: 52px; object-fit: cover; border-radius: 7px; flex: none; }
.bc-info { flex: 1; min-width: 0; }
.bc-name { font-size: 12.5px; font-weight: 600; color: #eaf2ec; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bc-meta { font-size: 10px; color: rgba(220, 232, 222, .5); margin: 2px 0 4px; }
.bc-trans { font-size: 10px; color: rgba(220, 232, 222, .7); line-height: 1.55; }
.bc-enter {
  position: absolute; right: 8px; bottom: 8px; padding: 4px 9px; border-radius: 7px;
  border: 1px solid rgba(63, 174, 106, .4); background: rgba(63, 174, 106, .12);
  color: #6fd39a; font-size: 11px; cursor: pointer;
}
.bc-enter:hover { background: rgba(63, 174, 106, .28); }

.edge-open {
  position: absolute; top: 50%; z-index: 16; transform: translateY(-50%);
  width: 26px; height: 56px; border-radius: 8px; border: 1px solid rgba(233,241,234,.1);
  color: #6fd39a; font-size: 16px; cursor: pointer;
}
.edge-open.left { left: 10px; } .edge-open.right { right: 10px; }

/* —— 底部数据看板 —— */
.hud {
  position: absolute; bottom: 64px; left: 50%; transform: translateX(-50%); z-index: 18;
  display: flex; gap: 0; padding: 0; border-radius: 14px; overflow: hidden;
}
.hud-scan {
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent, rgba(111,211,154,.95), transparent);
  background-size: 50% 100%; background-repeat: no-repeat;
  animation: hud-scan 4s linear infinite;
}
@keyframes hud-scan { 0% { background-position: -50% 0; } 100% { background-position: 150% 0; } }
.hud-kpi {
  min-width: 118px; padding: 12px 18px; text-align: center; position: relative;
  border-right: 1px solid rgba(255, 255, 255, .07);
}
.hud-kpi:last-child { border-right: none; }
.hk-num {
  font-size: 26px; font-weight: 700; color: #c9a86a; font-variant-numeric: tabular-nums;
  font-family: 'DIN', 'Bahnschrift', ui-monospace, monospace; line-height: 1.1;
  text-shadow: 0 0 14px rgba(201, 168, 106, .4);
}
.hk-unit { font-size: 12px; color: rgba(201, 168, 106, .8); margin-left: 2px; }
.hk-label { font-size: 11px; color: rgba(220, 232, 222, .6); margin-top: 4px; letter-spacing: .5px; }

/* —— 控制条 —— */
.ctrl-bar {
  position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 20;
  display: flex; gap: 4px; padding: 6px 10px; border-radius: 12px;
}
.fn {
  display: flex; align-items: center; gap: 6px; padding: 7px 13px;
  border: none; border-radius: 8px; background: transparent;
  color: rgba(220, 232, 222, .78); font-size: 12.5px; cursor: pointer; transition: all .2s;
}
.fn i { font-style: normal; font-size: 13px; color: #6fd39a; }
.fn:hover { background: rgba(255, 255, 255, .09); color: #fff; }

.foot-note {
  position: absolute; bottom: 12px; right: 12px; z-index: 10;
  font-size: 9.5px; color: rgba(255, 255, 255, .45); text-shadow: 0 1px 3px rgba(0, 0, 0, .6);
  max-width: 380px; text-align: right; pointer-events: none;
}

@media (max-width: 980px) {
  .side-panel { width: 270px; }
  .side-panel.left { bottom: 150px; }
  .hud { flex-wrap: wrap; max-width: calc(100vw - 20px); justify-content: center; }
  .hud-kpi { min-width: 92px; padding: 8px 10px; }
  .hk-num { font-size: 20px; }
}
@media (max-width: 720px) {
  .tb-title p { display: none; }
  .tb-title h1 { font-size: 12px; white-space: normal; }
  .side-panel.left { display: none; }
  .side-panel.right { top: auto; bottom: 150px; width: calc(100vw - 20px); max-height: 42vh; }
  .hud { display: none; }
  .foot-note { display: none; }
}
</style>

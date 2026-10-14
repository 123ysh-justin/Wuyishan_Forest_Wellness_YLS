<script setup lang="ts">
/** 基地详情页：综合介绍 / 课程体系 / 设施节点 + 三维沙盘入口 + 食宿与公共交通 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MapView from '../components/MapView.vue'
import { getBase, coursesOfBase, poisOfBase, getPoi, nearestHubs, type Course, type Poi } from '../data/store'

const route = useRoute()
const router = useRouter()
const base = computed(() => getBase(route.params.id as string))
const courses = computed(() => coursesOfBase(base.value?.id ?? ''))
const pois = computed(() => poisOfBase(base.value?.id ?? ''))
const trans = computed(() => base.value ? nearestHubs(base.value.coord) : { airport: null, rail: null })

const tab = ref<'intro' | 'course' | 'poi'>('intro')
const activeCourse = ref<Course | null>(null)
const activeStep = ref<number>(-1)
const activePoi = ref<Poi | null>(null)

const mapRef = ref<InstanceType<typeof MapView> | null>(null)

function openCourse(c: Course) { activeCourse.value = c; activeStep.value = -1; activePoi.value = null }
function clickStep(idx: number) {
  activeStep.value = idx
  const step = activeCourse.value?.steps[idx]
  activePoi.value = step ? (getPoi(step.poiId) ?? null) : null
}
function openPoi(p: Poi) { activePoi.value = p; activeCourse.value = null }
function poiName(id: string) { return getPoi(id)?.name ?? '（跨基地通用节点）' }

const tabDefs = [
  { key: 'intro', label: '综合介绍' },
  { key: 'course', label: '课程体系' },
  { key: 'poi', label: '设施节点' }
] as const
</script>

<template>
  <div class="detail" v-if="base">
    <header class="d-top">
      <button class="back" @click="router.push('/')">‹ 返回总览</button>
      <h1>{{ base.name }}</h1>
      <span class="d-type">{{ base.type }}</span>
      <div class="spacer"></div>
      <button v-if="base.hasSandbox" class="sandbox-btn" @click="router.push(`/base/${base.id}/sandbox`)">进入真实场景沙盘 →</button>
    </header>

    <div class="d-main">
      <div class="d-map">
        <MapView ref="mapRef" :center="base.coord" :zoom="11.6" :pitch="50" :show-bases="true" :show-transport="true" :mask-outside="true" @select-base="() => {}" />
        <div class="map-note">{{ base.coordStatus }}<br />影像：EOX Sentinel-2 2024 · 高程：SRTM</div>
      </div>

      <div class="d-content">
        <nav class="tabs">
          <button v-for="t in tabDefs" :key="t.key" :class="{ on: tab === t.key }" @click="tab = t.key">{{ t.label }}</button>
        </nav>

        <!-- 综合介绍 -->
        <section v-show="tab === 'intro'" class="tab-body">
          <div class="block">
            <div class="cover-wrap">
              <img class="base-cover" :src="`./images/base-${base.id}.png`" :alt="base.name" />
              <span class="cover-tag">AI 场景意向图 · 非实景</span>
            </div>
          </div>
          <div class="block">
            <h3>基地概况</h3>
            <p class="intro">{{ base.intro }}</p>
          </div>
          <div class="block kv">
            <div><b>行政区位</b><span>{{ base.city }} · {{ base.town }}</span></div>
            <div><b>详细地址</b><span>{{ base.address }}</span></div>
            <div><b>环带关联</b><span>{{ base.huandaiRelation }}</span></div>
          </div>
          <div class="block">
            <h3>资质认证</h3>
            <div class="tags"><span v-for="q in base.qualifications" :key="q" class="tag green">{{ q }}</span></div>
          </div>
          <div class="block">
            <h3>资源特色</h3>
            <div class="tags"><span v-for="f in base.features" :key="f" class="tag gold">{{ f }}</span></div>
          </div>

          <!-- 实景沙盘入口（醒目） -->
          <div v-if="base.hasSandbox" class="sandbox-promo" @click="router.push(`/base/${base.id}/sandbox`)">
            <div class="sp-icon">🏔</div>
            <div class="sp-text">
              <b>真实场景沙盘</b>
              <span>卫星影像 × 真实地形 · 9 个设施节点联动课程，点击进入沉浸式预览</span>
            </div>
            <span class="sp-go">进入 →</span>
          </div>
          <p v-else class="block intro small">该基地三维沙盘建设中，可先参考云灵山示范基地。</p>

          <div class="block">
            <h3>食宿硬件</h3>
            <p class="intro">{{ base.lodging || '该基地食宿信息收集中。' }}</p>
          </div>
          <div class="block">
            <h3>公共交通</h3>
            <div class="trans-grid">
              <div class="tg"><span class="tg-ico">✈</span><div><b>最近机场</b><p>{{ trans.airport ? trans.airport.hub.name + ' · 直线约 ' + trans.airport.km.toFixed(0) + ' km' : '—' }}</p></div></div>
              <div class="tg"><span class="tg-ico">🚄</span><div><b>最近动车站</b><p>{{ trans.rail ? trans.rail.hub.name + ' · 直线约 ' + trans.rail.km.toFixed(0) + ' km' : '—' }}</p></div></div>
              <div class="tg wide"><span class="tg-ico">🚌</span><div><b>公交 / 接驳</b><p>{{ base.bus }}</p></div></div>
            </div>
            <p class="intro small">距离为经纬度直线估算，公共交通以实际运营班次为准。</p>
          </div>

          <div class="block src">信息来源：{{ base.sources.join('；') }}<br />实景图片与经营数据待基地方提供后补充，本平台不虚构。</div>
        </section>

        <!-- 课程体系 -->
        <section v-show="tab === 'course'" class="tab-body">
          <p class="demo-note">课程为示范方案，不代表基地已实际开展</p>
          <div class="course-list" v-if="!activeCourse">
            <div v-for="c in courses" :key="c.id" class="course-card" @click="openCourse(c)">
              <img class="cc-img" :src="`./images/${c.id}.png`" :alt="c.title" loading="lazy" />
              <div class="cc-cat" :class="c.category === '森林康养' ? 'health' : 'edu'">{{ c.category }}</div>
              <b>{{ c.title }}</b>
              <p>{{ c.goal.slice(0, 46) }}…</p>
              <div class="cc-meta">{{ c.duration }} · {{ c.audience.split('、')[0] }}</div>
            </div>
            <p v-if="!courses.length" class="intro small">该基地课程配置中，可先参考云灵山示范基地的完整课程。</p>
          </div>

          <div class="course-detail" v-else>
            <button class="back-link" @click="activeCourse = null; activePoi = null">‹ 返回课程列表</button>
            <img class="cd-cover" :src="`./images/${activeCourse.id}.png`" :alt="activeCourse.title" />
            <h3>{{ activeCourse.title }}</h3>
            <div class="cc-cat" :class="activeCourse.category === '森林康养' ? 'health' : 'edu'">{{ activeCourse.category }}</div>
            <button class="full-link" @click="router.push(`/course/${activeCourse.id}`)">查看图文完整版 ›</button>
            <div class="cd-grid">
              <div><b>课程目标</b><p>{{ activeCourse.goal }}</p></div>
              <div><b>适宜人群</b><p>{{ activeCourse.audience }}</p></div>
              <div><b>建议时长</b><p>{{ activeCourse.duration }}</p></div>
              <div><b>教学准备</b><p>{{ activeCourse.preparation }}</p></div>
            </div>

            <h4>教学环节时间轴（点击环节查看关联节点）</h4>
            <div class="timeline">
              <div v-for="(st, i) in activeCourse.steps" :key="i" class="tl-step" :class="{ on: activeStep === i }" @click="clickStep(i)">
                <div class="tl-dot">{{ st.order }}</div>
                <div class="tl-info">
                  <b>{{ st.name }} <span class="min">{{ st.minutes }}分钟</span></b>
                  <p v-show="activeStep === i">{{ st.content }}</p>
                  <span class="tl-poi" v-show="activeStep === i">📍 {{ poiName(st.poiId) }}</span>
                </div>
              </div>
            </div>

            <div class="poi-detail inline" v-if="activePoi">
              <button class="x" @click="activePoi = null">×</button>
              <h3>📍 {{ activePoi.name }} <span class="mini-tag">{{ activePoi.type }}</span></h3>
              <p>{{ activePoi.description }}</p>
              <p class="tips">💡 {{ activePoi.tips }}</p>
            </div>

            <div class="cd-foot">
              <p><b>教学材料：</b>{{ activeCourse.materials }}</p>
              <p><b>安全提示：</b>{{ activeCourse.safety }}</p>
            </div>
          </div>
        </section>

        <!-- 设施节点 -->
        <section v-show="tab === 'poi'" class="tab-body">
          <p class="demo-note">以下为规划示意节点（非实测导航点位）</p>
          <div class="poi-list" v-if="pois.length">
            <div v-for="p in pois" :key="p.id" class="poi-card" :class="{ on: activePoi?.id === p.id }" @click="openPoi(p)">
              <div class="poi-type">{{ p.type }}</div>
              <b>{{ p.name }}</b>
              <p>{{ p.function }}</p>
            </div>
          </div>
          <p v-else class="intro small">该基地的规划示意节点建设中，可先参考云灵山示范基地。</p>

          <div class="poi-detail" v-if="activePoi">
            <button class="x" @click="activePoi = null">×</button>
            <h3>{{ activePoi.name }} <span class="mini-tag">{{ activePoi.type }}</span></h3>
            <p>{{ activePoi.description }}</p>
            <p class="tips">💡 {{ activePoi.tips }}</p>
            <div class="linked">
              <b>关联课程</b>
              <div v-for="cid in activePoi.courses" :key="cid" class="link-course" @click="openCourse(courses.find(c => c.id === cid)!)">
                {{ courses.find(c => c.id === cid)?.title ?? cid }} →
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
  <div v-else class="detail"><p style="padding:40px">基地不存在。<button @click="router.push('/')">返回</button></p></div>
</template>

<style scoped>
.detail { position: absolute; inset: 0; display: flex; flex-direction: column; background: #f4f6f3; }
.cover-wrap { position: relative; border-radius: 12px; overflow: hidden; }
.base-cover { width: 100%; height: 190px; object-fit: cover; display: block; }
.cover-tag { position: absolute; right: 8px; bottom: 8px; font-size: 10px; background: rgba(13, 26, 18, .65); color: rgba(255,255,255,.85); padding: 2px 8px; border-radius: 8px; backdrop-filter: blur(4px); }
.cc-img { width: 100%; height: 110px; object-fit: cover; border-radius: 8px; margin-bottom: 7px; display: block; }
.cd-cover { width: 100%; height: 180px; object-fit: cover; border-radius: 10px; margin: 10px 0; display: block; }
.full-link { margin-top: 8px; padding: 6px 14px; border-radius: 8px; border: 1px solid #2e6b4a; background: rgba(46, 107, 74, .08); color: #2e6b4a; font-size: 12.5px; cursor: pointer; }
.full-link:hover { background: rgba(46, 107, 74, .18); }
.d-top { display: flex; align-items: center; gap: 12px; padding: 10px 18px; background: linear-gradient(135deg, #16382a, #2e6b4a); color: #fff; }
.d-top h1 { font-size: 17px; }
.d-type { font-size: 11px; background: rgba(255,255,255,.18); padding: 3px 10px; border-radius: 9px; }
.back { background: rgba(255,255,255,.14); color: #fff; border: none; border-radius: 8px; padding: 7px 12px; cursor: pointer; font-size: 13px; }
.spacer { flex: 1; }
.sandbox-btn { background: #c9a86a; color: #2a2118; border: none; border-radius: 8px; padding: 8px 16px; font-size: 13.5px; cursor: pointer; font-weight: 600; box-shadow: 0 2px 10px rgba(201,168,106,.4); }
.sandbox-btn:hover { filter: brightness(1.06); }

.d-main { flex: 1; display: flex; min-height: 0; }
.d-map { position: relative; flex: 1.15; min-width: 0; }
.map-note { position: absolute; left: 12px; top: 12px; z-index: 5; background: rgba(255,255,255,.88); border-radius: 8px; padding: 7px 11px; font-size: 11px; color: #5a6b5e; line-height: 1.6; }
.d-content { flex: 1; background: #fff; display: flex; flex-direction: column; min-width: 0; box-shadow: -4px 0 18px rgba(0,0,0,.08); }

.tabs { display: flex; border-bottom: 1px solid #e4eae4; }
.tabs button { flex: 1; padding: 12px 4px; border: none; background: none; cursor: pointer; font-size: 14px; color: #7d8d80; border-bottom: 2.5px solid transparent; }
.tabs button.on { color: #2e6b4a; border-bottom-color: #2e6b4a; font-weight: 600; }

.tab-body { flex: 1; overflow-y: auto; padding: 16px 20px; position: relative; }
.block { margin-bottom: 16px; }
.block h3 { font-size: 14px; color: #1e4633; margin-bottom: 7px; }
.intro { font-size: 13.5px; color: #3d4f42; line-height: 1.8; }
.intro.small { font-size: 12.5px; color: #7d8d80; }
.kv > div { display: flex; gap: 10px; padding: 7px 0; border-bottom: 1px dashed #e8eee8; font-size: 13px; }
.kv b { width: 70px; flex-shrink: 0; color: #37654a; }
.kv span { color: #4a5a4d; }
.tags { display: flex; flex-wrap: wrap; gap: 7px; }
.tag { font-size: 12px; padding: 4px 11px; border-radius: 10px; }
.tag.green { background: #eef4ee; color: #37654a; border: 1px solid #d4e2d4; }
.tag.gold { background: #f7f1e3; color: #7a6535; border: 1px solid #e8dcc0; }
.block.src { font-size: 11px; color: #a5b3a7; line-height: 1.7; border-top: 1px solid #eee; padding-top: 10px; }

.sandbox-promo { display: flex; align-items: center; gap: 12px; padding: 14px 16px; margin-bottom: 16px; border-radius: 14px; cursor: pointer; background: linear-gradient(120deg, rgba(46,107,74,.12), rgba(201,168,106,.14)); border: 1px solid rgba(46,107,74,.3); transition: all .2s; }
.sandbox-promo:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(46,107,74,.2); }
.sp-icon { font-size: 30px; }
.sp-text { flex: 1; display: flex; flex-direction: column; }
.sp-text b { font-size: 14.5px; color: #1e4633; }
.sp-text span { font-size: 11.5px; color: #7d8d80; margin-top: 3px; line-height: 1.5; }
.sp-go { font-size: 13px; color: #2e6b4a; font-weight: 600; flex: none; }

.trans-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.trans-grid .tg.wide { grid-column: 1 / -1; }
.tg { display: flex; gap: 9px; align-items: flex-start; padding: 10px 12px; border-radius: 10px; background: #f5f8f5; border: 1px solid #e4eae4; }
.tg-ico { font-size: 18px; flex: none; }
.tg b { font-size: 11.5px; color: #37654a; display: block; }
.tg p { font-size: 12.5px; color: #3d4f42; margin: 3px 0 0; line-height: 1.5; }

.demo-note { font-size: 11.5px; color: #a07828; background: #faf3e3; border-radius: 7px; padding: 7px 11px; margin-bottom: 12px; }

.poi-list { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
.poi-card { border: 1px solid #e2e8e2; border-radius: 10px; padding: 11px 12px; cursor: pointer; transition: all .15s; }
.poi-card:hover, .poi-card.on { border-color: #2e6b4a; background: #f0f7f2; }
.poi-card .poi-type { font-size: 10.5px; color: #2e6b4a; background: #e4efe6; display: inline-block; padding: 2px 8px; border-radius: 8px; margin-bottom: 5px; }
.poi-card b { font-size: 13px; color: #22362a; display: block; }
.poi-card p { font-size: 11.5px; color: #7d8d80; margin-top: 4px; line-height: 1.55; }

.poi-detail { position: absolute; left: 16px; right: 16px; bottom: 16px; z-index: 5; background: #fff; border: 1px solid #d8e4d8; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,.16); padding: 14px 16px; }
.poi-detail.inline { position: static; margin-top: 12px; box-shadow: 0 2px 12px rgba(0,0,0,.1); }
.poi-detail h3 { font-size: 14.5px; color: #1e4633; }
.poi-detail p { font-size: 12.5px; color: #4a5a4d; line-height: 1.7; margin-top: 6px; }
.poi-detail .tips { color: #7a6535; font-size: 12px; }
.poi-detail .x { position: absolute; top: 8px; right: 10px; border: none; background: #eef2ee; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; }
.mini-tag { font-size: 10.5px; background: #e4efe6; color: #2e6b4a; padding: 2px 8px; border-radius: 8px; font-weight: 400; }
.linked { margin-top: 8px; border-top: 1px dashed #e0e8e0; padding-top: 8px; }
.linked b { font-size: 12px; color: #37654a; }
.link-course { font-size: 12.5px; color: #2e6b4a; cursor: pointer; padding: 4px 0; }
.link-course:hover { text-decoration: underline; }

.course-list { display: flex; flex-direction: column; gap: 10px; }
.course-card { border: 1px solid #e2e8e2; border-radius: 10px; padding: 12px 14px; cursor: pointer; transition: all .15s; }
.course-card:hover { border-color: #2e6b4a; box-shadow: 0 2px 10px rgba(46,107,74,.14); }
.course-card b { font-size: 14px; color: #22362a; display: block; margin: 5px 0 3px; }
.course-card p { font-size: 12px; color: #7d8d80; line-height: 1.6; }
.cc-meta { font-size: 11px; color: #a08a55; margin-top: 6px; }
.cc-cat { display: inline-block; font-size: 10.5px; padding: 2px 9px; border-radius: 8px; }
.cc-cat.health { background: #e4efe6; color: #2e6b4a; }
.cc-cat.edu { background: #e6ecf5; color: #3a5a8a; }

.back-link { border: none; background: none; color: #2e6b4a; cursor: pointer; font-size: 13px; padding: 0 0 8px; }
.course-detail h3 { font-size: 17px; color: #1e3a2c; margin-bottom: 6px; }
.cd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; }
.cd-grid > div { background: #f7f9f7; border-radius: 9px; padding: 9px 11px; }
.cd-grid b { font-size: 11.5px; color: #37654a; }
.cd-grid p { font-size: 12.5px; color: #4a5a4d; margin-top: 3px; line-height: 1.6; }
.course-detail h4 { font-size: 13.5px; color: #1e4633; margin: 14px 0 8px; }

.timeline { position: relative; padding-left: 4px; }
.tl-step { display: flex; gap: 10px; padding: 7px 6px; border-radius: 9px; cursor: pointer; }
.tl-step:hover, .tl-step.on { background: #f0f7f2; }
.tl-dot { width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0; background: #2e6b4a; color: #fff; font-size: 12px; display: flex; align-items: center; justify-content: center; }
.tl-info b { font-size: 13px; color: #2a3a2e; }
.tl-info .min { font-size: 11px; color: #a08a55; font-weight: 400; margin-left: 5px; }
.tl-info p { font-size: 12.5px; color: #4a5a4d; line-height: 1.7; margin-top: 4px; }
.tl-poi { font-size: 12px; color: #2e6b4a; display: inline-block; margin-top: 4px; }
.cd-foot { margin-top: 14px; border-top: 1px solid #e8eee8; padding-top: 10px; font-size: 12.5px; color: #4a5a4d; line-height: 1.8; }

@media (max-width: 768px) {
  .d-main { flex-direction: column; }
  .d-map { flex: none; height: 38vh; }
  .d-top h1 { font-size: 13.5px; }
  .poi-list, .trans-grid { grid-template-columns: 1fr; }
}
</style>

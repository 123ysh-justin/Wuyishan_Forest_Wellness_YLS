<script setup lang="ts">
/**
 * 课程详情页：封面大图 + 课程信息 + 环节图文时间轴 + 材料/安全 + 关联基地与节点
 * 课程图片为 AI 意向图（页脚明确标注），课程内容为示范方案
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCourse, getBase, getPoi, coursesOfPoi } from '../data/store'
import CourseDemo from '../components/CourseDemo.vue'

const route = useRoute()
const router = useRouter()
const course = computed(() => getCourse(route.params.id as string))
const base = computed(() => course.value ? getBase(course.value.baseId) : null)
const totalMinutes = computed(() => course.value?.steps.reduce((a, s) => a + s.minutes, 0) ?? 0)

/** 有互动演示的课程：冥想/森林浴/瑜伽 → 呼吸引导；八段锦 → 动作演示 */
const demoConfig = computed(() => {
  if (!course.value) return null
  const map: Record<string, { mode: 'breathing' | 'exercise'; title: string }> = {
    'c-meditation': { mode: 'breathing', title: '森林冥想 · 呼吸引导演示' },
    'c-forest-bath': { mode: 'breathing', title: '森林浴 · 放松呼吸演示' },
    'c-yoga': { mode: 'breathing', title: '森林瑜伽 · 调息演示' },
    'c-baduanjin': { mode: 'exercise', title: '八段锦八式 · 跟练演示' }
  }
  return map[course.value.id] ?? null
})

function stepPoi(poiId: string) { return poiId ? getPoi(poiId) : null }
</script>

<template>
  <div v-if="course" class="course-page">
    <!-- 封面 -->
    <header class="hero">
      <img class="hero-img" :src="`./images/${course.id}.png`" :alt="course.title" />
      <div class="hero-mask"></div>
      <div class="hero-content">
        <div class="hero-tags">
          <span class="ht cat">{{ course.category }}</span>
          <span class="ht demo">示范课程方案</span>
          <span class="ht dur">{{ course.duration }}</span>
        </div>
        <h1>{{ course.title }}</h1>
        <p class="hero-base" @click="router.push(`/base/${base?.id}`)">
          📍 {{ base?.name }} · {{ base?.city }}{{ base?.town }}
        </p>
      </div>
      <button class="back-btn" @click="router.back()">‹ 返回</button>
    </header>

    <main class="body">
      <!-- 课程信息栏 -->
      <section class="info-strip">
        <div class="is-item"><span class="k">课程目标</span><p>{{ course.goal }}</p></div>
        <div class="is-row">
          <div class="is-cell"><span class="k">适宜人群</span><b>{{ course.audience }}</b></div>
          <div class="is-cell"><span class="k">建议时长</span><b>{{ course.duration }}（约 {{ totalMinutes }} 分钟）</b></div>
          <div class="is-cell"><span class="k">教学环节</span><b>{{ course.steps.length }} 个</b></div>
          <div class="is-cell"><span class="k">课程类别</span><b>{{ course.category }}</b></div>
        </div>
      </section>

      <!-- 互动演示（冥想呼吸 / 八段锦跟练） -->
      <section v-if="demoConfig" class="block demo-block">
        <CourseDemo :mode="demoConfig.mode" :title="demoConfig.title" />
      </section>

      <!-- 环节时间轴 -->
      <section class="block">
        <h2 class="block-title">教学环节流程</h2>
        <div class="timeline">
          <div v-for="(st, i) in course.steps" :key="i" class="tl-item">
            <div class="tl-rail">
              <div class="tl-dot">{{ st.order }}</div>
              <div v-if="i < course.steps.length - 1" class="tl-line"></div>
            </div>
            <div class="tl-card">
              <div class="tl-head">
                <h3>{{ st.name }}</h3>
                <span class="tl-min">{{ st.minutes }} 分钟</span>
              </div>
              <p class="tl-content">{{ st.content }}</p>
              <div v-if="stepPoi(st.poiId)" class="tl-poi" @click="base?.hasSandbox ? router.push(`/base/${base.id}/sandbox`) : null">
                <span class="poi-ico">◈</span>
                <div>
                  <b>{{ stepPoi(st.poiId)?.name }}</b>
                  <span>{{ stepPoi(st.poiId)?.function }}</span>
                </div>
                <em v-if="base?.hasSandbox">沙盘中查看 ›</em>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 准备 / 材料 / 安全 -->
      <section class="triple">
        <div class="t-card">
          <h3>教学准备</h3>
          <p>{{ course.preparation }}</p>
        </div>
        <div class="t-card">
          <h3>教学材料</h3>
          <p>{{ course.materials }}</p>
        </div>
        <div class="t-card warn">
          <h3>安全提示</h3>
          <p>{{ course.safety }}</p>
        </div>
      </section>

      <!-- 关联基地 -->
      <section v-if="base" class="block">
        <h2 class="block-title">授课基地</h2>
        <div class="base-banner" @click="router.push(`/base/${base.id}`)">
          <img :src="`./images/base-${base.id}.png`" :alt="base.name" />
          <div class="bb-info">
            <h3>{{ base.name }}</h3>
            <p>{{ base.intro }}</p>
            <span class="bb-link">进入基地详情 ›</span>
          </div>
        </div>
      </section>

      <p class="footnote">
        * 本课程为森林康养 / 自然教育示范方案，不代表基地已实际开展；课程图片为 AI 生成的场景意向图，非基地实景照片。
        {{ course.note }}
      </p>
    </main>
  </div>
  <div v-else class="missing">
    <p>课程不存在或已移除</p>
    <button @click="router.push('/')">返回首页</button>
  </div>
</template>

<style scoped>
.course-page { min-height: 100vh; background: #101c14; }

.hero { position: relative; height: 44vh; min-height: 320px; overflow: hidden; }
.hero-img { width: 100%; height: 100%; object-fit: cover; }
.hero-mask { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(13,26,18,.25) 0%, rgba(13,26,18,.05) 40%, rgba(13,26,18,.92) 100%); }
.hero-content { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 max(24px, calc((100vw - 1080px) / 2)) 28px; }
.hero-tags { display: flex; gap: 8px; margin-bottom: 10px; }
.ht { font-size: 11px; padding: 3px 10px; border-radius: 10px; }
.ht.cat { background: rgba(63, 174, 106, .9); color: #fff; }
.ht.demo { background: rgba(201, 168, 106, .9); color: #14231a; }
.ht.dur { background: rgba(255, 255, 255, .18); color: #fff; backdrop-filter: blur(4px); }
.hero-content h1 { margin: 0 0 8px; font-size: 34px; color: #fff; letter-spacing: 1px; text-shadow: 0 2px 12px rgba(0,0,0,.5); }
.hero-base { margin: 0; font-size: 14px; color: rgba(255, 255, 255, .85); cursor: pointer; }
.hero-base:hover { color: #6fd39a; }
.back-btn {
  position: absolute; top: 18px; left: 18px; padding: 7px 14px; border-radius: 9px;
  border: 1px solid rgba(255, 255, 255, .25); background: rgba(13, 26, 18, .55);
  color: #fff; font-size: 13px; cursor: pointer; backdrop-filter: blur(6px);
}
.back-btn:hover { background: rgba(13, 26, 18, .8); }

.body { max-width: 1080px; margin: 0 auto; padding: 26px 24px 60px; }

.info-strip {
  background: rgba(255, 255, 255, .045); border: 1px solid rgba(255, 255, 255, .08);
  border-radius: 14px; padding: 18px 22px; margin-bottom: 26px;
}
.is-item .k, .is-cell .k { display: block; font-size: 11px; color: #9fd4b4; letter-spacing: 1px; margin-bottom: 5px; }
.is-item p { margin: 0 0 14px; font-size: 14px; color: #eaf2ec; line-height: 1.8; }
.is-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; border-top: 1px solid rgba(255,255,255,.08); padding-top: 14px; }
.is-cell b { font-size: 13px; color: #eaf2ec; font-weight: 600; line-height: 1.5; }

.block { margin-bottom: 30px; }
.block-title {
  margin: 0 0 16px; font-size: 18px; color: #f0f6f1; letter-spacing: 1px;
  display: flex; align-items: center; gap: 10px;
}
.block-title::before { content: ''; width: 4px; height: 18px; background: linear-gradient(#3fae6a, #c9a86a); border-radius: 2px; }

.timeline { display: flex; flex-direction: column; }
.tl-item { display: flex; gap: 14px; }
.tl-rail { display: flex; flex-direction: column; align-items: center; flex: none; }
.tl-dot {
  width: 30px; height: 30px; border-radius: 50%; flex: none;
  background: linear-gradient(135deg, #2e6b4a, #3fae6a); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700;
  box-shadow: 0 0 0 4px rgba(63, 174, 106, .15);
}
.tl-line { width: 2px; flex: 1; background: linear-gradient(rgba(63,174,106,.4), rgba(63,174,106,.08)); margin: 4px 0; }
.tl-card {
  flex: 1; margin-bottom: 14px; padding: 14px 18px; border-radius: 12px;
  background: rgba(255, 255, 255, .04); border: 1px solid rgba(255, 255, 255, .07);
  transition: border-color .2s;
}
.tl-card:hover { border-color: rgba(63, 174, 106, .35); }
.tl-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
.tl-head h3 { margin: 0; font-size: 15px; color: #eaf2ec; }
.tl-min { font-size: 11px; color: #c9a86a; flex: none; margin-left: 10px; font-variant-numeric: tabular-nums; }
.tl-content { margin: 0; font-size: 13px; line-height: 1.85; color: rgba(220, 232, 222, .78); }
.tl-poi {
  margin-top: 10px; display: flex; align-items: center; gap: 10px; padding: 8px 12px;
  border-radius: 9px; background: rgba(201, 168, 106, .08); border: 1px solid rgba(201, 168, 106, .2);
  cursor: pointer;
}
.poi-ico { color: #c9a86a; font-size: 16px; }
.tl-poi b { display: block; font-size: 12.5px; color: #e8dcc0; }
.tl-poi span { font-size: 11px; color: rgba(220, 232, 222, .55); }
.tl-poi em { margin-left: auto; font-style: normal; font-size: 11px; color: #6fd39a; }

.triple { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 30px; }
.t-card {
  padding: 16px 18px; border-radius: 12px;
  background: rgba(255, 255, 255, .04); border: 1px solid rgba(255, 255, 255, .07);
}
.t-card.warn { border-color: rgba(201, 168, 106, .3); background: rgba(201, 168, 106, .06); }
.t-card h3 { margin: 0 0 8px; font-size: 13.5px; color: #9fd4b4; letter-spacing: 1px; }
.t-card.warn h3 { color: #c9a86a; }
.t-card p { margin: 0; font-size: 12.5px; line-height: 1.85; color: rgba(220, 232, 222, .75); }

.base-banner {
  display: flex; gap: 18px; border-radius: 14px; overflow: hidden; cursor: pointer;
  background: rgba(255, 255, 255, .04); border: 1px solid rgba(255, 255, 255, .08);
  transition: border-color .2s;
}
.base-banner:hover { border-color: rgba(63, 174, 106, .4); }
.base-banner img { width: 300px; height: 180px; object-fit: cover; flex: none; }
.bb-info { padding: 16px 18px 16px 0; }
.bb-info h3 { margin: 0 0 8px; font-size: 16px; color: #eaf2ec; }
.bb-info p {
  margin: 0 0 10px; font-size: 12.5px; line-height: 1.8; color: rgba(220, 232, 222, .7);
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.bb-link { font-size: 12.5px; color: #6fd39a; }

.footnote { font-size: 11px; color: rgba(220, 232, 222, .4); line-height: 1.8; border-top: 1px solid rgba(255,255,255,.07); padding-top: 16px; }

.missing { min-height: 100vh; display: flex; flex-direction: column; gap: 16px; align-items: center; justify-content: center; background: #101c14; color: #eaf2ec; }
.missing button { padding: 8px 20px; border-radius: 8px; border: 1px solid rgba(63,174,106,.4); background: rgba(63,174,106,.15); color: #6fd39a; cursor: pointer; }

@media (max-width: 860px) {
  .hero-content h1 { font-size: 24px; }
  .is-row { grid-template-columns: 1fr 1fr; }
  .triple { grid-template-columns: 1fr; }
  .base-banner { flex-direction: column; }
  .base-banner img { width: 100%; height: 180px; }
  .bb-info { padding: 0 16px 16px; }
}
</style>

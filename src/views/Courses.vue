<script setup lang="ts">
/** 课程体系总览：按 森林康养 / 自然教育 两大类分组，标注可开展基地 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { store } from '../data/store'

const router = useRouter()
const health = computed(() => store.courses.filter(c => c.category === '森林康养'))
const edu = computed(() => store.courses.filter(c => c.category === '自然教育'))
function baseNames(ids?: string[]) {
  if (!ids || !ids.length) return []
  return ids.map(id => store.bases.find(b => b.id === id)?.shortName).filter(Boolean) as string[]
}
</script>

<template>
  <div class="courses-page">
    <header class="cp-head">
      <button class="back" @click="router.push('/')">‹ 返回总览</button>
      <h1>森林康养与自然教育课程体系</h1>
      <p>{{ store.courses.length }} 门示范课程 · 森林康养 {{ health.length }} 门 / 自然教育 {{ edu.length }} 门 · 每门课程标注可开展基地</p>
    </header>

    <main class="cp-body">
      <section v-for="grp in [{ name: '森林康养', list: health, type: 'health' }, { name: '自然教育', list: edu, type: 'edu' }]" :key="grp.name" class="cp-group">
        <div class="cg-head" :class="grp.type">
          <span class="cg-badge">{{ grp.name }}</span>
          <span class="cg-count">{{ grp.list.length }} 门</span>
        </div>
        <div class="cg-grid">
          <div v-for="c in grp.list" :key="c.id" class="course-card" @click="router.push(`/course/${c.id}`)">
            <div class="cc-imgwrap">
              <img :src="`./images/${c.id}.png`" :alt="c.title" loading="lazy" />
              <span class="cc-cat" :class="grp.type">{{ grp.name }}</span>
            </div>
            <div class="cc-info">
              <h3>{{ c.title }}</h3>
              <p>{{ c.goal }}</p>
              <div class="cc-meta">
                <span>{{ c.duration }}</span><span>{{ c.steps.length }} 个环节</span><span>{{ c.audience.split('、')[0] }}</span>
              </div>
              <div class="cc-bases">
                <span class="cc-bases-label">可开展基地：</span>
                <span v-for="bn in baseNames(c.suitableBases || [c.baseId])" :key="bn" class="cb">{{ bn }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <p class="cp-note">* 全部课程为示范方案，不代表基地已实际开展；课程图片为 AI 场景意向图，非基地实景。可开展基地依据基地资源特色标注，供课程落地参考。</p>
    </main>
  </div>
</template>

<style scoped>
.courses-page { min-height: 100vh; background: #101c14; }
.cp-head { padding: 26px max(24px, calc((100vw - 1160px) / 2)) 6px; }
.back { padding: 7px 14px; border-radius: 9px; border: 1px solid rgba(255, 255, 255, .2); background: rgba(255, 255, 255, .06); color: #eaf2ec; font-size: 13px; cursor: pointer; margin-bottom: 16px; }
.back:hover { background: rgba(255, 255, 255, .12); }
.cp-head h1 { margin: 0 0 6px; font-size: 26px; color: #f0f6f1; letter-spacing: 1px; }
.cp-head p { margin: 0; font-size: 13px; color: rgba(220, 232, 222, .55); }

.cp-body { max-width: 1160px; margin: 0 auto; padding: 18px 24px 60px; }
.cp-group { margin-bottom: 34px; }
.cg-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.cg-badge { font-size: 17px; font-weight: 600; letter-spacing: 1px; }
.cg-head.health .cg-badge { color: #6fd39a; }
.cg-head.edu .cg-badge { color: #e6c98a; }
.cg-count { font-size: 12px; color: rgba(220, 232, 222, .5); background: rgba(255, 255, 255, .05); padding: 3px 12px; border-radius: 9px; }

.cg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(258px, 1fr)); gap: 14px; }
.course-card { border-radius: 12px; overflow: hidden; cursor: pointer; background: rgba(255, 255, 255, .045); border: 1px solid rgba(255, 255, 255, .07); transition: transform .2s, border-color .2s; }
.course-card:hover { transform: translateY(-3px); border-color: rgba(63, 174, 106, .45); }
.cc-imgwrap { position: relative; height: 150px; }
.cc-imgwrap img { width: 100%; height: 100%; object-fit: cover; }
.cc-cat { position: absolute; top: 8px; left: 8px; font-size: 10.5px; padding: 2px 9px; border-radius: 9px; background: rgba(46, 107, 74, .92); color: #fff; }
.cc-cat.edu { background: rgba(154, 124, 60, .92); }
.cc-info { padding: 12px 14px 14px; }
.cc-info h3 { margin: 0 0 6px; font-size: 14.5px; color: #eaf2ec; }
.cc-info p { margin: 0 0 10px; font-size: 11.5px; line-height: 1.7; color: rgba(220, 232, 222, .62); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.cc-meta { display: flex; gap: 6px; flex-wrap: wrap; }
.cc-meta span { font-size: 10px; padding: 2px 8px; border-radius: 8px; background: rgba(255, 255, 255, .07); color: rgba(220, 232, 222, .6); }
.cc-bases { margin-top: 10px; display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
.cc-bases-label { font-size: 10.5px; color: rgba(220, 232, 222, .5); }
.cb { font-size: 10px; padding: 2px 8px; border-radius: 8px; background: rgba(63, 174, 106, .18); color: #6fd39a; }
.cp-note { font-size: 11px; color: rgba(220, 232, 222, .38); margin-top: 8px; }
</style>

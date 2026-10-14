<script setup lang="ts">
/**
 * 课程交互演示组件：
 * - breathing：呼吸冥想引导动画（吸气4s → 屏息4s → 呼气6s 循环，带进度环与引导语）
 * - exercise：八段锦八式自动演示（简笔人姿势逐式播放，带口诀与进度条）
 * 用于课程详情页的「互动演示」板块，方便课堂/汇报现场展示。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  mode: 'breathing' | 'exercise'
  title?: string
}>()

/* ================= 呼吸冥想演示 ================= */
interface Phase { name: string; seconds: number; hint: string; scale: number }
const phases: Phase[] = [
  { name: '吸气', seconds: 4, hint: '用鼻腔缓缓吸气，感受林间清气充盈胸腹', scale: 1 },
  { name: '屏息', seconds: 4, hint: '轻轻停驻，聆听溪流与风声', scale: 1 },
  { name: '呼气', seconds: 6, hint: '经口缓慢呼出，释放紧张与杂念', scale: 0.55 }
]
const running = ref(false)
const phaseIdx = ref(0)
const phaseLeft = ref(phases[0].seconds)
const cycles = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const phase = computed(() => phases[phaseIdx.value])
const ringProgress = computed(() => 1 - phaseLeft.value / phase.value.seconds)
const R = 54
const CIRC = 2 * Math.PI * R

function tick() {
  if (phaseLeft.value > 1) { phaseLeft.value--; return }
  if (phaseIdx.value < phases.length - 1) {
    phaseIdx.value++
  } else {
    phaseIdx.value = 0
    cycles.value++
  }
  phaseLeft.value = phases[phaseIdx.value].seconds
}
function toggleBreath() {
  running.value = !running.value
  if (running.value) timer = setInterval(tick, 1000)
  else if (timer) { clearInterval(timer); timer = null }
}
function resetBreath() {
  if (timer) { clearInterval(timer); timer = null }
  running.value = false; phaseIdx.value = 0; phaseLeft.value = phases[0].seconds; cycles.value = 0
}

/* ================= 八段锦演示 ================= */
interface Form { name: string; tip: string; arms: [string, string]; lean: number; crouch: number }
const forms: Form[] = [
  { name: '第一式 · 双手托天理三焦', tip: '两臂缓缓上举过头，掌心向上如托天，伸展全身', arms: ['M50,50 L38,14', 'M50,50 L62,14'], lean: 0, crouch: 0 },
  { name: '第二式 · 左右开弓似射雕', tip: '一手平推如开弓，一手屈肘如搭箭，左右交替', arms: ['M50,50 L16,42', 'M50,50 L64,54 L58,40'], lean: 0, crouch: 4 },
  { name: '第三式 · 调理脾胃须单举', tip: '一手上举、一手下按，上下对拉，调理中焦', arms: ['M50,50 L40,14', 'M50,50 L58,88'], lean: 0, crouch: 0 },
  { name: '第四式 · 五劳七伤往后瞧', tip: '头颈缓缓后转，目视后方，松解颈肩', arms: ['M50,50 L30,64', 'M50,50 L70,64'], lean: -6, crouch: 0 },
  { name: '第五式 · 摇头摆尾去心火', tip: '马步下蹲，上体前俯左右摇转，泻心火', arms: ['M50,50 L34,68', 'M50,50 L66,68'], lean: 14, crouch: 10 },
  { name: '第六式 · 两手攀足固肾腰', tip: '上体前屈，两手沿腿下摩至足，固护肾腰', arms: ['M50,50 L40,96', 'M50,50 L60,96'], lean: 38, crouch: 2 },
  { name: '第七式 · 攒拳怒目增气力', tip: '马步冲拳，怒目圆睁，倍增气力', arms: ['M50,50 L18,50', 'M50,50 L62,58'], lean: 0, crouch: 8 },
  { name: '第八式 · 背后七颠百病消', tip: '提踵颠足，全身震荡放松，百病消除', arms: ['M50,50 L38,82', 'M50,50 L62,82'], lean: 0, crouch: -4 }
]
const formIdx = ref(0)
const playing = ref(false)
const formProgress = ref(0) // 0-1 当前式进度
let formTimer: ReturnType<typeof setInterval> | null = null
const FORM_SECONDS = 6

const form = computed(() => forms[formIdx.value])
const bodyTransform = computed(() => {
  const f = form.value
  return `rotate(${f.lean} 50 92) translate(0 ${-f.crouch})`
})
function formTick() {
  formProgress.value += 1 / (FORM_SECONDS * 10)
  if (formProgress.value >= 1) {
    formProgress.value = 0
    formIdx.value = (formIdx.value + 1) % forms.length
  }
}
function toggleForm() {
  playing.value = !playing.value
  if (playing.value) formTimer = setInterval(formTick, 100)
  else if (formTimer) { clearInterval(formTimer); formTimer = null }
}
function gotoForm(i: number) { formIdx.value = i; formProgress.value = 0 }

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  if (formTimer) clearInterval(formTimer)
})

onMounted(() => { if (props.mode === 'exercise') toggleForm() })
</script>

<template>
  <div class="course-demo" :class="mode">
    <div class="cd-head">
      <span class="cd-badge">互动演示</span>
      <h3>{{ title || (mode === 'breathing' ? '森林呼吸冥想引导' : '八段锦八式跟练演示') }}</h3>
    </div>

    <!-- ===== 呼吸冥想 ===== -->
    <div v-if="mode === 'breathing'" class="breath-stage">
      <div class="breath-visual">
        <svg viewBox="0 0 140 140" class="breath-svg">
          <circle cx="70" cy="70" r="62" fill="none" stroke="rgba(63,174,106,.15)" stroke-width="1.5" stroke-dasharray="3 5" />
          <circle cx="70" cy="70" r="62" fill="none" stroke="rgba(201,168,106,.35)" stroke-width="1" stroke-dasharray="1 8" class="orbit" />
          <circle
            cx="70" cy="70" :r="R" fill="none" stroke="#3fae6a" stroke-width="4" stroke-linecap="round"
            :stroke-dasharray="CIRC" :stroke-dashoffset="CIRC * (1 - ringProgress)"
            transform="rotate(-90 70 70)" class="ring"
          />
          <circle
            cx="70" cy="70" r="40"
            fill="url(#bg)" class="core"
            :style="{ transform: `scale(${phase.scale})`, transitionDuration: phase.seconds + 's' }"
          />
          <defs>
            <radialGradient id="bg" cx="50%" cy="38%">
              <stop offset="0%" stop-color="#7fd6a2" stop-opacity=".95" />
              <stop offset="100%" stop-color="#2e6b4a" stop-opacity=".9" />
            </radialGradient>
          </defs>
        </svg>
        <div class="breath-text">
          <div class="bt-phase">{{ phase.name }}</div>
          <div class="bt-count">{{ phaseLeft }}s</div>
        </div>
      </div>
      <div class="breath-side">
        <p class="bs-hint">{{ phase.hint }}</p>
        <div class="bs-meta">
          <span>已完成 <b>{{ cycles }}</b> 组呼吸</span>
          <span>节奏 4-4-6（吸-屏-呼）</span>
        </div>
        <div class="bs-actions">
          <button class="cd-btn primary" @click="toggleBreath">{{ running ? '⏸ 暂停' : '▶ 开始引导' }}</button>
          <button class="cd-btn" @click="resetBreath">↺ 重置</button>
        </div>
        <p class="bs-note">建议跟随动画完成 5–8 组呼吸，相当于课程「正念觉察」环节的课前引导。</p>
      </div>
    </div>

    <!-- ===== 八段锦 ===== -->
    <div v-else class="form-stage">
      <div class="form-visual">
        <svg viewBox="0 0 100 140" class="form-svg">
          <ellipse cx="50" cy="133" rx="26" ry="4" fill="rgba(0,0,0,.18)" />
          <g :transform="bodyTransform" style="transition: transform .8s ease">
            <circle cx="50" cy="24" r="11" fill="none" stroke="#e8dcc0" stroke-width="4" stroke-linecap="round" />
            <line x1="50" y1="37" x2="50" y2="92" stroke="#e8dcc0" stroke-width="4" stroke-linecap="round" />
            <path :d="form.arms[0]" fill="none" stroke="#6fd39a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="transition: d .8s" />
            <path :d="form.arms[1]" fill="none" stroke="#6fd39a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="transition: d .8s" />
            <line x1="50" y1="92" x2="36" y2="128" stroke="#e8dcc0" stroke-width="4" stroke-linecap="round" />
            <line x1="50" y1="92" x2="64" y2="128" stroke="#e8dcc0" stroke-width="4" stroke-linecap="round" />
          </g>
        </svg>
        <div class="form-progress-ring">
          <div class="fpr-bar" :style="{ height: formProgress * 100 + '%' }"></div>
        </div>
      </div>
      <div class="form-side">
        <div class="fs-name">{{ form.name }}</div>
        <p class="fs-tip">{{ form.tip }}</p>
        <div class="fs-dots">
          <button
            v-for="(f, i) in forms" :key="i"
            class="fs-dot" :class="{ on: i === formIdx }"
            :title="f.name" @click="gotoForm(i)"
          >{{ i + 1 }}</button>
        </div>
        <div class="fs-actions">
          <button class="cd-btn primary" @click="toggleForm">{{ playing ? '⏸ 暂停' : '▶ 继续跟练' }}</button>
          <button class="cd-btn" @click="gotoForm((formIdx + forms.length - 1) % forms.length)">‹ 上一式</button>
          <button class="cd-btn" @click="gotoForm((formIdx + 1) % forms.length)">下一式 ›</button>
        </div>
        <p class="bs-note">对应课程「八段锦八式领练」环节，演示自动每 {{ FORM_SECONDS }} 秒切换一式，可点击数字定点观看。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.course-demo {
  border-radius: 16px; overflow: hidden;
  background: linear-gradient(135deg, #122a1d, #0d1f16);
  border: 1px solid rgba(111, 211, 154, .18);
  color: #eaf2ec;
}
.cd-head { display: flex; align-items: center; gap: 10px; padding: 14px 18px 0; }
.cd-badge {
  font-size: 11px; padding: 2px 10px; border-radius: 9px;
  background: rgba(201, 168, 106, .2); color: #e8c97e; border: 1px solid rgba(201, 168, 106, .4);
}
.cd-head h3 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: .5px; }

/* —— 呼吸 —— */
.breath-stage { display: flex; gap: 24px; padding: 16px 22px 20px; align-items: center; }
.breath-visual { position: relative; width: 220px; height: 220px; flex: none; }
.breath-svg { width: 100%; height: 100%; }
.orbit { transform-origin: 70px 70px; animation: orbit-spin 14s linear infinite; }
@keyframes orbit-spin { to { transform: rotate(360deg); } }
.core { transform-origin: 70px 70px; transition-property: transform; transition-timing-function: cubic-bezier(.45, 0, .35, 1); }
.ring { transition: stroke-dashoffset 1s linear; }
.breath-text {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; pointer-events: none;
}
.bt-phase { font-size: 22px; font-weight: 700; letter-spacing: 6px; text-shadow: 0 1px 4px rgba(0,0,0,.4); }
.bt-count { font-size: 13px; color: rgba(234, 242, 236, .75); font-variant-numeric: tabular-nums; margin-top: 2px; }
.breath-side { flex: 1; min-width: 0; }
.bs-hint { font-size: 14px; line-height: 1.8; color: #d8e8dc; min-height: 50px; margin: 0 0 10px; }
.bs-meta { display: flex; gap: 18px; font-size: 12px; color: rgba(220, 232, 222, .6); margin-bottom: 12px; }
.bs-meta b { color: #c9a86a; font-size: 15px; }
.bs-actions { display: flex; gap: 8px; margin-bottom: 10px; }
.bs-note { font-size: 11px; color: rgba(220, 232, 222, .45); line-height: 1.6; margin: 0; }

/* —— 八段锦 —— */
.form-stage { display: flex; gap: 24px; padding: 16px 22px 20px; align-items: center; }
.form-visual { position: relative; width: 170px; height: 230px; flex: none; display: flex; }
.form-svg { width: 150px; height: 100%; }
.form-progress-ring {
  width: 5px; border-radius: 3px; background: rgba(255,255,255,.08);
  margin-left: 8px; overflow: hidden; display: flex; align-items: flex-end;
}
.fpr-bar { width: 100%; background: linear-gradient(180deg, #c9a86a, #3fae6a); transition: height .1s linear; }
.form-side { flex: 1; min-width: 0; }
.fs-name { font-size: 17px; font-weight: 700; color: #e8c97e; margin-bottom: 6px; }
.fs-tip { font-size: 13px; line-height: 1.8; color: #d8e8dc; margin: 0 0 12px; min-height: 44px; }
.fs-dots { display: flex; gap: 6px; margin-bottom: 12px; }
.fs-dot {
  width: 26px; height: 26px; border-radius: 50%; border: 1px solid rgba(255,255,255,.2);
  background: rgba(255,255,255,.06); color: rgba(234,242,236,.7); font-size: 11.5px; cursor: pointer;
  transition: all .2s;
}
.fs-dot.on { background: rgba(63, 174, 106, .3); border-color: #3fae6a; color: #9fe6bd; transform: scale(1.15); }
.fs-actions { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }

.cd-btn {
  padding: 7px 14px; border-radius: 9px; font-size: 12.5px; cursor: pointer;
  border: 1px solid rgba(255, 255, 255, .18); background: rgba(255, 255, 255, .07); color: #eaf2ec;
  transition: all .2s;
}
.cd-btn:hover { background: rgba(255, 255, 255, .14); }
.cd-btn.primary { background: rgba(63, 174, 106, .28); border-color: rgba(63, 174, 106, .55); color: #9fe6bd; }
.cd-btn.primary:hover { background: rgba(63, 174, 106, .42); }

@media (max-width: 700px) {
  .breath-stage, .form-stage { flex-direction: column; }
  .breath-visual { width: 190px; height: 190px; }
}
</style>

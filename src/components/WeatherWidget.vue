<script setup lang="ts">
/**
 * 武夷山实时气象 + 空气质量（Open-Meteo 免费 API，真实数据，无需密钥）
 * 数据加载失败时明确显示"暂缺"，不展示虚构数字
 */
import { onMounted, onBeforeUnmount, ref } from 'vue'

interface Current {
  temperature_2m: number; relative_humidity_2m: number; apparent_temperature: number
  weather_code: number; wind_speed_10m: number; precipitation: number
}
interface Air { us_aqi: number; pm2_5: number; pm10: number }

const cur = ref<Current | null>(null)
const air = ref<Air | null>(null)
const failed = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

const WMO: Record<number, string> = {
  0: '晴', 1: '大部晴朗', 2: '局部多云', 3: '阴', 45: '雾', 48: '雾凇',
  51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨',
  66: '冻雨', 67: '冻雨', 71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
  80: '阵雨', 81: '强阵雨', 82: '暴雨', 85: '阵雪', 86: '强阵雪', 95: '雷暴', 96: '雷暴冰雹', 99: '雷暴冰雹'
}

function aqiLevel(v: number): { label: string; color: string } {
  if (v <= 50) return { label: '优', color: '#3fae6a' }
  if (v <= 100) return { label: '良', color: '#c9a86a' }
  if (v <= 150) return { label: '轻度污染', color: '#d98a3d' }
  return { label: '污染', color: '#c05555' }
}

async function load() {
  try {
    const [w, a] = await Promise.all([
      fetch('https://api.open-meteo.com/v1/forecast?latitude=27.72&longitude=117.72&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation&timezone=Asia%2FShanghai').then(r => r.json()),
      fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=27.72&longitude=117.72&current=us_aqi,pm2_5,pm10&timezone=Asia%2FShanghai').then(r => r.json()).catch(() => null)
    ])
    if (w?.current) { cur.value = w.current; failed.value = false }
    if (a?.current) air.value = a.current
  } catch {
    failed.value = true
  }
}

onMounted(() => { load(); timer = setInterval(load, 10 * 60 * 1000) })
onBeforeUnmount(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div class="weather-widget">
    <div class="ww-head">
      <span class="ww-title">武夷山实时气象</span>
      <span class="ww-src">Open-Meteo 实况</span>
    </div>
    <div v-if="cur" class="ww-body">
      <div class="ww-main">
        <div class="ww-temp">{{ Math.round(cur.temperature_2m) }}°</div>
        <div class="ww-desc">
          <div class="ww-weather">{{ WMO[cur.weather_code] ?? '—' }}</div>
          <div class="ww-sub">体感 {{ Math.round(cur.apparent_temperature) }}°C</div>
        </div>
        <div v-if="air" class="ww-aqi" :style="{ borderColor: aqiLevel(air.us_aqi).color }">
          <div class="aqi-num" :style="{ color: aqiLevel(air.us_aqi).color }">{{ Math.round(air.us_aqi) }}</div>
          <div class="aqi-label">{{ aqiLevel(air.us_aqi).label }}</div>
        </div>
      </div>
      <div class="ww-grid">
        <div class="ww-cell"><span class="k">湿度</span><span class="v">{{ cur.relative_humidity_2m }}%</span></div>
        <div class="ww-cell"><span class="k">风速</span><span class="v">{{ cur.wind_speed_10m.toFixed(1) }} km/h</span></div>
        <div class="ww-cell"><span class="k">降水</span><span class="v">{{ cur.precipitation }} mm</span></div>
        <div class="ww-cell" v-if="air"><span class="k">PM2.5</span><span class="v">{{ air.pm2_5.toFixed(1) }} μg/m³</span></div>
      </div>
    </div>
    <div v-else class="ww-empty">{{ failed ? '气象数据暂缺（接口访问失败）' : '气象数据加载中…' }}</div>
  </div>
</template>

<style scoped>
.weather-widget { padding: 12px 14px; }
.ww-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.ww-title { font-size: 13px; font-weight: 600; color: #eaf2ec; letter-spacing: 1px; }
.ww-src { font-size: 10px; color: rgba(220, 232, 222, .45); }
.ww-main { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
.ww-temp { font-size: 42px; font-weight: 200; color: #fff; line-height: 1; font-variant-numeric: tabular-nums; }
.ww-desc { flex: 1; }
.ww-weather { font-size: 15px; color: #eaf2ec; }
.ww-sub { font-size: 11px; color: rgba(220, 232, 222, .55); margin-top: 2px; }
.ww-aqi { text-align: center; border: 1.5px solid; border-radius: 10px; padding: 4px 10px; }
.aqi-num { font-size: 20px; font-weight: 600; line-height: 1.1; }
.aqi-label { font-size: 10px; color: rgba(220, 232, 222, .6); }
.ww-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.ww-cell {
  display: flex; justify-content: space-between; padding: 5px 9px;
  background: rgba(255, 255, 255, .05); border-radius: 6px; font-size: 12px;
}
.ww-cell .k { color: rgba(220, 232, 222, .55); }
.ww-cell .v { color: #eaf2ec; font-variant-numeric: tabular-nums; }
.ww-empty { font-size: 12px; color: rgba(220, 232, 222, .5); padding: 8px 0; }
</style>

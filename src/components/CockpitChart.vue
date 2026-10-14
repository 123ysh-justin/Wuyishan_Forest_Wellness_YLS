<script setup lang="ts">
/** 轻量 ECharts 容器：自适应尺寸，深色主题 */
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{ option: echarts.EChartsOption; height?: string }>()
const el = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let ro: ResizeObserver | null = null

onMounted(() => {
  chart = echarts.init(el.value!)
  chart.setOption(props.option)
  ro = new ResizeObserver(() => chart?.resize())
  ro.observe(el.value!)
})
watch(() => props.option, (o) => chart?.setOption(o, true), { deep: true })
onBeforeUnmount(() => { ro?.disconnect(); chart?.dispose(); chart = null })
</script>

<template>
  <div ref="el" class="cockpit-chart" :style="{ height: height ?? '160px' }"></div>
</template>

<style scoped>
.cockpit-chart { width: 100%; }
</style>

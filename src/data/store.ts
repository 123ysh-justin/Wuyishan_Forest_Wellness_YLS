/**
 * 业务数据层（第一阶段：本地 JSON + localStorage 演示适配器）
 * 数据分三类：真实地理数据层（边界/影像/DEM 配置）、业务内容层（本文件）、交互展示层（组件）
 */
import basesJson from './bases.json'
import coursesJson from './courses.json'
import poisJson from './pois.json'
import transportJson from './transport.json'

export interface Base {
  id: string; name: string; shortName: string; type: string
  city: string; town: string; address: string
  coord: [number, number]; coordStatus: string; coordSource: string
  huandaiRelation: string; qualifications: string[]
  intro: string; features: string[]; coverColor: string
  hasSandbox: boolean; verified: boolean; sources: string[]
  lodging?: string; bus?: string
}

export interface CourseStep {
  order: number; name: string; minutes: number; poiId: string; content: string
}
export interface Course {
  id: string; baseId: string; title: string; category: string; isDemo: boolean
  goal: string; audience: string; duration: string; preparation: string
  steps: CourseStep[]; materials: string; safety: string; note: string
  /** 有条件开展该课程的康养基地 id 列表（首页/课程体系页展示用） */
  suitableBases?: string[]
}

export interface TransportHub {
  id: string; name: string; type: 'airport' | 'rail' | 'bus'; coord: [number, number]
}
export const transportHubs = transportJson.hubs as TransportHub[]

export interface Poi {
  id: string; baseId: string; name: string; type: string; isDemo: boolean
  function: string; description: string; courses: string[]; tips: string
}

const LS_KEY = 'wys_demo_data_v1'

interface StoreData { bases: Base[]; courses: Course[]; pois: Poi[] }

function load(): StoreData {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* 忽略损坏数据 */ }
  return { bases: basesJson as Base[], courses: coursesJson as Course[], pois: poisJson as Poi[] }
}

export const store = reactive(load())

function persist() {
  localStorage.setItem(LS_KEY, JSON.stringify({ bases: store.bases, courses: store.courses, pois: store.pois }))
}

export function resetStore() {
  localStorage.removeItem(LS_KEY)
  store.bases = basesJson as Base[]
  store.courses = coursesJson as Course[]
  store.pois = poisJson as Poi[]
}

// —— 查询 ——
export const getBase = (id: string) => store.bases.find(b => b.id === id)
export const coursesOfBase = (baseId: string) => store.courses.filter(c => c.baseId === baseId)
export const poisOfBase = (baseId: string) => store.pois.filter(p => p.baseId === baseId)
export const getCourse = (id: string) => store.courses.find(c => c.id === id)
export const getPoi = (id: string) => store.pois.find(p => p.id === id)
export const coursesOfPoi = (poiId: string) => store.courses.filter(c => c.steps.some(s => s.poiId === poiId))

// —— 统计（全部按真实业务数据计算，不含虚构运营数字）——
export function stats() {
  return {
    baseCount: store.bases.length,
    verifiedBaseCount: store.bases.filter(b => b.coordStatus.startsWith('已核实')).length,
    pendingCoordCount: store.bases.filter(b => !b.coordStatus.startsWith('已核实')).length,
    courseCount: store.courses.length,
    poiCount: store.pois.length,
    healthCourseCount: store.courses.filter(c => c.category === '森林康养').length,
    eduCourseCount: store.courses.filter(c => c.category === '自然教育').length
  }
}

/** 经纬度直线距离（公里） */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371
  const dLat = (b[1] - a[1]) * Math.PI / 180
  const dLng = (b[0] - a[0]) * Math.PI / 180
  const la1 = a[1] * Math.PI / 180, la2 = b[1] * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface HubDistance { hub: TransportHub; km: number }

/** 距某坐标最近的机场 / 动车站（按直线距离） */
export function nearestHubs(coord: [number, number]): { airport: HubDistance | null; rail: HubDistance | null } {
  const dist = (h: TransportHub) => ({ hub: h, km: haversineKm(coord, h.coord) })
  const airports = transportHubs.filter(h => h.type === 'airport').map(dist).sort((a, b) => a.km - b.km)
  const rails = transportHubs.filter(h => h.type === 'rail').map(dist).sort((a, b) => a.km - b.km)
  return { airport: airports[0] ?? null, rail: rails[0] ?? null }
}

// —— 后台增删改（阶段 C 使用，演示模式持久化到 localStorage）——
export function upsertBase(b: Base) {
  const i = store.bases.findIndex(x => x.id === b.id)
  if (i >= 0) store.bases[i] = b; else store.bases.push(b)
  persist()
}
export function removeBase(id: string) {
  store.bases = store.bases.filter(b => b.id !== id)
  persist()
}
export function upsertCourse(c: Course) {
  const i = store.courses.findIndex(x => x.id === c.id)
  if (i >= 0) store.courses[i] = c; else store.courses.push(c)
  persist()
}
export function removeCourse(id: string) {
  store.courses = store.courses.filter(c => c.id !== id)
  persist()
}
export function upsertPoi(p: Poi) {
  const i = store.pois.findIndex(x => x.id === p.id)
  if (i >= 0) store.pois[i] = p; else store.pois.push(p)
  persist()
}
export function removePoi(id: string) {
  store.pois = store.pois.filter(p => p.id !== id)
  persist()
}

import { reactive } from 'vue'

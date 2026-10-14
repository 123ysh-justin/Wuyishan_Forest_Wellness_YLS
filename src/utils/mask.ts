/**
 * 区域掩膜与范围工具：用「环武夷山国家公园保护发展带」四区县（武夷山市、建阳区、邵武市、光泽县）
 * 真实行政边界生成「世界减去四区县并集」的掩膜，使地图只保留并突出环带地块，边界外区域全部暗化。
 */
import beltGeo from '../data/belt_cities.json'

type Position = [number, number]

/** 计算环的带符号面积（>0 为逆时针） */
function signedArea(ring: Position[]): number {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  }
  return sum / 2
}

/** 强制环为顺时针（GeoJSON 孔） */
function ensureCW(ring: Position[]): Position[] {
  return signedArea(ring) > 0 ? [...ring].reverse() : ring
}

/** 世界范围外环（逆时针） */
function worldRing(): Position[] {
  return [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]
}

/** 遍历一个几何的所有外环坐标 */
function outerRings(geom: any): Position[][] {
  const polys: Position[][][] = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates]
  return polys.map(poly => poly[0] as Position[])
}

/** 世界 minus 四区县并集 的掩膜多边形 */
export function buildRegionMask(): GeoJSON.Feature<GeoJSON.Polygon> {
  const holes: Position[][] = []
  for (const f of (beltGeo as any).features) {
    for (const ring of outerRings(f.geometry)) {
      if (ring && ring.length > 3) holes.push(ensureCW(ring.map((p: number[]) => [p[0], p[1]] as Position)))
    }
  }
  return {
    type: 'Feature',
    properties: { name: '环带外掩膜' },
    geometry: { type: 'Polygon', coordinates: [worldRing(), ...holes] }
  }
}

/** 环带范围 [west, south, east, north]，用于初始视野与平移限制 */
export function regionBounds(): [number, number, number, number] {
  let w = 180, s = 90, e = -180, n = -90
  const visit = (p: number[]) => {
    if (p[0] < w) w = p[0]
    if (p[0] > e) e = p[0]
    if (p[1] < s) s = p[1]
    if (p[1] > n) n = p[1]
  }
  for (const f of (beltGeo as any).features) {
    const walk = (coords: any) => {
      if (typeof coords[0] === 'number') visit(coords)
      else coords.forEach(walk)
    }
    walk(f.geometry.coordinates)
  }
  return [w, s, e, n]
}

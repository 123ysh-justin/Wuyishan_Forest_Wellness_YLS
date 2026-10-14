/**
 * 地图数据源配置（真实 GIS 数据源，详见 DATA_SOURCE_REPORT.md）
 *
 * 影像：高德卫星影像（国内 CDN，加载快）——主用
 *       备选 EOX Sentinel-2 Cloudless 2024（ESA 无云拼接，境外，慢）
 * 高程：AWS Open Data Terrain Tiles（Terrarium 编码，武夷山图幅实测来源为 NASA SRTM N29E117）
 * 备选高程：Mapterhorn（本机网络实测被拦截，正式部署环境可一键切换）
 *
 * 注意：高德影像为 GCJ-02 坐标系，与阿里 DataV 行政边界同系、贴合良好。
 */

export const IMAGERY_SOURCES = {
  gaodeSatellite: {
    id: 'gaode-satellite',
    name: '高德卫星影像（国内 CDN）',
    type: 'raster' as const,
    tiles: [
      'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
      'https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
      'https://webst03.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
      'https://webst04.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}'
    ],
    tileSize: 256,
    maxzoom: 17,
    attribution: '影像 © 高德地图'
  },
  eoxS2_2024: {
    id: 'eox-s2cloudless-2024',
    name: 'Sentinel-2 无云影像 2024（EOX）',
    type: 'raster' as const,
    tiles: [
      'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg'
    ],
    tileSize: 256,
    maxzoom: 16,
    attribution: '影像 © EOX::Maps Sentinel-2 cloudless 2024（ESA Copernicus 数据）'
  }
}

/** 当前启用的影像源 */
export const ACTIVE_IMAGERY: keyof typeof IMAGERY_SOURCES = 'gaodeSatellite'

export const TERRAIN_SOURCES = {
  /** 主用：AWS 开放地形瓦片（实测可用，武夷山图幅为 SRTM 数据） */
  awsTerrarium: {
    id: 'aws-terrarium',
    name: 'AWS Terrain Tiles（SRTM，Terrarium 编码）',
    type: 'raster-dem' as const,
    tiles: [
      'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
    ],
    tileSize: 256,
    maxzoom: 15,
    encoding: 'terrarium' as const,
    attribution: '高程 © AWS Open Data Terrain Tiles（NASA SRTM 等）'
  },
  /** 备选：Mapterhorn（本机网络被拦截；部署环境可用时把 ACTIVE_TERRAIN 改为 'mapterhorn'） */
  mapterhorn: {
    id: 'mapterhorn',
    name: 'Mapterhorn DEM（Terrarium 编码）',
    type: 'raster-dem' as const,
    tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
    tileSize: 512,
    maxzoom: 15,
    encoding: 'terrarium' as const,
    attribution: '高程 © Mapterhorn'
  }
}

/** 当前启用的高程源 */
export const ACTIVE_TERRAIN: keyof typeof TERRAIN_SOURCES = 'awsTerrarium'

/** 研究区初始视角：武夷山国家公园核心地带 */
export const WUYISHAN_VIEW = {
  center: [117.72, 27.72] as [number, number],
  zoom: 10.2,
  pitch: 62,
  bearing: -18
}

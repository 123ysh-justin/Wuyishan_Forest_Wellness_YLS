# DATA_SOURCE_REPORT.md — 地图数据源核验报告

核验时间：2026-10-08 21:37–21:45（GMT+8）
核验方式：curl 实测 HTTP 状态 / 响应头 / 瓦片内容 + 目视检查影像瓦片。
测试区域定位：武夷山市核心区（约 117.72°E, 27.72°N），z10 瓦片坐标 x=846, y=425。

## 一、遥感影像源

### ✅ 采用（主用）：高德卫星影像（国内 CDN，2026-10-09 更换）

- **瓦片地址**：`https://webst0{1-4}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}`（四节点负载）
- **更换原因**：原 EOX 源服务器在境外，中国大陆普通网络加载慢；高德影像走国内 CDN，首屏地图加载明显提速（浏览器实测首页高德瓦片 57 个请求、EOX 0 个）
- **坐标系说明**：高德影像为 GCJ-02 坐标系，与阿里 DataV 行政边界同系、贴合良好
- **许可**：高德瓦片服务无公开商用许可，本项目为教学/展示用途示意；正式政府/商业项目应采购合规影像服务

### 备选：EOX Sentinel-2 Cloudless 2024（WGS84，境外）

- **瓦片地址**：`https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg`
- **实测**：z10 武夷山瓦片 HTTP 200，16.5 KB，image/jpeg，3.9s；z12 瓦片同样 200 OK
- **CORS**：`Access-Control-Allow-Origin: *`（浏览器可直接加载，无跨域问题）
- **数据本质**：欧洲 EOX 公司基于 ESA Sentinel-2 卫星 2024 年数据制作的无云拼接产品，**真实遥感影像，非 AI 生成**
- **分辨率**：Sentinel-2 原生 10 m；瓦片服务最高约 z14–z16（视区域），放大后清晰度足以区分山体、河谷、道路与居民点
- **目视核验**：z10 瓦片显示武夷山区深绿色连续山体与河谷纹理，与该区真实地貌一致（截图存档 `reports/screenshots/eox_z10_wuyishan.jpg`）
- **许可**：EOX 提供免费瓦片服务供非商业/评估使用，需署名 `© EOX::Maps Sentinel-2 cloudless`。正式政府/商业项目应向 EOX 购买商业授权（https://cloudless.eox.at）
- **可用级别**：全球覆盖，包含福建武夷山 ✅
- **切换方式**：`src/config/dataSources.ts` 中 `ACTIVE_IMAGERY` 改为 `'eoxS2_2024'`

## 二、DEM 高程数据源

### ✅ 采用：AWS Open Data — Terrain Tiles (Terrarium 编码)

- **瓦片地址**：`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`
- **实测**：z10 武夷山瓦片 HTTP 200，70.9 KB PNG；z12 瓦片 200 OK，46.2 KB
- **CORS**：`Access-Control-Allow-Origin: *`（GET 请求实测确认）
- **数据本质（实测证据）**：响应头 `x-amz-meta-x-imagery-sources: srtm/N29E117.tif` —— 该瓦片由 **NASA SRTM 真实雷达测高数据**（武夷山所在 N29E117 图幅）生成，不是随机地形
- **分辨率**：SRTM 约 30 m；服务最高 z15
- **编码**：Terrarium（MapLibre `raster-dem` source 设 `encoding: "terrarium"`）
- **许可**：AWS Open Data 公开免费（原始数据源 SRTM 为公共领域 / 各源见其许可），需署名
- **存档**：`reports/screenshots/aws_dem_z10_wuyishan.png`

### ❌ 不可用（本网络）：Mapterhorn

- **地址**：`https://tiles.mapterhorn.com/{z}/{x}/{y}.webp`（任务书指定源）
- **实测**：`tilejson.json` 元数据可访问（HTTP 200，确认 terrarium 编码、全球覆盖）；但**瓦片二进制请求被本网络环境重置**（curl schannel SSL handshake 失败 ×4 次重试；Node fetch ECONNRESET；HTTP 降级亦失败）
- **结论**：属于本机网络/代理拦截，非服务本身问题。代码中将 Mapterhorn 保留为**可切换备选源**（一行配置切换），正式部署环境（政府服务器/其他网络）大概率可用

## 三、来源-精度-展示分层策略

| 层级 | 影像 | 高程 | 说明 |
|---|---|---|---|
| 区域总览（环带 4252 km²） | 高德卫星（GCJ-02，国内 CDN） | AWS Terrarium/SRTM（30 m） | 倾斜三维视角展示真实山脉河谷 |
| 基地详情 | 同上（最高可用 zoom） | 同上 | 无无人机 DOM 前，如实使用卫星底图，不冒充厘米级影像 |
| 重点节点 | 真实照片/效果图 | — | 后期预留 360° 全景与无人机数据替换接口 |

## 四、环带边界数据状态（2026-10-09 更新）

- **行政边界（已落地）**：环带涉及的武夷山市、建阳区、邵武市、光泽县四区县均使用 **DataV GeoAtlas（阿里云 GaodeData）真实行政区划矢量**，本地存档为 `src/data/huandai_counties.json`（原始含子镇级要素）与 `src/data/belt_cities.json`（区县级简化，含区县配色），来源公开可引用，边界精度为区县级（约 1:100 万）。
- **环带范围表达**：以"四区县并集 = 环带规划范围（约 4252 km²）"表达，`src/utils/mask.ts` 生成"世界 − 四区县并集"掩膜，掩膜外暗化处理，视野聚焦环带地块；未虚构任何"环带精确边界"，界面页脚注明"边界：环带四区县行政区划"。
- **待改进**：若后续获取环带正式规划矢量（村/地块级），可无缝替换 `belt_cities.json`，掩膜与图层逻辑无需改动。

## 五、交通枢纽数据（2026-10-09 新增）

- `src/data/transport.json` 收录 1 个机场（武夷山机场）、4 个火车站（武夷山北站/南平市站/建阳站/邵武站）、4 个公交枢纽（三姑度假区/星村/南源岭/邵武汽车站）。光泽站已按需求移除。
- **坐标性质**：枢纽点位为**近似示意坐标**（依据公开资料人工标定，误差约百米级），仅作为地图上的位置参考点；**不是精密测绘成果**。
- 原第五轮需求中的"机场/车站 → 基地"橙色虚线导航路径已按用户要求整体移除（点击基地不再绘制路线），仅保留枢纽点位与基地卡上的直线距离信息（haversine 估算，见 `nearestHubs`）；正式版如需路径规划可接入路径规划 API 或实测道路矢量。

## 六、风险与约束声明

1. 高德影像瓦片无公开商用许可（本项目教学/展示示意用）；正式政府项目需采购合规影像服务（如天地图影像，需申请 key），或在 `dataSources.ts` 一键切回 EOX（评估/非商业用途）。
2. 字体 glyphs（openmaptiles）与高程（AWS S3）仍为境外服务，但请求量小（字体仅数个请求、高程仅影响 hillshade 渐进渲染），对首屏影响有限；正式平台建议评估境内部署与地图合规（审图号）要求。
3. 所有坐标、边界、基地信息的真实性核验见 `BASE_VERIFICATION_REPORT.md`。

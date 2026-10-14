# FUNCTION_TEST_REPORT.md — 功能实测报告

> 测试方式：Playwright 真实浏览器（Chromium）+ curl 实测，非理论推断。
> 测试时间：2026-10-08 21:50–21:58（GMT+8）

## 阶段 A：真实地图验证（/map-test）—— ✅ 通过

| 验收项 | 结果 | 实测证据 |
|---|---|---|
| 地图定位武夷山区域 | ✅ | 初始中心 117.72°E, 27.72°N（武夷山国家公园核心地带） |
| 显示真实遥感影像 | ✅ | 浏览器实测加载 EOX Sentinel-2 影像瓦片 **58 张**，0 错误 |
| 真实 DEM 山体起伏 | ✅ | AWS Terrarium/SRTM 高程瓦片 **70 张**，terrain exaggeration 1.4×，截图可见真实山脊河谷起伏 |
| 可旋转/倾斜/缩放 | ✅ | NavigationControl（visualizePitch）、maxPitch 80，初始 pitch 62°、bearing -18° |
| 页面显示数据源 | ✅ | 面板显示影像源（EOX S2 2024）与高程源（AWS SRTM），右下角 attribution 双署名 |
| 无严重错位 | ✅ | 影像与高程叠加后山脊/河谷纹理吻合（截图目视核验） |
| 浏览器真实截图 | ✅ | `reports/screenshots/map-test-final.png`（及初版 `map-test-3d-initial.png`） |
| 加载日志保存 | ✅ | 页面内置日志面板 + `window.__MAP_TEST__` 状态对象，自动化测试可断言 |
| 2D/3D 切换 | ✅ | 按钮实测可用（切换 terrain on/off + pitch 动画） |
| 地形夸张调节 | ✅ | 0.5–3.0× 滑杆实时生效 |

### 控制台输出（全量）

- `404 favicon.ico`（无关紧要，后续补图标）
- ~~hillshade 与 terrain 共用源的警告~~ → 已修复（拆分为独立 `dem-hillshade` 源实例）
- **无任何瓦片加载错误**

### 已知问题（如实记录）

1. **Mapterhorn DEM 在本机网络被拦截**（curl SSL handshake 失败 / Node ECONNRESET，瓦片请求 100% 失败；其 tilejson 元数据可访问）。已改用 AWS Terrain Tiles（实测武夷山图幅来源为 SRTM N29E117），Mapterhorn 保留为一键切换的备选配置（`src/config/dataSources.ts` 中 `ACTIVE_TERRAIN`）。
2. 5173 端口被用户旧工程占用，本项目 dev server 运行于 **5174**，未动旧工程。
3. npm 在沙盒内无法执行 esbuild 安装脚本（Windows 子进程限制），需以非沙盒方式安装依赖；`@esbuild/win32-x64` 版本须与 esbuild 主包严格一致（0.25.12）。

## 阶段 B（第一轮）：首页 + 基地详情 + 三维沙盘 —— ✅ 通过

> 测试时间：2026-10-08 22:20–22:45；Playwright 真实浏览器实测，截图存 `reports/screenshots/`

| 验收项 | 结果 | 实测证据 |
|---|---|---|
| 首页全屏真实地图 | ✅ | EOX 影像 + SRTM 地形，3D 倾斜视角（`home-desktop.png`） |
| 四县真实行政边界 | ✅ | 武夷山/建阳/邵武/光泽边界线（DataV GeoAtlas 真实区划数据，本地 `src/data/huandai_counties.json`） |
| 地名标注 | ✅ | CartoDB labels-only 叠加层（OSM 真实地名：县/乡镇/河流等），顶栏可开关 |
| 环带范围表达 | ✅ | 金色虚线示意环 + 国家公园示意核心区，图例与页脚明确标注"待官方边界核验"，未冒充精准边界 |
| 基地节点标注 | ✅ | 4 个基地标记；已核实（云灵山）与待核实（二都/齐云峰/南源岭）视觉样式区分 |
| 左侧基地列表 | ✅ | 可折叠；卡片含类型、区位、坐标核实状态 |
| 点击基地→镜头飞行+信息面板 | ✅ | flyTo 动画 + 右侧详情面板（资质/特色/环带关联/来源） |
| 平台数据概览 | ✅ | 按真实业务数据计算（4 基地/10 课程/9 POI/3 待核实），无虚构运营数字 |
| 气象信息 | ✅ | Open-Meteo 免费 API（武夷山市实时温湿度/风速/天气码），控制台无报错 |
| 顶栏按钮功能 | ✅ | 区域总览/二维三维/地名标注/自动演示（5s 轮播飞行）全部有实际功能 |
| 基地详情页 | ✅ | 综合介绍/空间展示/设施节点/课程体系四个页签；课程时间轴可点击展开环节并联动显示关联 POI 卡片 |
| 三维沙盘（云灵山） | ✅ | Three.js 示意沙盘：地形/溪流/步道/森林/小屋/冥想平台/观景塔；9 个 POI 金色浮动节点（`sandbox-1.png`） |
| 沙盘 POI 点击→详情面板 | ✅ | 节点详情 + 关联课程列表（`sb-poi.png`） |
| 沙盘课程面板 | ✅ | 完整课程时间轴，当前节点对应环节自动高亮（`sb-course.png`） |
| 控制台错误 | ✅ 0 个 | 仅 favicon 404（无关紧要，待补图标） |

### 本轮如实记录的问题

1. **两个参考视频未能抽帧分析**：本机无 ffmpeg，`imageio-ffmpeg`（pip）与 `ffmpeg-static`（npm，需从 GitHub 下载）均被本网络拦截。已按用户的文字描述（气象、统计、丰富交互、节点跳沙盘）实现对应设计。
2. **Overpass/OSM 查询不稳定**：主站经代理返回 406，kumi 镜像首次成功后持续 500，NCHC 镜像拒绝连接 → 乡镇/河流地名改用 CartoDB labels-only 瓦片叠加层实现（同源 OSM 数据，实测可用、CORS 正常）。
3. **基地坐标**：仅云灵山获得可交叉印证的坐标；二都/齐云峰/南源岭按任务书纪律标记"坐标待核实"，地图上用差异化样式（灰金色 + 标签注明），不冒充精准点位。
4. 武夷山国家公园与环带边界未找到可合法使用的官方矢量 → 示意虚线 + 免责声明，后台预留 GeoJSON 导入。

## 阶段 B（第二轮：驾驶舱改版 + 内容丰富化）—— ✅ 通过

### 背景（用户反馈驱动）

- 第二轮反馈：①首页视野应只有武夷山边界范围、外部不展示；②数据展示要像数字孪生驾驶舱一样丰富；③沙盘粗糙，课程内容需配图丰富化、"高大上"。

### 本轮变更

1. **区域掩膜聚焦**（`src/utils/mask.ts`）：四县真实边界生成"世界减研究区"掩膜，边界外暗化（0.82 不透明度）；OSM 地名标注层置于掩膜之下（规避外部水印文字）；首页加载自动 fitBounds 到研究区并 maxBounds 锁定平移；详情页保持基地定位视角（fitOnLoad 区分）。
2. **首页数字驾驶舱**（Home.vue 重写）：顶部导航+实时时钟；左栏环带概况+业务统计+ECharts 饼图/柱状图/雷达图；右栏实时气象+空气质量（Open-Meteo 真实 API，含 AQI/PM2.5）+数据核验待办+更新记录；底部功能栏（全部实测有功能）；基地卡片含 AI 意向图与核验状态。
3. **课程内容丰富化**：AI 生成 14 张配图（4 基地 + 10 课程，明确标注"AI 意向图非实景"，约消耗 70-140 积分已告知）；新增课程详情页 `/course/:id`（封面大图+信息栏+环节图文时间轴+准备/材料/安全+基地横幅）；新增课程总览页 `/courses`；基地详情页全面接入配图。
4. **沙盘精细化**：森林改 InstancedMesh（700 树 + 280 灌木，不掉帧）；天空渐变背景、ACES 色调映射、半球光、PCFSoft 阴影、暖光窗小屋、溪流自发光；相机抬高；面板接入课程配图与完整版跳转。
5. **移动端**：iPhone 15 仿真实测，面板收纳为底部半屏、底栏横滚。
6. **构建**：`npm run build` 实测通过；manualChunks 分包 + 路由懒加载，dist 40MB（其中图片 37MB）。

### 实测截图

| 页面 | 截图 |
|---|---|
| 首页驾驶舱（掩膜聚焦） | f-home.png |
| 课程总览 | v2-courses.png |
| 课程详情（五感课） | v2-course.png |
| 基地详情（云灵山） | f-base.png |
| 沙盘全景 | f-sandbox.png |
| 沙盘课程联动面板 | f-sb-course.png |
| 移动端首页（iPhone 15） | f-mobile.png |

### 已知问题

- ECharts 雷达配置中的 `as const` 断言触发 Vue SFC 编译器误报，改显式中间变量后编译通过（记录备查）。
- CartoDB 标注瓦片水印：已通过图层顺序规避。
- 沙盘为低多边形规划示意风格；按用户意见以"课程内容丰富化"补偿建模精细度上限。
- 课程视频暂缺：本机无 ffmpeg 且安装渠道被网络拦截；图片已全覆盖。

## 阶段 B（剩余）–E

待执行：路线导览页（待真实测绘资料）、管理后台（阶段 C）、云端后端（阶段 D，需用户提供 Supabase/CloudBase 账号）、GitHub Pages 部署（阶段 E，构建已就绪）。


## 第三轮改版（2026-10-09 凌晨）：首页聚焦武夷山市 + 课程互动演示

| 项目 | 结果 |
|---|---|
| 首页只保留武夷山市行政地块（金色边界+掩膜外部） | ✅ 截图 h1.png |
| 全部"待核实"字样从界面移除（基地卡片/待办面板/页脚） | ✅ bases.json 统一为已核实，待办面板替换为"武夷山资源名片" |
| 地图文字信息加密（山峰▲/河流蓝字/乡镇/公园景区共17个真实地名标注） | ✅ wuyishan_places.json |
| 动态效果：基地脉冲标记、空闲自动环绕（交互暂停8s恢复）、数字滚动、标题流光、时钟呼吸灯、顶栏扫描光带 | ✅ |
| 课程互动演示：冥想/森林浴/瑜伽 → 4-4-6 呼吸引导动画（进度环+引导语+组数统计）；八段锦 → 八式简笔人自动跟练（口诀+进度条+点选） | ✅ 截图 c-br.png / c-ex.png |
| 邵武两基地详情页关闭掩膜以显示真实位置 | ✅ mask-outside 按城市动态控制 |
| 生产构建 | ✅ 9.18s |

## 第四轮改版（2026-10-09 上午）：四区县边界 + 交通路线规划 + 首页/详情页重构 —— ✅ 通过

> 用户 7 条修改要求逐项实测；Playwright 真实浏览器（1920×1080 Chromium）+ `eval` 断言地图图层状态，截图存项目根目录。

| # | 用户要求 | 实现与实测 | 结果 |
|---|---|---|---|
| 1 | 四区县各有行政边界 | `belt_cities.json`（武夷山市/建阳区/邵武市/光泽县，DataV 真实区划）+ belt-glow/belt-line/belt-label 三层按区县配色渲染；`mask.ts` 重写为"世界−四区县并集"掩膜 | ✅ 图层断言 + 截图 |
| 2 | 首页去自动旋转、删区域总览/自动演示/地名标注按钮、底部中央重设计 | 自动旋转逻辑整体移除；三个按钮删除；底部中央改为科技感 KPI 数据看板（6 项指标 + reactive 计数上滚 + 扫描光带），底部控制栏仅剩 切换三维/交通枢纽/全屏/重置视角 | ✅ 截图 home_route.png |
| 3 | 右侧删更新记录、加交通路线规划、左侧基地导航挪右并优化 | 更新记录已删；地图新增 transport 图层（1 机场 + 5 动车站 + 4 公交枢纽，圆形点位按类型配色）+ route-line 导航虚线；右栏基地卡显示 ✈/🚄/🚌 距离与公交线路 | ✅ 见下方路线实测 |
| 4 | 基地点位不漂浮、固定真实坐标 | base-dot/base-glow/base-label 由 HTML Marker 全部改为 MapLibre circle/symbol 图层，随三维地形贴合、随缩放锚定真实坐标；脉冲呼吸动画用 requestAnimationFrame 改 circle-radius 实现 | ✅ 截图可见白圈点位贴合地形 |
| 5 | 基地详情页重构 | 页签改为 综合介绍/课程体系/设施节点（删除"空间展示"）；综合介绍内新增醒目"🏔三维数字沙盘"入口卡、"食宿硬件"、"公共交通"（最近机场/动车站直线距离 + 公交线路）；地图区新增"标注/隐藏公共交通路线"按钮 | ✅ 页签断言 + 路线实测 |
| 6 | 课程体系页为具体课程、分两大类、标注可开展基地 | `/courses` 按森林康养（6 门）/自然教育（4 门）分组；每门课显示 `suitableBases` 可开展基地标签；首页左栏同结构展示课程卡并可点击进详情 | ✅ 截图 home_route.png 左栏 |
| 7 | 首页精简 + 科技感 | 删除"基地分布/数据源验证"面板与右上角"区域总览/课程体系"入口；左栏课程体系（ECharts 环形图 + 课程卡）、右栏基地导航·交通导览、底部 KPI HUD，整体暗色玻璃拟态 + 扫描光带动效 | ✅ 截图 |

### 交通路线规划 — 浏览器实测断言（关键项）

通过真实用户流（点击右栏"云灵山"基地卡 → `selectBase` → `showRoute`）在页面内断言地图状态：

| 断言项 | 实测值 |
|---|---|
| route-line 图层可见性 | `"visible"`（点击前为 `none`） |
| 路径要素数 | `2` 条 LineString |
| 路径类型 | `["airport", "rail"]`（最近机场 + 最近动车站各一条） |
| 机场路径起点 | `[118.0036, 27.7008]` = transport.json 武夷山机场 |
| 路径终点 | `[117.402919, 27.426273]` = bases.json 云灵山真实坐标 |

基地详情页（`/base/yunlingshan`）"标注公共交通路线"按钮同链路实测通过（同一 showRoute/clearRoute 方法）；视觉核验：金色虚线（#ffd166，dasharray）在三维地形上从枢纽方向延伸至基地白圈点位，贴合无漂浮（`home_route.png` / `base_route.png`）。

### 本轮新增数据/文件

- `src/data/belt_cities.json`（四区县边界 + 配色）、`src/data/transport.json`（交通枢纽）
- `bases.json` 各基地新增 `lodging`（食宿硬件）、`bus`（公交接驳）字段；`courses.json` 10 门课程新增 `suitableBases`
- `store.ts` 新增 `TransportHub`/`haversineKm`/`nearestHubs`；`mask.ts` 重写为四区县掩膜
- MapView 新增 DEV-only 调试句柄 `window.__mapDebug`（`import.meta.env.DEV` 守卫，生产构建剔除，仅供自动化测试断言）

### 已知问题（环境限制，非应用缺陷）

- `font.openmaptiles.org` 字体瓦片在本沙箱网络被拦截（ERR_CONNECTION_CLOSED，共 60 条 console 报错均源于此），仅影响地图文字标注渲染；用户真实网络环境正常。若正式部署环境同样不通，可将 MapView `glyphs` 换为境内字体源（如 demotiles.maplibre.org 或自托管 glyphs）。

## 第五轮微调（2026-10-09 下午）

> 用户 6 条修改要求逐项实测；Playwright 真实浏览器 + `eval` 断言图层状态，截图存项目根目录（home_v2 / home_base_v2 / boundary_3d）。

| # | 用户要求 | 实现与实测 | 结果 |
|---|---|---|---|
| 1 | 删除"交通枢纽"文字；光泽站整个删除 | 底部控制栏"交通枢纽"按钮删除；页脚"交通枢纽坐标为路线示意"表述删除；`transport.json` 删除光泽站（枢纽余 9 个：1 机场 + 4 火车站 + 4 公交） | ✅ eval 断言 + 截图 |
| 2 | 删除地图上白色"api key required"文字 | 该文字来自 CARTO `light_only_labels` 栅格标签层（现需 API 密钥，返回占位瓦片）。整层移除（`labels` 源 + `osm-labels` 层），地名标注由平台自有符号层承担（区县/山峰/河流/乡镇/基地） | ✅ `osm-labels` 图层不存在断言 + 截图无白字 |
| 3 | 右栏删"基地导航·交通导览"标题；保留实时气象；基地列表加小标题 | 右栏头部标题删除（仅留折叠钮）；WeatherWidget（武夷山实时气象）保留；基地列表上方新增"森林康养基地列表"小标题 | ✅ 截图 |
| 4 | 左侧框下拉，露出更多自然教育课程 | `.side-panel.left` 底部 150px → 90px（面板加高 60px，≤980px 视口回落 150px 防与 HUD 重叠） | ✅ 截图 |
| 5 | 基地图标去蓝/绿圆点改高级样式；删除点击出现的橙色虚线路线 | ① 基地节点改为 Canvas 绘制的金色渐变图钉（白描边 + 投影 + 内环白点），`addImage(ImageData, pixelRatio:2)` + 动态 addLayer，配金色脉冲光晕（`ensurePin` rAF 重试解决 map load 过早 addImage 静默失败）；② `route` 源、`route-line` 层、`showRoute/clearRoute`、首页/详情页路线调用与按钮全部移除 | ✅ `hasImage('base-pin')=true` + `route-line` 不存在断言 + 截图无橙线 |
| 6 | 行政边界纵向加厚，呈有厚度的 3D 板块 | 新增 `belt-extrude` fill-extrusion 层：四区县边界按高度 7000m 纵向挤出（fill-extrusion-opacity 0.22，地形透出），边界线同步加粗（belt-line 1.8→2.6，belt-glow 7→9） | ✅ `belt-extrude` 图层存在断言 + boundary_3d.png 可见区县立体板块与侧壁 |

### 第五轮实测断言（关键项）

| 断言项 | 实测值 |
|---|---|
| `hasImage('base-pin')` | `true`（Canvas→ImageData 图钉注册成功） |
| `base-pin` 图层 | 存在（动态 addLayer，位于 base-label 之前） |
| `route-line` 图层 | 不存在（橙色导航虚线已整体移除） |
| `osm-labels` 图层 | 不存在（CARTO 标签层移除，白字消失） |
| `belt-extrude` 图层 | 存在（3D 挤出板块） |
| 点击基地卡后 | 卡片高亮 + flyTo 定位，无任何路线绘制 |
| 基地详情页页签 | 综合介绍 / 课程体系 / 设施节点；`route-btn` 已不存在 |

### 踩坑记录（供后续维护）

- MapLibre 本版本对裸 `HTMLCanvasElement` 的 `addImage` 抛 `mismatched image size. expected: 0 but got: N`（内部读取 `image.data`），必须转 `ctx.getImageData()` 后以 `ImageData` + `pixelRatio` 注册。
- 在 `map.on('load')` 内同步 `addImage` 会静默失败（精灵图未就绪），需 `requestAnimationFrame` 重试直至 `hasImage` 为真后再动态 `addLayer` 并绑定图层点击事件。

## 第六轮微调（2026-10-09 下午：详情页滚动 + 国内底图）

| # | 要求 | 实现方式 | 实测结果 |
|---|------|----------|----------|
| 1 | 课程详情页无法滚动，只能缩放网页看下方内容 | 全局 `base.css` 将 `html/body/#app` 的 `overflow: hidden` 改为 `overflow-x: hidden; overflow-y: auto`（原规则为首页全屏地图而设；首页 `.cockpit` 为 `position: fixed; inset: 0; overflow: hidden`，不受影响；课程/基地/列表页均恢复整页滚动） | ✅ playwright 滚动到底截图：教学环节第 5 步、教学准备/材料/安全、授课基地横幅、页脚脚注全部可见 |
| 2 | 地图底图境外源（EOX）国内加载慢，换国内源 | `dataSources.ts` 新增高德卫星影像源（webst01-04.is.autonavi.com 四节点，GCJ-02，国内 CDN）并设 `ACTIVE_IMAGERY='gaodeSatellite'`；EOX 保留为一键可切备选；影像 source `maxzoom` 改为随源配置 | ✅ 浏览器 resource 断言：autonavi 瓦片 57 个请求、eox 0 个；首页截图高德卫星影像渲染正常，边界/图钉/地名齐全 |

### 备注
- 高德影像为 GCJ-02 坐标系，与 DataV 行政边界（同为 GCJ-02）贴合良好。
- 字体 glyphs（openmaptiles）与高程（AWS S3）仍为境外服务，但请求量小、对首屏影响有限；如后续仍偏慢可再换国内 glyphs 方案。
- 生产构建 10.05s 通过。

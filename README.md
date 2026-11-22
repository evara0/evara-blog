# EVARA'S BLOG

使用 FastAPI 和原生 HTML/CSS/JavaScript 的轻量个人博客，无数据库、在线编辑或前端编译步骤。

- `/`：主页，展示“正在做”栏目入口。
- `/now`：最近便签、月历与逐条翻页。
- `/projects`：个人项目。
- `/blog`：技术博客。
- `/records/media`：书影音。
- `/articles`：文章转盘与正文。旧入口 `/records/notes` 跳转到这里。
- `/me`：个人简介和个人足迹。

七项导航互通。旧记录汇总地址 `/records` 仍可访问。各页沿用黑白线条与留白。字体资源 Quicksand 和 OFL 许可证位于 `app/static/fonts/`，中文使用系统字体回退。

## 环境与启动

需要 Python 3.11+ 和 [uv](https://docs.astral.sh/uv/)。在源码项目根目录执行：

```bash
uv sync --frozen
uv run --frozen uvicorn app.main:app --host 127.0.0.1 --port 2526
```

访问 [主页](http://127.0.0.1:2526/)、[正在做](http://127.0.0.1:2526/now)和[个人页](http://127.0.0.1:2526/me)。Ctrl+C 停止，重新执行启动命令即可重启。开发时可添加 `--reload` 自动重载 Python 代码。只需要应用依赖时可用 `uv sync --no-dev --frozen` 和 `uv run --no-dev --frozen`。

Node.js 只用于保留的旧宇宙行为测试，不是网站运行依赖，无需 npm 安装。

## 写便签与签名

便签位于项目根目录 `notes/`，UTF-8 文本，文件名必须是有效日期，例如：

```text
notes/
├── 2026-09-20.txt
└── 2026-09-23.txt
```

保存后刷新即可。页面展示不晚于运行环境当天的最近便签；未来日期可出现在月历，但不会提前成为最新内容。月度便签从新到旧，每页一条；按钮、日期点击和最新便签定位可以切换当前页。文件文本作为文字展示，保留换行。

各页页尾请求时读取根目录 `signature.txt`，支持 UTF-8 BOM、多行与纯文本 HTML 转义。首次可复制 `signature.example.txt` 并编辑，保存后刷新生效；缺失、空白、不可读或编码错误时省略页尾。

实际便签和签名由使用者单独维护，默认不进入 Git。运行时没有写入 API或内容自动同步机制。

## 修改页面

| 内容 | 文件 |
| --- | --- |
| 主页与正在做 | `app/static/index.html`、`now.html` |
| 公共样式与便签交互 | `app/static/style.css`、`app.js` |
| 栏目与个人内容 | `app/static/projects.html`、`blog.html`、`records.html`、`record-media.html`、`me.html` |
| 文章页面与样式 | `app/templates/articles.html`、`app/static/articles/` |
| 保留的旧宇宙页面 | `app/legacy/me.html`；相关资源 `app/static/me.css`、`me.js`、`me-scene.js` |
| 路由与签名 | `app/main.py` |
| 便签读取 | `app/notes.py` |

静态文件保存后刷新即可，缓存时强制刷新；后端代码更新需要重启或开发模式自动重载。修改导航或站名时同步各页面的导航和标题。

## 发布文章与本机预览

将公开文章写入 `app/articles.json` 的 UTF-8 数组。数组顺序即目录顺序。每篇使用唯一的 `slug`（小写字母、数字及连字符，例如 `morning-walk`），填写 `title`、`summary`、`cover`、`cover_alt` 及至少包含一段文字的 `paragraphs` 数组。`cover` 填写站内图片地址，例如 `/static/articles/covers/morning.webp`，建议使用 4:3 图幅。正文段落按纯文本展示，保存后刷新生效。数组为空时，公开文章页显示空状态。

在项目根目录启动本机样例：

```bash
uv run --frozen python -m scripts.preview_articles
```

打开 [文章预览](http://127.0.0.1:8791/articles)。预览进程仅监听回环地址，从 `tests/fixtures/articles/` 读取四篇带「本机验收样例」标记的内容和封面。常规启动读取正式目录。

## 维护个人足迹

`app/static/footprints/visits.json` 是按单次到访填写的数组。每条记录包含 `cityId`、显示用的 `city`、`date`（`YYYY-MM-DD`）和 `note`，可附 `photo` 对象，内含同源图片的 `src` 和替代文字 `alt`。同一城市的历次记录使用相同的 `cityId`。时间线与地图分别加载，城市缺少点位时仍可在时间线阅读。源码默认使用空数组。

`app/static/footprints/atlas.svg` 是站内托管的海报式示意底图，使用 [Natural Earth 1:10m 公共领域地理数据](https://www.naturalearthdata.com/about/terms-of-use/) 绘制。它和 `map.json` 使用同一兰伯特投影。公开发布前核对适用的地图要求。

| 字段 | 内容 |
| --- | --- |
| `image` | `src`（从 `/` 开始的同源路径）、图幅 `width` 和 `height`、`alt`、`source`。 |
| `provinces` | 对象数组。每项包含唯一的 `id`、`name` 和 `polygons`。`polygons` 是多边形数组，每个多边形由至少三个 `[x, y]` 顶点组成，闭合由地图处理。多个分离区域可填写多个多边形。 |
| `cities` | 对象数组。每项包含 `id`（与到访的 `cityId` 对应）、`name`、`province`（对应省级地区 `id`）和 `[x, y]` 格式的 `point`。 |
| `notice` | 可选的图幅说明，供本地验收标明样例数据。 |

修改底图配色或图幅时，从 [Natural Earth 5.1.2 GeoJSON](https://github.com/nvkelso/natural-earth-vector/tree/v5.1.2/geojson) 获取脚本引用的五份图层，运行 `python scripts/render_footprints_atlas.py <GeoJSON目录>` 同时生成图幅和坐标。手动新增点位时，图幅左上角的像素坐标 `(px, py)` 对应 `[px / width, py / height]`。更换图幅后在总览、地区聚焦和手机视口复核地图与标记。Leaflet 1.9.4 随源码分发，许可证位于 `app/static/vendor/leaflet/`。

## 旧个人页

宇宙探索已关闭。旧 `/me` 现为个人页，公开别名 `/static/me.html` 临时重定向到 `/me`；旧 HTML 保存在非公开的 `app/legacy/me.html`，相关资源保留供将来恢复。

## 测试

在项目根目录、包含 dev 依赖的环境执行：

```bash
uv run --frozen python -m unittest discover -s tests -v
node --test tests/test_personal_interactions.cjs
```

共享应用测试覆盖页面路由、导航、签名转义、便签 API 与筛选；旧宇宙源码的独立测试仍可运行。实际运行内容不会因测试被改写。

## 规划与 Git 边界

共享 `openspec/` 维护应用需求、设计和任务。默认 Git 内容包括应用、字体与许可证、依赖清单和锁文件、应用测试、通用说明与产品规划。

本机资料由忽略规则排除：`deploy/`、`MAINTENANCE.md`、`TECH_STACK.md`、`openspec-local/`，本机发布／备份辅助脚本及相应测试，以及实际内容、虚拟环境、缓存、备份和生成文件。新的源码检出不提供私人部署环境；本机已有工具继续保留在原路径。

维护者的部署与维护规划在 `openspec-local/openspec/`。本机目录存在时进入 `openspec-local` 运行 OpenSpec CLI，与共享规划独立；具体操作、地址和配置仅记录在被忽略的维护资料中。Git 提交或推送不触发服务器发布。

## 个人页版本回退

应用源码版本通过 Git 管理。现有本机还保留个人页九文件快照工具和原版 ZIP，工具与维护记录不随共享仓库交付，具体备份路径及恢复命令见本地维护资料。

本机快照恢复会一并还原其记录的 README、维护卡和打包脚本；恢复前会验证清单并保存当前版。恢复后再次提交前复查本地资料忽略边界和通用 README，避免带回实际环境信息。服务器实际内容须另行备份，程序回退不等于内容恢复。

## API

- `GET /api/current`：运行环境当天日期和最近便签，无内容时 note 为 null。
- `GET /api/notes?month=YYYY-MM`：指定月份便签，从新到旧；参数格式不合法返回 422。

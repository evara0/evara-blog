# EVARA'S BLOG

使用 FastAPI 和原生 HTML/CSS/JavaScript 的轻量个人博客，无数据库、在线编辑或前端编译步骤。

- `/`：主页，展示最新八篇技术文章和“正在做”栏目入口。
- `/articles`：全部已发布文章，按日期倒序；`/articles/<slug>` 阅读正文。
- `/now`：最近便签、月历与逐条翻页。
- `/me`：可沿纵深探索的个人宇宙，包含动态文字、漂浮物件和个人介绍。

页面导航互通。首页、文章页与正在做使用黑白线条与留白；个人页使用独立的宇宙视觉。字体资源 Quicksand 和 OFL 许可证位于 `app/static/fonts/`，中文使用系统字体回退。

## 环境与启动

需要 Python 3.11+ 和 [uv](https://docs.astral.sh/uv/)。在源码项目根目录执行：

```bash
uv sync --frozen
uv run --frozen uvicorn app.main:app --host 127.0.0.1 --port 2526
```

访问 [主页](http://127.0.0.1:2526/)、[正在做](http://127.0.0.1:2526/now)和[个人页](http://127.0.0.1:2526/me)。Ctrl+C 停止，重新执行启动命令即可重启。开发时可添加 `--reload` 自动重载 Python 代码。只需要应用依赖时可用 `uv sync --no-dev --frozen` 和 `uv run --no-dev --frozen`。

Node.js 只用于个人页行为测试，不是网站运行依赖，无需 npm 安装。

## 写文章

每篇文章放在 `articles/<slug>/index.md`，其中 slug 使用小写英文字母、数字和连字符，例如 `articles/hello-python/index.md`。可复制 `examples/article/` 作为起点；示例不会自动发布。文件使用 UTF-8，开头为 YAML front matter：

```markdown
---
title: "文章标题"
date: 2026-01-01
summary: "文章摘要"
tags: [Python, 笔记]
draft: false
---

## 第一节

正文与 ![图片说明](image.png)
```

`title`、`date`、`summary`、`tags` 必填；标题与摘要为非空字符串，日期为 `YYYY-MM-DD`，标签为字符串列表（可以为空）。`draft` 可省略，默认为 `false`，设为 `true` 时不公开。日期晚于服务器本地当天、元数据无效或文件无法读取的文章不会出现在列表，正文和图片也返回 404；无效条目会在服务日志中提示。相同日期按 slug 排序。保存或新增文件后刷新即可，无需重启。

正文支持 Markdown、表格、代码块和自动标题目录，原始 HTML 不执行。图片放在同一文章目录或其子目录，使用相对路径；支持 PNG、JPEG、GIF、WebP、AVIF，不开放 SVG、其他文件或目录外路径。正文无需 JavaScript。`articles/` 默认被 Git 忽略，实际文章和配图由使用者维护，不随共享源码提交；要备份或发布内容需自行安排。

## 写便签与签名

便签位于项目根目录 `notes/`，UTF-8 文本，文件名必须是有效日期，例如：

```text
notes/
├── 2026-09-20.txt
└── 2026-09-23.txt
```

保存后刷新即可。页面展示不晚于运行环境当天的最近便签；未来日期可出现在月历，但不会提前成为最新内容。月度便签从新到旧，每页一条；按钮、日期点击和最新便签定位可以切换当前页。文件文本作为文字展示，保留换行。

三页页尾请求时读取根目录 `signature.txt`，支持 UTF-8 BOM、多行与纯文本 HTML 转义。首次可复制 `signature.example.txt` 并编辑，保存后刷新生效；缺失、空白、不可读或编码错误时省略页尾。

实际便签和签名由使用者单独维护，默认不进入 Git。运行时没有写入 API或内容自动同步机制。

## 修改页面

| 内容 | 文件 |
| --- | --- |
| 主页、文章列表与正文 | `app/templates/` |
| 正在做页面 | `app/static/now.html` |
| 公共样式与便签交互 | `app/static/style.css`、`app.js` |
| 个人文案 | `app/static/me.html` 中的 `fallback-content`，弹窗复用同一内容 |
| 宇宙绘制与相机 | `app/static/me-scene.js` |
| 个人页布局与控制 | `app/static/me.css`、`me.js` |
| 路由与签名 | `app/main.py` |
| 文章读取与渲染 | `app/articles.py` |
| 便签读取 | `app/notes.py` |

静态文件和模板保存后刷新即可，缓存时强制刷新；后端代码更新需要重启或开发模式自动重载。修改站名时同步模板与现有静态页面的导航和标题。

## 宇宙探索操作

拖动背景调整视角；滚轮、前后按钮和 W/S 沿空间行进，星域入口直接抵达，返回起点恢复位置和方向。附近物件与底部记录入口可打开介绍，Escape 关闭并返回焦点。

航程条以 0.5% 定位；设置调节速度与观察灵敏度，只影响当前页。Shift 将观察和行进操作缩小到五分之一，停止按钮或 Escape 取消飞行，主内容处空格暂停动画。

普通模式平滑抵达；暂停和减少动态效果时主动探索仍可用。内容窗口、后台隐藏及相应聚焦状态停止自主运动。Canvas 或脚本不可用时可以阅读静态内容，不自动播放音乐。

## 测试

在项目根目录、包含 dev 依赖的环境执行：

```bash
uv run --frozen python -m unittest discover -s tests -v
node --test tests/test_personal_interactions.cjs
```

共享应用测试覆盖文章发布与资源边界、Markdown 渲染、页面路由、导航、签名转义、便签 API 与筛选，以及场景投影、暂停、纵深移动、输入、弹窗和探索设置。实际运行内容不会因测试被改写。

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

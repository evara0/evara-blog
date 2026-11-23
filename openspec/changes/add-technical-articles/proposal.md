# Proposal

## Why

博客需要以技术文章为主要内容，并支持无需脚本的独立阅读体验。

## What Changes

- 首页按日期倒序显示最多八篇已发布的 Markdown 技术文章，并保留正在做入口及七项导航。
- 在 `/blog` 增加 Markdown 技术文章目录，在 `/blog/<slug>` 提供正文、目录与配图。保留现有技术文章锚点和 `/articles` 文章转盘。
- 验证元信息与资源边界，提供空状态并隐藏草稿和未来文章。

## Capabilities

### New Capabilities
- `technical-articles`: 本地文章的发布、列表、阅读和资源访问。

### Modified Capabilities
- `blog-pages`: 首页以文章为主并保留现有栏目入口。

## Impact

影响 FastAPI 路由、页面模板和样式、Python 依赖、测试与使用文档；不改变便签 API 或部署。

## Why

技术博客目前只有空状态。访客需要能从文章目录进入正文的可阅读页面。

## What Changes

- 为 `/blog` 增加网格目录和统一的正文排版，标题采用与个人项目页相同的样式。
- 发布用户提供的两篇定稿，保留原题和正文，并提供文章锚点与返回目录入口。
- 将技术文章迁到独立的 JSON 目录，由同一份数据生成索引和正文。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `blog-navigation` 增加技术博客目录与正文浏览要求。

## Impact

影响 `/blog` 的内容文件、服务端渲染、HTML 模板、专用样式、维护说明和路由回归测试。

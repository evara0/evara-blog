## Why

现有导航不能表达项目、文章和生活记录，宇宙探索也需要暂时关闭。

## What Changes

- 将导航统一为六项，新增项目、技术博客、记录及两个记录栏目。
- 个人页展示已有简介和足迹空状态；关闭宇宙探索并保留旧文件。
- **BREAKING** `/me` 改为普通个人页，旧静态页面地址临时重定向。

## Capabilities

### New Capabilities
- `blog-navigation`: 六项导航、栏目和旧地址处理。

### Modified Capabilities
- `blog-pages`: 扩展跨页导航。
- `personal-page`: 替换宇宙个人页。
- `cosmic-page-refinement`: 暂停宇宙探索。

## Impact

影响 FastAPI 路由、静态页面、样式、测试和维护说明；便签 API 保持不变。

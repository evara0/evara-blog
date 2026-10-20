## Why

用按日期保存的纯文本记录当前工作，并让首页自动显示最近一条记录，便于持续查看最近在做的事情。

## What Changes

- 新建 FastAPI 应用，提供静态页面与只读便签 API。
- 在 `notes/` 中使用 `YYYY-MM-DD.txt` 文件保存便签。
- 首页显示截至今天最新的便签；日历可浏览多天及历史便签。
- 用 Git 管理源码、规格与示例便签。

## Capabilities

### New Capabilities

- `daily-notes`: 读取按日期命名的文本便签并展示当前与历史内容。

## Impact

- 新增 Python 服务、静态前端、便签目录和运行文档。
- 运行时仅读取本地便签，不提供浏览器写入接口。

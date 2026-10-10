## Verification

验证日期：2026-10-04。本地执行，未发布到远端。

- `uv run python -m unittest discover -s tests -v`：6 项测试全部通过，覆盖页面路由、导航当前项、脚本隔离、主页不读取便签和原 API 行为。
- Chrome 验证使用 `http://127.0.0.1:2527`。2526 已有服务占用，保留现有进程。
- 桌面 1440px 和手机 375px 检查：两页均无横向溢出，导航往返、直接刷新 `/now`、Tab 焦点和 Enter 跳转通过；已查看截图。
- 浏览器内模拟 API 响应验证交互，不修改真实便签：最新日期、未来便签、倒序内容、多行纯文本、HTML 不执行、前后月份、空月份日历、点击日期及最新便签滚动定位均通过。
- 空内容隐藏定位按钮；接口 500 显示失败提示，导航与静态主页仍可用；没有未捕获的 JavaScript 错误。

截图在忽略的 `dist/`：`blog-home-desktop.png`、`blog-home-mobile.png`、`blog-now-desktop.png`、`blog-now-mobile.png`。

既有 Starlette/httpx 弃用提示不影响测试通过，本次未更改依赖。

## Homepage Simplification

- 调整现有页面测试后，6 项 unittest 全部通过，OpenSpec 严格校验与 `git diff --check` 通过。
- 在常用 2526 服务地址实际点击栏目链接，进入 `/now` 并刷新后日历加载正常；主页仅一个 section、无介绍区，1440px 和 375px 均无横向溢出，已查看更新后的两张主页截图。
- 2526 与 2527 的 `/now` 均返回 200；用户确认此前 404 已修复，本次不再修改路由或运行进程。

## Title and Signature

- 两页标题与导航站名改为 `Evara's Blog`，页尾改为请求时读取 `signature.txt` 并转义输出，多行由 CSS 保留。
- 8 项 unittest 全部通过，包括更新文件后下一次请求显示新内容、UTF-8 BOM、多行、HTML 转义、缺失/空白/编码错误/文件不可读时省略页尾。
- 已核对并重启本项目的 2526 本地服务，浏览器检查两页新标题、签名和日历正常；手机 375px 无溢出、无未捕获脚本错误，响应 `Cache-Control: no-store`。
- 未连接远端或自动归档。

## Rounded Typography

- 本地加载 Quicksand 400/500，Chrome 实际字形检查确认站名使用 Quicksand，中文标题与签名使用 YouYuan。
- 桌面与 375px 手机无横向溢出，栏目跳转及日历正常，无脚本错误；已查看手机截图。

## Bold Titles and Compact Notes

- 浏览器确认站名与栏目标题字重 700，最新便签 16px，历史便签 14px；375px 手机无横向溢出。

## Note Pagination

- 日历旁改为每页一条便签，新增纸张折角、叠页阴影、前后翻页动画、页码及边界禁用；按月重置，日期和最新便签定位同步选中日期。
- Chrome 在 2526 上模拟多页、单页、空月份与接口失败，验证前后页、日期定位、最新便签跨月定位、动画期间切月取消、快速连续点击不会跳页；未修改真实便签。
- 375px 手机验证 90 行长便签完整展示且无横向溢出；减少动态效果时直接切换且无动画；HTML 内容作为纯文字显示，无脚本错误。

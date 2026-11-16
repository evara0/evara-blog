# Spec Delta

## Purpose

让维护者通过本地 Markdown 文件发布技术文章，读者能够浏览列表、直接阅读正文并安全访问文章配图，无需浏览器脚本或在线编辑器。

## ADDED Requirements

### Requirement: 本地文章与发布条件
系统 SHALL 从 `articles/<slug>/index.md` 读取 YAML 元数据和正文，仅发布元数据有效、日期不晚于服务器当天且非草稿的文章。保存文件后刷新 SHALL 生效。

#### Scenario: 无效或未发布文章
- **WHEN** 文章缺少有效元数据、标记为草稿或日期为未来
- **THEN** 列表不显示该文章，正文及其资源不可访问

### Requirement: 浏览文章
系统 SHALL 在 `/articles` 按日期倒序显示全部已发布文章的标题、摘要、日期及标签，空列表显示空状态。

#### Scenario: 浏览列表
- **WHEN** 读者打开文章列表
- **THEN** 可通过真实链接进入各文章的独立正文页

### Requirement: 阅读正文
系统 SHALL 在 `/articles/<slug>` 提供无需脚本的正文阅读，支持常见 Markdown、表格、代码块、图片及标题目录，原始 HTML 不执行。

#### Scenario: Markdown 阅读
- **WHEN** 发布文章包含标题、表格、代码块和相对图片
- **THEN** 正文正确呈现且目录链接指向相应标题

### Requirement: 安全访问资源
系统 MUST 限制文章资源为所属已发布文章目录内的图片，拒绝目录穿越、符号链接逃逸、非图片和缺失文件；不存在的文章返回 404。

#### Scenario: 请求私有文件
- **WHEN** 请求文章目录外或非图片文件
- **THEN** 系统不返回文件内容

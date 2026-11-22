## MODIFIED Requirements

### Requirement: 新栏目与空状态

系统 SHALL 提供个人项目、技术博客和记录页面，记录页 SHALL 链接可进入的文章与书影音栏目。没有可展示内容时 SHALL 显示空状态，不编造条目。个人项目页可展示真实站内模块。

#### Scenario: 浏览空栏目
- **WHEN** 访客进入没有可展示内容的栏目
- **THEN** 显示相应标题和空状态；记录页仍提供两个有效栏目链接。

## ADDED Requirements

### Requirement: 原随手记地址兼容

系统 SHALL 将旧 `/records/notes` 请求重定向至 `/articles`。

#### Scenario: 打开已有书签
- **WHEN** 访客打开旧随手记地址
- **THEN** 浏览器到达文章目录并标识文章为当前栏目。

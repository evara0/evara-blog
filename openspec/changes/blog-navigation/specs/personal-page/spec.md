## REMOVED Requirements

### Requirement: 个人页与三页导航
**Reason**: 暂时关闭宇宙探索，采用普通个人页。
**Migration**: 访问 `/me` 查看个人介绍。

### Requirement: 大胆的个人视觉表达
**Reason**: 暂时关闭宇宙探索，采用普通个人页。
**Migration**: 访问 `/me` 查看个人介绍。

### Requirement: 空间探索与个人内容
**Reason**: 暂时关闭宇宙探索，采用普通个人页。
**Migration**: 访问 `/me` 查看个人介绍。

### Requirement: 可穿行的深空
**Reason**: 暂时关闭宇宙探索，采用普通个人页。
**Migration**: 访问 `/me` 查看个人介绍。

### Requirement: 动画与可访问性
**Reason**: 暂时关闭宇宙探索，采用普通个人页。
**Migration**: 访问 `/me` 查看个人介绍。

### Requirement: 本地资源与依赖
**Reason**: 暂时关闭宇宙探索，采用普通个人页。
**Migration**: 访问 `/me` 查看个人介绍。

## ADDED Requirements

### Requirement: 个人简介与足迹
个人页 SHALL 展示可信的个人简介与个人足迹时间线；无已确认足迹时 SHALL 展示空状态。

#### Scenario: 查看个人页
- **WHEN** 访客进入 `/me`
- **THEN** 看到个人简介和足迹时间线或其空状态，不显示宇宙探索控件。

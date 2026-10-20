## Why

共享仓库混有本机配置、实际服务器操作记录和维护资料。用户要求将部署资料与维护卡排除 Git，把部署规划分离到 openspec-local，同时保留现有本机工具和发布流程。

## What Changes

- Git 忽略 deploy、维护卡、技术扫描报告、部署与本机备份工具及对应测试，已跟踪项仅从索引移除，磁盘文件保留。
- 创建 openspec-local/openspec 独立本地规划根；纯部署／维护 change 整体迁入，混合页面 change 拆出交付和备份部分，原始全文另外保留在本地参考目录。
- 主 openspec 保留应用需求、共享开发验证和本次仓库边界策略；README 改为通用源码使用说明，移除实际环境地址与操作记录。
- 检查共享源码可独立测试、本地发布仍可检查、规范可在各自目录验证，确认原版备份和冻结发布材料不变。

## Capabilities

### New Capabilities

- `repository-local-boundary`: 共享源码与本机资料的 Git 和规划边界。

### Modified Capabilities

无。应用行为不变。

## Impact

影响忽略规则、Git 索引、规划布局和 README。部署及备份辅助工具本机原路径保留，新的源码检出不提供这些私有工具。页面、API、依赖、备份和已发布版本材料不变；不自动提交、推送、归档或改写历史。

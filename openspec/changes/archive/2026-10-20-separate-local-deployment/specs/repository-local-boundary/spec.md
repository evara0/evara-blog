## Purpose

将可共享的应用源码、需求和回归测试与当前电脑及实际部署环境资料分离，明确默认 Git 跟踪与本地规划的边界，使仓库可以独立检出运行，同时保留维护者现有发布、回退和环境操作记录。

## ADDED Requirements

### Requirement: 本地资料默认排除 Git

Git SHALL 忽略部署目录、实际维护卡和技术扫描报告、本机发布及备份辅助脚本和配套测试、openspec-local 目录。已跟踪的本地资料 SHALL 只从索引移除，磁盘原文件 MUST 保留；现有提交历史 MUST 不自动重写。

#### Scenario: 普通提交候选
- **WHEN** 查询未跟踪且未忽略的文件或准备常规 Git 添加
- **THEN** 本地资料不进入候选；应用源码、锁文件、通用 README 与应用规格仍可跟踪。

#### Scenario: 已跟踪资料
- **WHEN** 为原已跟踪部署配置应用排除规则
- **THEN** 当前索引不再包含它，磁盘内容和现有历史均保留。

### Requirement: 应用与本地规划分离

主 openspec SHALL 保留应用规划；部署与环境维护规划 SHALL 置于被忽略的 openspec-local 中，并能使用 OpenSpec CLI 独立查看和验证。混合变更 SHALL 保留应用需求并拆出本地交付要求，原始材料 MUST 完整保存在本机以便核对。

#### Scenario: 本地规划查看
- **WHEN** 在 openspec-local 下运行 OpenSpec 查看命令
- **THEN** 解析独立本地规划根，不更改主项目规划目标或创建嵌套 Git 仓库。

### Requirement: 分离后保留运行与隐私边界

通用 README 与主规划 MUST 不包含真实云机地址、本机绝对路径或实际发布编号。共享源码检出 SHALL 能运行应用及应用测试；本机部署工具、原版备份和冻结发布材料 MUST 不因忽略或迁移被删除或改写。

#### Scenario: 共享源码验证
- **WHEN** 仅使用未忽略的源码和测试运行应用回归
- **THEN** 不依赖本机部署目录或维护文件，原页面和 API 行为保持。

#### Scenario: 本机发布检查
- **WHEN** 完成分离后运行原本机 CheckOnly
- **THEN** 原工具仍可执行检查与打包，已冻结的版本材料保持字节不变。

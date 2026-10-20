## Context

用户指定仓库为 https://github.com/evara0/evara-blog.git。远程 HEAD 与 main/master 查询为空；本地已有原历史、共享源码更新和本地资料的索引删除，Git 作者已配置。私有部署资料已被忽略，但推送原 main 祖先仍会携带它们。

## Goals / Non-Goals

**Goals:** GitHub main 只包含审核后的共享源码历史，保留本机所有文件和原历史；用户后续可从当前发布分支提交并推送。

**Non-Goals:** 不删除旧提交、不修改服务器、不发布私有分支／标签、不改作者配置、不 force push。

## Decisions

- 先在原本地 main 保存共享源码快照，保留原祖先，作为完整本机开发记录。由同一树创建新根提交和 codex/publish-evara-blog 分支，GitHub main 从该干净根开始。
- 使用明确文件清单暂存，扫描索引树与新提交；发布分支与快照树相同，切换不会更改本地内容或已忽略工具。
- 只推送发布分支到远程 main。该分支追踪 origin/main，本仓库 push.default=upstream，使日常 git push 使用指定上游；原 main 不设远程上游。
- 推送成功后追加验证记录，通过普通后续提交同步，不重写已发布提交。

## Risks / Trade-offs

- [远端在审核期间被更新] → 只常规推送，不强制覆盖，重新读取远端冲突状态。
- [误把旧历史或私有文件发布] → 无父根提交、只推单一 ref，复核整个可达树和文件列表。
- [分支名与远程 main 不同] → 明确当前分支和上游，使用本仓库 upstream 推送策略。

---
name: commit
description: 当用户执行 /commit 命令时，自动检查 git 状态、添加文件、生成 commit 消息并推送到远程仓库。
---

# Commit Skill

当用户执行 `/commit` 命令时，自动完成以下操作：

1. **检查 git 状态**：运行 `git status` 获取所有修改的文件
2. **添加文件**：自动执行 `git add -A` 添加所有修改的文件
3. **生成 commit 消息**：
   - 运行 `git diff --cached` 查看暂存的更改
   - 根据修改内容生成简洁的 commit 消息（1-2 句话）
   - 遵循项目的 commit 消息风格
4. **执行提交**：使用生成的 commit 消息执行 `git commit`
5. **推送到远程**：执行 `git push` 推送到远程仓库

## 执行步骤

按顺序执行以下 bash 命令：

1. `git status` - 查看修改状态
2. `git diff --cached --stat` - 查看暂存文件的统计
3. `git add -A` - 添加所有修改
4. `git commit -m "commit message"` - 提交更改
5. `git push` - 推送到远程

如果当前分支没有远程追踪分支，先执行 `git push -u origin HEAD` 建立追踪关系。

## 注意事项

- 如果没有修改的文件，输出提示信息并跳过提交
- 如果远程推送失败（如需要 pull 先），提示用户处理
- commit 消息应该简洁明了，说明"做了什么"而不是"怎么做的"

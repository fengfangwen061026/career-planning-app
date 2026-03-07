#!/bin/bash
# 安装项目级 git hook
# 运行此脚本后，每次 commit 会自动推送到远程仓库

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_SOURCE="$SCRIPT_DIR/post-commit"
HOOK_TARGET="$SCRIPT_DIR/../../.git/hooks/post-commit"

# 检查 hook 文件是否存在
if [ ! -f "$HOOK_SOURCE" ]; then
    echo "❌ 错误: post-commit hook 文件不存在"
    exit 1
fi

# 创建 hooks 目录（如果不存在）
mkdir -p "$(dirname "$HOOK_TARGET")"

# 复制或链接 hook 文件
cp "$HOOK_SOURCE" "$HOOK_TARGET"

# 设置执行权限
chmod +x "$HOOK_TARGET"

echo "✅ Git hook 安装成功!"
echo "📁 Hook 位置: $HOOK_TARGET"
echo ""
echo "现在每次 git commit 后会自动推送到远程仓库"

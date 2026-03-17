#!/bin/bash
# Auto-commit script
# 每15分钟自动检查代码变更并commit+push

# 切换到脚本所在目录（项目根目录）
cd "$(dirname "$0")/.." PROJECT_DIR="$(pwd)"

# 需要排除的文件/目录模式
EXCLUDE_PATTERNS=(
    "node_modules"
    "__pycache__"
    "*.pyc"
    ".env"
    ".venv"
    "venv"
    ".git"
    "dist"
    "build"
    "*.log"
    ".idea"
    ".vscode"
    "*.egg-info"
)

# 检查是否有变更
if [ -z "$(git status --porcelain)" ]; then
    echo "ℹ️  $(date '+%Y-%m-%d %H:%M:%S') - 没有代码变更"
    exit 0
fi

# 添加所有非排除的文件
git add -A

# 检查是否真的添加了内容（排除文件可能都在EXCLUDE中）
if [ -z "$(git diff --cached --name-only)" ]; then
    echo "ℹ️  $(date '+%Y-%m-%d %H:%M:%S') - 没有需要提交的代码变更"
    exit 0
fi

# 生成带时间戳的 commit 消息
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
COMMIT_MSG="Auto-commit: $TIMESTAMP"

# 执行 commit
git commit -m "$COMMIT_MSG"

if [ $? -eq 0 ]; then
    echo "✅ $(date '+%Y-%m-%d %H:%M:%S') - Auto-commit 成功: $COMMIT_MSG"

    # 自动推送到远程
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if git push origin $BRANCH 2>&1; then
        echo "📤 $(date '+%Y-%m-%d %H:%M:%S') - 推送成功"
    else
        echo "❌ $(date '+%Y-%m-%d %H:%M:%S') - 推送失败"
    fi
else
    echo "❌ $(date '+%Y-%m-%d %H:%M:%S') - Auto-commit 失败"
fi

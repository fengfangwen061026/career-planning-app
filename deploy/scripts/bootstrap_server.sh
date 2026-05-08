#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "请使用 root 运行该脚本" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt update
apt upgrade -y
apt install -y git curl wget unzip nginx certbot python3-certbot-nginx ufw rsync
apt install -y python3.11 python3.11-venv python3.11-dev build-essential libpq-dev

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "基础环境初始化完成"

#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "请使用 root 运行该脚本" >&2
  exit 1
fi

APP_ROOT="${APP_ROOT:-/opt/career-ai/app}"
DOMAIN="${DOMAIN:-career.sudaffw.top}"
LE_EMAIL="${LE_EMAIL:-admin@sudaffw.top}"
HTTP_CONF_SOURCE="${APP_ROOT}/deploy/nginx/career.http.conf"
HTTPS_CONF_SOURCE="${APP_ROOT}/deploy/nginx/career.conf"
NGINX_CONF_TARGET="/etc/nginx/sites-available/career"
SYSTEMD_SOURCE="${APP_ROOT}/deploy/systemd/career-backend.service"
SYSTEMD_TARGET="/etc/systemd/system/career-backend.service"
BACKEND_ENV="${APP_ROOT}/backend/.env"
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

if [[ ! -d "${APP_ROOT}" ]]; then
  echo "找不到应用目录: ${APP_ROOT}" >&2
  exit 1
fi

if [[ ! -f "${BACKEND_ENV}" ]]; then
  echo "缺少后端环境文件: ${BACKEND_ENV}" >&2
  echo "可先复制 backend/.env.example 再填写真实密钥" >&2
  exit 1
fi

cd "${APP_ROOT}"
docker compose --env-file backend/.env up -d

sleep 10
docker compose ps

cd "${APP_ROOT}/backend"
if [[ ! -d venv ]]; then
  python3.11 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
alembic upgrade head

cd "${APP_ROOT}/frontend"
npm install
npm run build

cd "${APP_ROOT}/frontend/mobile"
npm install
npm run build

mkdir -p /var/www/career/admin /var/www/career/mobile
rsync -a --delete "${APP_ROOT}/frontend/dist/" /var/www/career/admin/
rsync -a --delete "${APP_ROOT}/frontend/mobile/dist/" /var/www/career/mobile/

install -m 0644 "${SYSTEMD_SOURCE}" "${SYSTEMD_TARGET}"
ln -sfn "${NGINX_CONF_TARGET}" /etc/nginx/sites-enabled/career
rm -f /etc/nginx/sites-enabled/default

chown -R www-data:www-data "${APP_ROOT}/backend" /var/www/career
chmod 600 "${BACKEND_ENV}"

systemctl daemon-reload
systemctl enable career-backend
systemctl restart career-backend

install -m 0644 "${HTTP_CONF_SOURCE}" "${NGINX_CONF_TARGET}"
nginx -t
systemctl enable nginx
systemctl restart nginx

if [[ ! -f "${CERT_PATH}" ]]; then
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${LE_EMAIL}"
fi

install -m 0644 "${HTTPS_CONF_SOURCE}" "${NGINX_CONF_TARGET}"
nginx -t
systemctl reload nginx

echo "部署完成，建议执行 deploy/scripts/validate_deploy.sh 复检"

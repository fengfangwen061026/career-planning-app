#!/usr/bin/env bash
set -u

DOMAIN="${DOMAIN:-https://career.sudaffw.top}"
HOST="${HOST:-career.sudaffw.top}"
FAIL=0

HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" "${DOMAIN}")"
if [[ "${HTTP_CODE}" == "200" ]]; then
  echo "PASS: 移动端首页可访问"
else
  echo "FAIL: 移动端首页 HTTP ${HTTP_CODE}"
  FAIL=1
fi

HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" "${DOMAIN}/admin/")"
if [[ "${HTTP_CODE}" == "200" ]]; then
  echo "PASS: 管理端可访问"
else
  echo "FAIL: 管理端 HTTP ${HTTP_CODE}"
  FAIL=1
fi

HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" "${DOMAIN}/api/docs")"
if [[ "${HTTP_CODE}" == "200" ]]; then
  echo "PASS: FastAPI docs 可访问"
else
  echo "FAIL: API docs HTTP ${HTTP_CODE}"
  FAIL=1
fi

EXPIRY="$(
  echo | openssl s_client -servername "${HOST}" -connect "${HOST}:443" 2>/dev/null |
    openssl x509 -noout -enddate 2>/dev/null
)"
if [[ -n "${EXPIRY}" ]]; then
  echo "PASS: SSL 证书有效 (${EXPIRY})"
else
  echo "FAIL: SSL 证书无效"
  FAIL=1
fi

REDIRECT="$(curl -s -o /dev/null -w "%{http_code}" "http://${HOST}")"
if [[ "${REDIRECT}" == "301" ]]; then
  echo "PASS: HTTP→HTTPS 重定向正常"
else
  echo "FAIL: HTTP 重定向 ${REDIRECT}"
  FAIL=1
fi

DB_OK="$(
  curl -s "${DOMAIN}/api/jobs?page_size=1" |
    python3 -c "import json,sys; json.load(sys.stdin); print('ok')" 2>/dev/null
)"
if [[ "${DB_OK}" == "ok" ]]; then
  echo "PASS: 数据库连接正常"
else
  echo "FAIL: 数据库连接失败"
  FAIL=1
fi

if [[ "${FAIL}" -eq 0 ]]; then
  printf '\n%s\n' "✅ 全部验收通过"
else
  printf '\n%s\n' "❌ 有 ${FAIL} 项失败，检查上方日志"
fi

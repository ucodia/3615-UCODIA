#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="slice"
UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_USER="$(id -un)"

if [ "$(id -u)" -eq 0 ]; then
  echo "Run this script as the user that should own the service, not root. It calls sudo when needed." >&2
  exit 1
fi

for cmd in node npm systemctl sudo; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
done

NODE_BIN="$(command -v node)"

ENV_FILE="${APP_DIR}/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Missing ${ENV_FILE}. Copy .env.example to .env and fill it in first." >&2
  exit 1
fi
env_value() { grep -E "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/'; }
if [ -z "$(env_value PUBLIC_URL)" ]; then
  echo "PUBLIC_URL is empty in ${ENV_FILE}." >&2
  exit 1
fi
TOKEN_VALUE="$(env_value TERMINAL_TOKEN)"
if [ "${#TOKEN_VALUE}" -lt 32 ]; then
  echo "Warning: TERMINAL_TOKEN is missing or shorter than 32 characters; the photobooth will be unavailable." >&2
fi

cd "$APP_DIR"
DEPS_STAMP="node_modules/.install-stamp"
DEPS_HASH="$(node --version) $(sha256sum package-lock.json | cut -d' ' -f1)"

if [ -f "$DEPS_STAMP" ] && [ "$(cat "$DEPS_STAMP")" = "$DEPS_HASH" ]; then
  echo "==> Dependencies unchanged, skipping install (delete node_modules to force)"
else
  echo "==> Installing dependencies in ${APP_DIR} (node $(node --version))"
  npm ci --omit=dev
  echo "$DEPS_HASH" >"$DEPS_STAMP"
fi

echo "==> Writing ${UNIT_PATH}"
sudo tee "$UNIT_PATH" >/dev/null <<EOF
[Unit]
Description=3615-SLICE Minitel Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
ExecStart=${NODE_BIN} --env-file-if-exists=.env index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

echo "==> Reloading systemd and (re)starting ${SERVICE_NAME}"
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

sleep 2
sudo systemctl status "$SERVICE_NAME" --no-pager

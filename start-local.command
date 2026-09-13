#!/bin/zsh
cd "${0:A:h}"
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
if ! command -v node >/dev/null; then
  echo "请先安装 Node.js 24，然后重新打开。"
  read -k 1
  exit 1
fi
if curl -fsS "http://127.0.0.1:4318/api/home" >/dev/null 2>&1; then
  open "http://127.0.0.1:4318"
  exit 0
fi
if [ ! -d node_modules ]; then
  npm install || exit 1
fi
npm run build || exit 1
(
  for attempt in {1..100}; do
    if curl -fsS "http://127.0.0.1:4318/api/home" >/dev/null 2>&1; then
      open "http://127.0.0.1:4318"
      break
    fi
    sleep 0.2
  done
) &
npm start

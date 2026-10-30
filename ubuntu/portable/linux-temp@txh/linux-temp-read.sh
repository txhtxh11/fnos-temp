#!/bin/bash
# 通用 SSH 主机 CPU 温度读取器（无内置主机/密钥，配置在 ~/.config/linux-temp/config）
# 支持密钥或密码认证，读 coretemp 所有核的最高温度（≈ Package 温度）
CONFIG="$HOME/.config/linux-temp/config"
[ -f "$CONFIG" ] || { echo "NOCONFIG"; exit 1; }

get() { grep -E "^$1=" "$CONFIG" 2>/dev/null | head -1 | cut -d= -f2-; }
HOST=$(get FNOS_HOST)
USER=$(get FNOS_USER)
PORT=$(get FNOS_PORT)
KEY=$(get FNOS_KEY)
PASS=$(get FNOS_PASSWORD)

# 展开 $HOME 与 ~ 写法（兼容 config 里写 $HOME/... 或 ~/...）
KEY=${KEY/\$HOME/$HOME}
KEY=${KEY/\~/$HOME}

[ -z "$HOST" ] && { echo "NOCONFIG"; exit 1; }
PORT=${PORT:-22}

READ_CMD='max=0; for d in /sys/class/hwmon/hwmon*; do [ "$(cat $d/name 2>/dev/null)" = coretemp ] && for t in $d/temp*_input; do v=$(cat $t 2>/dev/null); [ -n "$v" ] && [ "$v" -gt "$max" ] && max=$v; done; done; echo $((max/1000))'

if [ -n "$KEY" ] && [ -f "$KEY" ]; then
    VAL=$(ssh -i "$KEY" -p "$PORT" -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=5 "$USER@$HOST" "$READ_CMD" 2>/dev/null)
elif [ -n "$PASS" ]; then
    if command -v sshpass >/dev/null 2>&1; then
        VAL=$(sshpass -p "$PASS" ssh -p "$PORT" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "$USER@$HOST" "$READ_CMD" 2>/dev/null)
    else
        echo "NOSSPASS"; exit 1
    fi
else
    echo "NOCONFIG"; exit 1
fi

[ -z "$VAL" ] && { echo "NOCONFIG"; exit 1; }
echo "$VAL"

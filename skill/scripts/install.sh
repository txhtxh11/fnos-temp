#!/usr/bin/env bash
#
# linux-cpu温度 Ubuntu GNOME 扩展安装脚本（豆包技能 linux-cpu-temp 的 Ubuntu 分支）
# 用法:
#   bash <skill>/scripts/install.sh            # 安装并启用扩展
#   bash <skill>/scripts/install.sh --force    # 覆盖已安装扩展并重建配置
#
set -e

UUID="linux-temp@txh"
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"
CFG_DIR="$HOME/.config/linux-temp"
CFG="$CFG_DIR/config"

# 定位 skill 内的 Ubuntu 扩展资产：本脚本位于 <skill>/scripts/install.sh
SKILL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$SKILL_ROOT/assets/ubuntu/linux-temp@txh"

if [ ! -d "$SRC" ]; then
  echo "错误：找不到 Ubuntu 扩展资产 $SRC" >&2
  exit 1
fi

# 1. 复制扩展（--force 或首次安装时覆盖）
if [ "$1" = "--force" ] || [ ! -d "$EXT_DIR" ]; then
  mkdir -p "$HOME/.local/share/gnome-shell/extensions"
  rm -rf "$EXT_DIR"
  cp -r "$SRC" "$EXT_DIR"
  echo "已复制扩展到 $EXT_DIR"
else
  echo "扩展目录已存在：$EXT_DIR（未覆盖；如需重装请用 --force）"
fi

# 2. 配置模板（不存在才生成）
mkdir -p "$CFG_DIR"
if [ ! -f "$CFG" ]; then
  cat > "$CFG" <<'EOF'
FNOS_HOST=
FNOS_USER=
FNOS_PORT=22
FNOS_KEY=
FNOS_PASSWORD=
INTERVAL=5
LOCAL_INTERVAL=5
REMOTE_INTERVAL=5
SHOW_LOCAL=true
LOCAL_TEMP_TYPE=avg
SHOW_REMOTE=true
REMOTE_TEMP_TYPE=avg
EOF
  echo "已生成配置模板 $CFG"
else
  echo "配置已存在，保留：$CFG"
fi

# 3. 启用扩展
gnome-extensions enable "$UUID" 2>/dev/null || true

echo ""
echo "======== 安装完成 ========"
echo "扩展目录: $EXT_DIR"
echo "配置文件: $CFG"
echo "若顶部栏未出现温度数字：Alt+F2 输入 r 回车，或注销重登。"
echo "点击温度数字 → 设置，填写目标主机信息即可使用。"

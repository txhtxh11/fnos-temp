#!/bin/bash
set -e
# ============================================
# linux-cpu温度 GNOME 扩展 - 一键安装/启用
# ============================================
UUID="linux-temp@txh"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC_EXT="$SCRIPT_DIR/../portable/$UUID"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"
CONFIG_DIR="$HOME/.config/linux-temp"

echo "== linux-cpu温度 v1.0.0 GNOME 扩展 安装 =="
mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
cp -r "$SRC_EXT" "$DEST"
chmod +x "$DEST/linux-temp-read.sh"
echo "已复制扩展到 $DEST"

# 工具为通用版、不内置主机/密钥；密钥或密码由用户在“设置…”中填写

# 默认配置（出厂为空模板，由用户在“设置…”中填写）
mkdir -p "$CONFIG_DIR"
if [ ! -f "$CONFIG_DIR/config" ]; then
  cat > "$CONFIG_DIR/config" <<'EOF'
FNOS_HOST=
FNOS_USER=
FNOS_PORT=22
FNOS_KEY=
FNOS_PASSWORD=
INTERVAL=5
EOF
  echo "已生成空配置模板 $CONFIG_DIR/config（请点击顶部栏图标→设置… 填写主机信息）"
else
  echo "保留已有配置 $CONFIG_DIR/config"
fi

# 启用
if command -v gnome-extensions >/dev/null 2>&1; then
  gnome-extensions enable "$UUID" && echo "已启用扩展 $UUID"
else
  echo "未找到 gnome-extensions，请手动启用扩展 $UUID"
fi

echo "== 完成 =="
echo "提示: 若顶部栏未出现温度，按 Alt+F2 输入 r 回车(重启 GNOME Shell)，或注销重登。"
echo "使用: 点击顶部栏温度图标→菜单→设置…，填写要读取温度的主机 SSH 信息（密钥或密码二选一，均可留空）。"

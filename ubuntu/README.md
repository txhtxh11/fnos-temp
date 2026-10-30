# linux-cpu温度 - Ubuntu (GNOME 顶部状态栏版) v1.0.0

在 Ubuntu 的 **顶部状态栏** 显示**任意 SSH 主机**（如飞牛/局域网 Linux）的 CPU 温度。
通过 SSH 读取目标主机 `/sys/class/hwmon` 中 coretemp 所有核温度的最大值（Package 温度），
显示格式与本机温度 Freon 一致（整数 + °C）。扩展按加载顺序自然排列（登录时无位置交换过程，可左可右）。

- 扩展 UUID：`linux-temp@txh`；名称：**linux-cpu温度**；版本：**v1.0.0**；品牌标识：**TXH**（设置对话框顶部品牌行：左侧“linux-cpu温度 v1.0.0”、右侧“TXH”）。GNOME Shell 兼容版本：45 – 51（含 50.x）
- **通用工具**：不内置主机 / 密钥。点击顶部栏温度图标 → 菜单 → “设置…”，填写要读取温度的主机的 SSH 信息（主机、用户、端口，密钥或密码二选一，均可留空）。

## 目录结构

```
ubuntu/
├── portable/linux-temp@txh/     # 便携版（GNOME 扩展本体）
│   ├── metadata.json
│   ├── extension.js             # 顶部栏显示 + 点击菜单 + 设置对话框
│   ├── stylesheet.css           # 设置对话框样式
│   └── linux-temp-read.sh       # 通用 SSH 读 CPU 温度 helper（读 config，密钥/密码可选）
└── installer/install.sh         # 安装版（一键安装+启用）
```

## 便携版（手动）

1. 复制扩展目录到用户扩展目录：
   `cp -r portable/linux-temp@txh ~/.local/share/gnome-shell/extensions/`
2. 启用：`gnome-extensions enable linux-temp@txh`
3. 顶部栏未出现时：`Alt+F2` 输入 `r` 回车，或注销重登
4. 点击顶部栏温度图标 → 设置…，填写目标主机信息并保存

## 安装版（一键）

在目标机器上执行：

```bash
cd installer
./install.sh
```

脚本会自动：复制扩展、生成空配置模板、启用扩展。
随后点击顶部栏图标 → 设置… 完成主机配置。

## 配置

配置文件 `~/.config/linux-temp/config`（出厂为空模板；可通过设置界面写入，也可手改）：

```
FNOS_HOST=                     # 目标主机 IP/域名（设置界面填写）
FNOS_USER=                     # SSH 用户名
FNOS_PORT=22
FNOS_KEY=                      # 密钥认证（可选）
FNOS_PASSWORD=                 # 密码认证（可选，需安装 sshpass）
INTERVAL=5
```

- 密钥或密码二选一，均可留空。留空且未填主机则顶部栏显示“未配置”。
- 用密码认证需 `sudo apt install sshpass`。

## 卸载

```bash
gnome-extensions disable linux-temp@txh
rm -rf ~/.local/share/gnome-shell/extensions/linux-temp@txh
```

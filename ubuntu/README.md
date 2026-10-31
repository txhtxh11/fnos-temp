# linux-cpu温度 — Ubuntu GNOME 顶部状态栏版 v1.0.0

在 Ubuntu 的**顶部状态栏**显示 CPU 温度：**本机（左）** + **远程主机（右）** 两个温度，各自独立刷新间隔。
点击温度数字弹出小窗口，可刷新、打开设置。本机温度直接读 `/sys/class/hwmon`（coretemp）；远程温度通过 SSH 读取目标主机 CPU 温度。

- 扩展 UUID：`linux-temp@txh`；名称：**linux-cpu温度**；版本：**v1.0.0**；品牌标识：**TXH**（设置对话框顶部品牌行：左侧 `linux-cpu温度 v1.0.0`、右侧 `TXH`）
- 兼容 GNOME Shell 45 – 51（含 50.x）
- **通用工具**：不内置主机 / 用户名 / 密码 / 密钥，配置由你在设置界面填写

---

## 目录结构

```
ubuntu/
├── portable/linux-temp@txh/     # 便携版（GNOME 扩展本体）
│   ├── metadata.json
│   ├── extension.js             # 顶部栏显示 + 点击小窗口 + 读取/刷新逻辑
│   ├── stylesheet.css
│   ├── prefs.js                 # 设置对话框（Adw 上中下三段）
│   └── linux-temp-read.sh       # 远程 SSH 读 CPU 温度 helper（读 config，密钥/密码可选）
├── installer/install.sh         # 安装版（一键安装 + 启用）
└── build_deb.py                 # 构建 .deb 安装包（纯 Python，Windows/Linux 均可运行）
```

---

## 安装部署

提供四种方式：**DEB 安装包（推荐）**、**一键脚本**、**便携版 zip**、**手动复制**。

### 方式一：DEB 安装包（推荐，最省事）

```bash
sudo dpkg -i linux-cpu-temp_1.0.0_all.deb
```

或双击 `.deb` 用软件中心安装。安装后自动完成：扩展到系统级目录 `usr/share/gnome-shell/extensions/linux-temp@txh/`、生成配置模板、启用扩展。卸载时自动禁用。

#### 构建 .deb（可自行重新打包）

```bash
cd ubuntu
python3 build_deb.py     # 生成 linux-cpu-temp_1.0.0_all.deb
```

### 方式二：一键脚本（install.sh）

```bash
cd ubuntu/installer
./install.sh
```

脚本自动完成：复制扩展到 `~/.local/share/gnome-shell/extensions/linux-temp@txh/`、生成空配置模板、启用扩展。完成后 `Alt+F2` 输入 `r` 回车（或注销重登）让扩展生效。

### 方式三：便携版 zip

```bash
# 解压后即 linux-temp@txh 扩展文件夹，放到用户扩展目录
unzip linux-cpu温度-ubuntu便携版.zip -d ~/.local/share/gnome-shell/extensions/

# 启用
gnome-extensions enable linux-temp@txh
```

### 方式四：手动复制（便携版）

```bash
# 1. 复制扩展目录
cp -r portable/linux-temp@txh ~/.local/share/gnome-shell/extensions/

# 2. 启用
gnome-extensions enable linux-temp@txh

# 3. 顶部栏未出现时，重启 shell：Alt+F2 → 输入 r → 回车；或注销重登
```

### 依赖

- 仅用**密钥**认证：无额外依赖（用本机 SSH 私钥即可）。
- 用**密码**认证：需安装 `sshpass`：

```bash
sudo apt install sshpass
```

---

## 使用

安装启用后，顶部状态栏出现温度数字（未配置时显示 `--°C`）。

- **点击温度数字**：弹出小窗口
  - 标题「本机　远程」：按开关状态动态显示（都开显示两者，只开一个只显示对应那个）
  - 「刷新」：立即重新读取本机与远程温度
  - 「设置」：打开设置对话框
- **悬停提示**：`本机(左) 42°C / 远程(右) 54°C (主机IP)`，本机各核温度明细。

---

## 设置界面

顶部小窗口「设置」与扩展管理器齿轮共用同一个 Adw 浅色设置对话框（紧凑**上中下三段**）：

**显示传感器**
- 本机温度 [开关]　　远程温度 [开关]

**显示选项**
- 本机刷新间隔(秒) [5]　[-][+]　　远程刷新间隔(秒) [5]　[-][+]
- 本机显示 [平均温度▼]　　远程显示 [平均温度▼]

**传感器提供程序**
- 远程主机IP []　　用户名 [t]　　端口 [22]
- 密钥路径(可选) [长路径框…]　[浏览…]
- 密码(可选) [****]

保存后顶部栏与本机/远程读取立即按新配置生效。

---

## 配置

配置文件 `~/.config/linux-temp/config`（出厂为空模板；通过设置界面写入，也可手改）：

```
FNOS_HOST=                     # 目标主机 IP/域名
FNOS_USER=                     # SSH 用户名
FNOS_PORT=22
FNOS_KEY=                      # 密钥认证（可选，ed25519/rsa 私钥路径）
FNOS_PASSWORD=                 # 密码认证（可选，需 sshpass）
INTERVAL=5                     # 旧版兼容（未设置 LOCAL/REMOTE_INTERVAL 时的默认）
LOCAL_INTERVAL=5               # 本机刷新间隔（秒）
REMOTE_INTERVAL=5              # 远程刷新间隔（秒）
SHOW_LOCAL=true                # 是否显示本机温度
LOCAL_TEMP_TYPE=avg            # 本机显示温度类型：avg 平均 / max 最高
SHOW_REMOTE=true               # 是否显示远程温度
REMOTE_TEMP_TYPE=avg           # 远程显示温度类型：avg 平均 / max 最高
```

- 密钥或密码二选一，均可留空；未填主机则顶部栏显示 `--°C`。
- 温度类型 `avg`=各核平均，`max`=各核最大值（Package 温度）。

---

## 卸载

```bash
gnome-extensions disable linux-temp@txh
rm -rf ~/.local/share/gnome-shell/extensions/linux-temp@txh
```

---

## License

供学习交流使用，可自由使用、修改与分发。

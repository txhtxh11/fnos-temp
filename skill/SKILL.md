---
name: linux-cpu-temp
display_name: linux-cpu温度（局域网Linux温度）
display_name_en: linux-cpu Temperature Monitor (LAN Linux Hosts)
description: 双平台一键安装"linux-cpu温度"工具：Windows 上通过 SSH 读取局域网任意 Linux 主机（飞牛 fnOS、群晖、Ubuntu、Debian、CentOS 等）CPU 温度并显示系统托盘数字图标；Ubuntu（GNOME）上安装顶部状态栏扩展显示本机与远程主机温度。当用户要求安装/部署/重装该温度工具、监控 NAS 或局域网 Linux 主机 CPU 温度、在系统托盘或 GNOME 顶部栏显示远程主机温度时使用本技能；支持 Windows/Ubuntu 双平台、配置修改与卸载。
description_zh: 通过 SSH 读取局域网 Linux 主机（飞牛 fnOS、群晖、Ubuntu 等）CPU 温度。Windows 版在系统托盘显示实时数字图标，Ubuntu 版在 GNOME 顶部状态栏显示本机+远程双温度。支持一键安装、开机自启、配置修改与卸载，Windows 与 Ubuntu 双平台。
description_en: Reads CPU temperature from any LAN Linux host (fnOS, Synology, Ubuntu, Debian, etc.) via SSH. Windows edition shows a live numeric tray icon; Ubuntu edition shows a GNOME top-bar extension with local+remote temperatures. One-click install, autostart, configuration and uninstall on both Windows and Ubuntu.
agent_created: true
version: 1.2.0
author: txhtxh11
---

# linux-cpu温度工具安装器（双平台）

**Windows**：安装"linux-cpu温度"托盘工具，SSH 读取任意局域网 Linux 主机的 CPU 温度，托盘显示数字图标。
**Ubuntu（GNOME）**：安装"linux-cpu温度"顶部状态栏扩展，显示本机 + 远程主机双温度。

工具为通用版，不内置任何主机、用户名、密码或密钥，安装后由用户在设置界面填写目标机信息。

## 快速安装（按系统选择）

### Windows 本机

在 PowerShell 执行：

```
powershell -ExecutionPolicy Bypass -File <skill>/scripts/install.ps1
```

完整流程：停止旧实例 → 复制文件到 `%LOCALAPPDATA%\Programs\FnosTempOverlay` → 建桌面"linux-cpu温度"快捷方式与开始菜单"启动/退出" → 设置开机自启 → 启动托盘。

### Ubuntu / Linux（GNOME Shell）

在终端执行：

```bash
bash <skill>/scripts/install.sh
```

完整流程：复制扩展到 `~/.local/share/gnome-shell/extensions/linux-temp@txh` → 生成空配置模板 → 启用扩展。完成后 Alt+F2 输入 `r` 回车（或注销重登）生效。`--force` 参数可强制覆盖已安装扩展。

> 判断系统：当前终端/环境为 Windows 用 install.ps1；为 Linux（含 Ubuntu）用 install.sh。也可让用户告知其操作系统再选。

## Windows 安装参数

| 参数 | 作用 |
|---|---|
| `-TargetDir "路径"` | 自定义安装目录（默认 `%LOCALAPPDATA%\Programs\FnosTempOverlay`） |
| `-NoStart` | 只部署不启停（不碰正在运行的托盘实例） |
| `-NoAutostart` | 不设置开机自启 |
| `-SkipShortcuts` | 不创建快捷方式（用于无副作用测试） |

## 安装后验证

### Windows

1. 进程检查：
   ```powershell
   Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
     Where-Object { $_.CommandLine -match 'FnOsTempOverlay\.ps1' }
   ```
   应有结果；
2. 托盘出现数字图标（未配置时显示 `--`）；双击数字打开设置窗口，填写目标机 IP、SSH 用户名、端口（默认 22）、认证方式（密钥文件路径或密码，密码用当前 Windows 用户的 DPAPI 加密保存）、刷新间隔（默认 10 秒）；
3. 可在设置窗口点"测试连接"验证；也可右键托盘数字选"立即刷新"强制重连；
4. 若未出现图标，让用户双击桌面"linux-cpu温度"手动启动。

### Ubuntu（GNOME 扩展）

1. 扩展状态：
   ```bash
   gnome-extensions info linux-temp@txh
   ```
   应显示 `已启用: 是` / `状态: ACTIVE`；
2. 顶部状态栏出现温度数字（未配置时显示 `--°C`）；点击数字弹出小窗口（标题本机/远程、刷新、设置）；
3. 悬停提示区分 `本机(左) x°C / 远程(右) y°C (主机IP)`；
4. 若顶部栏未出现，Alt+F2 输入 `r` 回车重启 shell 或注销重登。

## 温度读取逻辑

SSH 到目标机执行命令，按优先级取值（返回毫摄氏度，除以 1000）：

1. `/sys/class/thermal` 中 type 为 `x86_pkg_temp` / `cpu_thermal` / `cpu-thermal` / `soc_thermal` / `soc-thermal` 的 thermal_zone；
2. `/sys/class/hwmon` 中 name 为 `coretemp` / `k10temp` / `zenpower`，取所有核温度最大值（≈ Package 温度）；
3. 回退：所有 thermal_zone 的最大值。

## 常见操作

### Windows

- **修改配置**：双击托盘数字 → 设置窗口；保存后立即生效，无需重启；
- **立即重连**：右键托盘数字 → "立即刷新"；
- **显示/隐藏图标**：Windows 设置 → 个性化 → 任务栏 → 其他系统托盘图标；
- **卸载**：执行 `<skill>/scripts/uninstall.ps1`（停止进程、删除快捷方式与开机自启；加 `-DeleteFiles` 连程序目录一起删除）。

### Ubuntu

- **配置**：点击顶部温度数字 → 设置…（Adw 浅色上中下三段：显示传感器 / 显示选项 / 传感器提供程序）；
  - 本机 + 远程双开关、各自独立刷新间隔、温度类型（平均/最高）；
  - 远程主机 IP / 用户名 / 端口、密钥路径(浏览) / 密码；
- **卸载**：
  ```bash
  gnome-extensions disable linux-temp@txh
  rm -rf ~/.local/share/gnome-shell/extensions/linux-temp@txh
  ```
- **配置依赖**：Ubuntu 远程用密码认证需 `sudo apt install sshpass`；密钥认证无额外依赖。

## 工具说明

- Windows 进程形态：由 `powershell.exe` 承载（兼容 Smart App Control；未签名独立 exe 会被 SAC 拦截，故默认装 PowerShell 承载版，零编译）；
- 第三方依赖：仅 `Renci.SshNet.dll`（SSH.NET），随包内置，无需联网下载；
- 日志：Windows 程序目录 `app.log`（超过 512KB 自动轮转重建）；
- 数据安全：Windows 密码仅以 DPAPI（当前 Windows 用户）加密存储在本机 `config.ini`，Ubuntu 密码存 `~/.config/linux-temp/config`，均不上传任何数据。

## 注意

- Windows 完整安装会**停止并重启**正在运行的托盘实例一次（正常替换行为）；
- Windows `config.ini` 若已存在则保留用户配置，不覆盖；Ubuntu `config` 同理；
- 升级安装直接重跑对应 install 脚本即可，用户配置会保留。

---
name: linux-cpu-temp
display_name: linux-cpu温度（局域网Linux温度托盘）
display_name_en: linux-cpu Temperature Tray (LAN Linux Hosts)
description: 在 Windows 电脑上一键安装"linux-cpu温度"系统托盘工具：通过 SSH 读取局域网内任意 Linux 主机（飞牛 fnOS、群晖、Ubuntu、Debian、CentOS 等）的 CPU 温度，在系统托盘显示黑色数字图标（仿 Core Temp），悬停提示"linux-cpu 47°C"。当用户要求安装/部署/重装该温度托盘工具、监控 NAS 或局域网 Linux 主机 CPU 温度、或在系统托盘显示远程主机温度时使用本技能；也支持配置修改与卸载。
description_zh: 通过 SSH 读取局域网 Linux 主机（飞牛 fnOS、群晖、Ubuntu 等）的 CPU 温度，在 Windows 系统托盘显示实时数字图标，支持一键安装、开机自启、配置修改与卸载。
description_en: Reads CPU temperature from any LAN Linux host (fnOS, Synology, Ubuntu, Debian, etc.) via SSH and shows a live numeric tray icon on Windows. Supports one-click install, autostart, configuration and uninstall.
agent_created: true
version: 1.1.0
author: txhtxh11
---

# linux-cpu温度工具安装器

在本机 Windows 上安装"linux-cpu温度"托盘工具：SSH 读取任意局域网 Linux 主机的 CPU 温度，托盘显示数字图标。工具为通用版，不内置任何主机、用户名、密码或密钥，安装后由用户在设置窗口填写目标机信息。

## 快速安装

在 PowerShell 执行：

```
powershell -ExecutionPolicy Bypass -File <skill>/scripts/install.ps1
```

完整流程：停止旧实例 → 复制文件到 `%LOCALAPPDATA%\Programs\FnosTempOverlay` → 建桌面"linux-cpu温度"快捷方式与开始菜单"启动/退出" → 设置开机自启 → 启动托盘。

## 参数

| 参数 | 作用 |
|---|---|
| `-TargetDir "路径"` | 自定义安装目录（默认 `%LOCALAPPDATA%\Programs\FnosTempOverlay`） |
| `-NoStart` | 只部署不启停（不碰正在运行的托盘实例） |
| `-NoAutostart` | 不设置开机自启 |
| `-SkipShortcuts` | 不创建快捷方式（用于无副作用测试） |

## 安装后验证

1. 进程检查：
   ```powershell
   Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
     Where-Object { $_.CommandLine -match 'FnOsTempOverlay\.ps1' }
   ```
   应有结果；
2. 托盘出现数字图标（未配置时显示 `--`）；双击数字打开设置窗口，填写目标机 IP、SSH 用户名、端口（默认 22）、认证方式（密钥文件路径或密码，密码用当前 Windows 用户的 DPAPI 加密保存）、刷新间隔（默认 10 秒）；
3. 可在设置窗口点"测试连接"验证；也可右键托盘数字选"立即刷新"强制重连；
4. 若未出现图标，让用户双击桌面"linux-cpu温度"手动启动。

## 温度读取逻辑

SSH 到目标机执行命令，按优先级取值（返回毫摄氏度，除以 1000）：

1. `/sys/class/thermal` 中 type 为 `x86_pkg_temp` / `cpu_thermal` / `cpu-thermal` / `soc_thermal` / `soc-thermal` 的 thermal_zone；
2. `/sys/class/hwmon` 中 name 为 `coretemp` / `k10temp` / `zenpower`，取所有核温度最大值（≈ Package 温度）；
3. 回退：所有 thermal_zone 的最大值。

## 常见操作

- **修改配置**：双击托盘数字 → 设置窗口；保存后立即生效，无需重启；
- **立即重连**：右键托盘数字 → "立即刷新"；
- **显示/隐藏图标**：Windows 设置 → 个性化 → 任务栏 → 其他系统托盘图标；
- **卸载**：执行 `<skill>/scripts/uninstall.ps1`（停止进程、删除快捷方式与开机自启；加 `-DeleteFiles` 连程序目录一起删除）。

## 工具说明

- 进程形态：由 `powershell.exe` 承载（兼容 Smart App Control；未签名独立 exe 会被 SAC 拦截，故默认装 PowerShell 承载版，零编译）；
- 第三方依赖：仅 `Renci.SshNet.dll`（SSH.NET），随包内置，无需联网下载；
- 日志：程序目录 `app.log`（超过 512KB 自动清空重建）；
- 数据安全：密码仅以 DPAPI（当前 Windows 用户）加密存储在本机 `config.ini`，不上传任何数据。

## 注意

- 完整安装会**停止并重启**正在运行的托盘实例一次（正常替换行为）；
- `config.ini` 若已存在则保留用户配置，不覆盖；
- 升级安装同样执行 install.ps1 即可，用户配置会保留。

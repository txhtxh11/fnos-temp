# 飞牛温度（fnos-temp）

Windows 系统托盘小工具：通过 SSH 读取 **飞牛 / 局域网 Linux** 的 CPU 温度，在系统托盘显示 16×16 数字图标（仿 Core Temp），悬停提示「飞牛 CPU 47°C」。

## 版本

| 目录 | 说明 |
|---|---|
| `portable/` | **便携版**：复制即用，由 PowerShell 承载，无需编译，兼容 Smart App Control |
| `installer/` | **安装版**：运行 `install.ps1` 一键安装到 `%LOCALAPPDATA%\Programs\FnosTempOverlay`，自动建桌面/开始菜单快捷方式、设开机自启 |
| `standalone-exe/` | **独立 exe 版**：编译好的 .NET Framework 程序，要求目标机**未开启** Smart App Control（否则未签名 exe 会被拦截） |
| `skill/` | **豆包技能 `fnos-temp-installer`**：对豆包说「在本机安装飞牛温度工具」，即可自动一键安装 |

## 快速开始

**便携版**：把 `portable/` 整体拷到目标机，双击 `启动飞牛温度.vbs`，托盘出现数字后双击数字即可改设置。

**安装版**：
```powershell
powershell -ExecutionPolicy Bypass -File installer\install.ps1
```
可选参数：`-TargetDir "路径"`、`-NoStart`（只部署不启停）、`-NoAutostart`、`-SkipShortcuts`。

**独立 exe 版**：`standalone-exe/` 整体拷到未开 SAC 的 Windows 11，双击 `FnosTempOverlay.exe`。

**豆包技能**：把 `skill/` 目录放到豆包的 `.user_skills/` 下，即可通过对话触发安装。

## 温度读取逻辑

SSH 到目标机执行命令，按以下优先级取 CPU 温度（返回毫摄氏度，除以 1000）：

1. `/sys/class/thermal` 中 type 为 `x86_pkg_temp` / `cpu_thermal` / `cpu-thermal` / `soc_thermal` / `soc-thermal` 的 thermal_zone；
2. `/sys/class/hwmon` 中 name 为 `coretemp` / `k10temp` / `zenpower`，取所有核温度最大值（≈ Package 温度）；
3. 回退：所有 thermal_zone 的最大值。

## 密钥说明

> ⚠️ **本仓库不包含 SSH 私钥**（`fnos_temp_key` 已被移除），请勿期待仓库内有可直接使用的密钥。

- 默认认证方式为 **ed25519 密钥**（本机私有文件 `fnos_temp_key`，已在用户自己的飞牛 `t` 用户上配置过）。
- 部署到你自己的飞牛：把 `fnos_temp_key.pub` 追加到 `~/.ssh/authorized_keys`，并把私钥文件命名为 `fnos_temp_key` 放到程序目录；或直接改用密码认证（在设置窗口中填密码）。
- `config.ini` 中 `KeyPath=fnos_temp_key` 即指向该私钥文件。

## 构建

- **便携版 / 安装版**：无需编译（由 `FnOsTempOverlay.ps1` 动态编译源码运行）。
- **独立 exe 版**：`standalone-exe/FnOsTempOverlay.cs` 已包含 `Main` 入口，用 .NET Framework 的 csc 编译：
  ```bat
  csc /target:winexe /platform:anycpu /optimize+ /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Security.dll /r:Renci.SshNet.dll FnOsTempOverlay.cs
  ```

## 说明

- 进程由 `powershell.exe` 承载（本机启用了 Smart App Control），故系统托盘显示名为「Windows PowerShell」；托盘图标提示文字为「飞牛 CPU 47°C」。
- 已修复：设置窗口「端口」输入框被标签遮挡的布局问题（三版源码已同步）。
- 密码使用当前 Windows 用户的 DPAPI 加密存储。

## License

供学习交流使用，可自由使用、修改与分发。

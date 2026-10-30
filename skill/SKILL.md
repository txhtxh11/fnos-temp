---
name: fnos-temp-installer
description: 在本机 Windows 电脑上一键安装/部署“飞牛温度”系统托盘工具（通过 SSH 读取飞牛/局域网 Linux CPU 温度，以 16×16 数字图标显示在系统托盘，悬停提示“飞牛 CPU 47°C”）。当用户要求在本机安装飞牛温度工具、一键部署该温度监控工具、重装系统或换电脑后重新安装、或把飞牛 CPU 温度托盘工具安装到当前这台电脑时使用。负责复制工具文件、创建桌面/开始菜单快捷方式、设置开机自启并启动托盘。
---

# 飞牛温度工具安装器

在本地 Windows 电脑上安装“飞牛温度”托盘工具：通过 SSH 读飞牛/局域网 Linux CPU 温度，托盘显示数字图标。

## 快速安装

在 PowerShell 执行：

```
powershell -ExecutionPolicy Bypass -File <skill>/scripts/install.ps1
```

完整安装流程：停止旧实例 → 复制文件到 `%LOCALAPPDATA%\Programs\FnosTempOverlay` → 建桌面“飞牛温度”快捷方式和开始菜单“启动/退出” → 设置开机自启 → 启动托盘。

## 参数

| 参数 | 作用 |
|---|---|
| `-TargetDir "路径"` | 自定义安装目录（默认 `%LOCALAPPDATA%\Programs\FnosTempOverlay`） |
| `-NoStart` | 只部署不启停（不停止/重启正在运行的托盘实例） |
| `-NoAutostart` | 不设置开机自启 |
| `-SkipShortcuts` | 不创建快捷方式（用于无副作用测试） |

## 安装后验证

1. 进程检查：
   ```powershell
   Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
     Where-Object { $_.CommandLine -match 'FnOsTempOverlay\.ps1' }
   ```
   应有结果；
2. 确认 `%LOCALAPPDATA%\Programs\FnosTempOverlay\config.ini` 指向飞牛（默认 ``、用户 `t`、密钥 `fnos_temp_key`）；
3. 托盘应出现温度数字；若未出现，让用户双击桌面“飞牛温度”。

## 工具说明

- 读取温度：SSH 执行命令，优先级为 thermal_zone 的 `x86_pkg_temp/cpu_thermal/soc_thermal` → hwmon 的 `coretemp/k10temp/zenpower`（取各核最大值≈Package 温度）→ 回退 thermal_zone 最大值；
- 认证：ed25519 密钥 `assets/fnos_temp_key`（已配好飞牛 `t` 用户），也可改 `config.ini` 用密码（DPAPI 加密存储）；
- 进程形态：由 `powershell.exe` 承载（本机启用了 Smart App Control，未签名独立 exe 会被拦截，故提供 PowerShell 承载版）；如需安装到另一台无 SAC 的机器，可用独立 exe 版，本技能默认装 PowerShell 承载版（SAC 兼容、零编译）。

## 注意

- 完整安装会**停止并重启**正在运行的托盘实例一次（正常替换行为）；
- 技能自带私钥，请勿把技能目录外发；
- `config.ini` 若已存在会保留用户配置，不覆盖。

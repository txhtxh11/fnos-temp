# linux-cpu温度（fnos-temp）v1.1.0

Windows 系统托盘小工具：通过 SSH 读取**任意局域网 Linux 主机**的 CPU 温度，在系统托盘显示 16×16 数字图标（仿 Core Temp），悬停提示「linux-cpu 47°C」。

- **通用工具**：不内置任何主机、用户名、密码或密钥；安装后双击托盘数字打开设置，填写目标主机信息即可。
- 名称：**linux-cpu温度**；版本：**v1.0.0**；品牌标识：TXH。

## 版本

| 目录 | 说明 |
|---|---|
| `portable/` | **便携版**：复制即用，由 PowerShell 承载，无需编译，兼容 Smart App Control |
| `installer/` | **安装版**：运行 `install.ps1` 一键安装到 `%LOCALAPPDATA%\Programs\FnosTempOverlay`，自动建桌面/开始菜单快捷方式、设开机自启 |
| `standalone-exe/` | **独立 exe 版**：编译好的 .NET Framework 程序，要求目标机**未开启** Smart App Control（否则未签名 exe 会被拦截） |
| `skill/` | **WorkBuddy 技能 `linux-cpu-temp`**：在 WorkBuddy 对话中说「帮我安装 linux-cpu温度工具」，即可自动一键安装（亦可上架 WorkBuddy 技能市场） |
| `ubuntu/` | **Ubuntu GNOME 版**：顶部状态栏显示任意 SSH 主机 CPU 温度（扩展 `linux-temp@txh`），含安装版 + 便携版，详见 `ubuntu/README.md` |

## 快速开始

**便携版**：把 `portable/` 整体拷到目标机，双击 `启动linux-cpu温度.vbs`，托盘出现数字后双击数字即可改设置。
**安装版**：
```powershell
powershell -ExecutionPolicy Bypass -File installer\install.ps1
```
可选参数：`-TargetDir "路径"`、`-NoStart`（只部署不启停）、`-NoAutostart`、`-SkipShortcuts`。

**独立 exe 版**：`standalone-exe/` 整体拷到未开 SAC 的 Windows 11，双击 `FnosTempOverlay.exe`。

**WorkBuddy 技能**：把 `skill/` 目录拷到 `~/.workbuddy/skills/linux-cpu-temp/`，即可在对话中触发安装；或打包 zip 上架技能市场（见下文）。

**Ubuntu GNOME 版**：见 `ubuntu/README.md`（`cd ubuntu/installer && ./install.sh` 一键安装到顶部状态栏）。

## 温度读取逻辑

SSH 到目标机执行命令，按以下优先级取 CPU 温度（返回毫摄氏度，除以 1000）：

1. `/sys/class/thermal` 中 type 为 `x86_pkg_temp` / `cpu_thermal` / `cpu-thermal` / `soc_thermal` / `soc-thermal` 的 thermal_zone；
2. `/sys/class/hwmon` 中 name 为 `coretemp` / `k10temp` / `zenpower`，取所有核温度最大值（≈ Package 温度）；
3. 回退：所有 thermal_zone 的最大值。

## 配置与认证

> ⚠️ **本工具为通用版**：不内置任何主机、用户名、密码或密钥，仓库不包含 SSH 私钥。

双击托盘数字打开设置窗口，填写：

- **主机 IP/域名**：要读取温度的目标机
- **SSH 用户名**
- **端口**：默认 22
- **认证**：密钥文件路径（ed25519/rsa 私钥）或 **密码**（二选一，均可留空）
- **刷新间隔（秒）**

留空且未填主机时，托盘显示 `--`。密码使用当前 Windows 用户的 DPAPI 加密保存。
若要读取的目标机在另一台 Linux 上，请把目标机的私钥放到程序目录，或在设置中改用密码认证。

## 构建

- **便携版 / 安装版**：无需编译（由 `FnOsTempOverlay.ps1` 动态编译源码运行）。
- **独立 exe 版**：`standalone-exe/FnOsTempOverlay.cs` 已包含 `Main` 入口，用 .NET Framework 的 csc 编译：
  ```bat
  csc /target:winexe /platform:anycpu /optimize+ /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Security.dll /r:Renci.SshNet.dll FnOsTempOverlay.cs
  ```

## 更新日志

### v1.1.0

- 默认刷新间隔 2s → 10s（温度变化缓慢，低频轮询更省资源；设置中仍可调 1–60 秒）；
- `app.log` 增加 512KB 轮转，不再无限增长；
- 托盘右键菜单新增「立即刷新」，强制重建 SSH 连接并立即读温；
- 连接失败时托盘悬停提示「连接失败，等待重试」，便于排障；
- 技能版适配 WorkBuddy 技能规范（`agent_created: true`、版本号、触发词），新增 `uninstall.ps1` 卸载脚本并纳入安装清单；
- 各变体（portable / installer / standalone-exe / skill）源码同步。

## 上架 WorkBuddy 技能市场

1. `skill/` 目录即技能包源（SKILL.md + scripts/ + assets/），用 skill-creator 打包为 zip；
2. 访问开放平台 `open.workbuddy.cn`，注册并完成开发者认证（个人即可）；
3. 在「技能发布管理」上传 zip，填写名称、简介、分类，提交审核（一般 1–3 个工作日）；
4. 审核通过后发布，用户即可在 WorkBuddy 技能市场搜索安装；如需收费，需先有 ≥1 个审核通过的免费技能再开通收款账户。

## 说明

- 进程由 `powershell.exe` 承载（本机启用了 Smart App Control），故系统托盘显示名为「Windows PowerShell」；托盘图标提示文字为「linux-cpu 47°C」。
- 设置窗口标题「linux-cpu温度设置」，窗口顶部品牌行：左侧 `linux-cpu温度 v1.0.0`，右侧 `TXH`。
- 已修复：设置窗口「端口」输入框被标签遮挡的布局问题（三版源码已同步）。

## License

供学习交流使用，可自由使用、修改与分发。

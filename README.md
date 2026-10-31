# linux-cpu温度（fnos-temp）v1.2.0

在**顶部状态栏 / 系统托盘**显示 CPU 温度的跨平台小工具，覆盖 **Windows** 与 **Ubuntu（GNOME）** 双平台。通过 SSH 读取**任意局域网 Linux 主机**的 CPU 温度，本机温度（Windows Core Temp / Linux coretemp）开箱即用。

- **通用工具**：不内置任何主机、用户名、密码或密钥；安装后打开设置填写目标主机信息即可。
- 名称：**linux-cpu温度**；版本：**v1.0.0（各平台内嵌）**；品牌标识：**TXH**。
- skill 技能：**v1.2.0**（Windows + Ubuntu 双平台一键安装）。

## 平台与版本

| 平台 | 目录 / 文件 | 说明 |
|---|---|---|
| **Windows** | `portable/` | 便携版：复制即用，由 PowerShell 承载，兼容 Smart App Control |
| | `installer/` | 安装版：`install.ps1` 一键安装到 `%LOCALAPPDATA%\Programs\FnosTempOverlay`，自动建快捷方式 + 开机自启 |
| | `standalone-exe/` | 独立 exe 版：编译好的 .NET Framework 程序（目标机需**未开启** Smart App Control）|
| **Ubuntu (GNOME)** | `ubuntu/portable/linux-temp@txh/` | 扩展本体：顶部状态栏显示**本机 + 远程**两个温度，Adw 浅色设置界面 |
| | `ubuntu/linux-cpu-temp_1.0.0_all.deb` | **DEB 安装包（推荐）**：`sudo dpkg -i` 自动装到系统级扩展目录 + 启用 |
| | `ubuntu/installer/install.sh` | 一键脚本：复制扩展 + 生成配置 + 启用 |
| | `ubuntu/` 便携 zip | 解压即扩展文件夹，放用户扩展目录 |
| **技能** | `skill/` | **WorkBuddy 技能 `linux-cpu-temp` v1.2.0**：Windows `install.ps1` + Ubuntu `install.sh` 双平台一键安装 |

详见各目录内 README：Windows 见 `installer/README.md` 与源码头注释，Ubuntu 完整安装/使用/配置见 `ubuntu/README.md`。

## 快速开始

**Windows 便携版**：把 `portable/` 拷到目标机，双击 `启动linux-cpu温度.vbs`，托盘出现数字后双击改设置。

**Windows 安装版**：
```powershell
powershell -ExecutionPolicy Bypass -File installer\install.ps1
```
可选：`-TargetDir "路径"`、`-NoStart`、`-NoAutostart`、`-SkipShortcuts`。

**Windows 独立 exe 版**：`standalone-exe/` 拷到未开 SAC 的 Windows 11，双击 `FnosTempOverlay.exe`。

**Ubuntu DEB 安装（推荐）**：
```bash
sudo dpkg -i ubuntu/linux-cpu-temp_1.0.0_all.deb
```

**Ubuntu 一键脚本**：
```bash
cd ubuntu/installer && ./install.sh
```

**Ubuntu 便携 zip**：
```bash
unzip linux-cpu温度-ubuntu便携版.zip -d ~/.local/share/gnome-shell/extensions/
gnome-extensions enable linux-temp@txh
```

**WorkBuddy 技能**：把 `skill/` 目录拷到豆包/WorkBuddy 的技能目录，即可在对话中触发双平台一键安装；或打包 zip 上架技能市场。

## 温度读取逻辑

**远程主机（Windows + Ubuntu）**：SSH 到目标机执行命令，按优先级取 CPU 温度（毫摄氏度，除以 1000）：
1. `/sys/class/thermal` 中 type 为 `x86_pkg_temp` / `cpu_thermal` / `cpu-thermal` / `soc_thermal` / `soc-thermal` 的 thermal_zone；
2. `/sys/class/hwmon` 中 name 为 `coretemp` / `k10temp` / `zenpower`，取所有核温度最大值（≈ Package）；
3. 回退：所有 thermal_zone 的最大值。

**本机温度**：Windows 用 Core Temp 共享内存；Ubuntu 直接读 `/sys/class/hwmon`（coretemp），可选手均或最高。

## 配置与认证

> ⚠️ **通用版**：不内置任何主机、用户名、密码或密钥，仓库不包含 SSH 私钥。

- **Windows**：双击托盘数字打开设置，填写主机 IP/域名、SSH 用户名、端口、密钥路径或密码、刷新间隔。密码用当前 Windows 用户 DPAPI 加密保存。
- **Ubuntu**：配置文件 `~/.config/linux-temp/config`（出厂为空模板，通过设置界面写入）。密钥或密码二选一，均可留空；未填主机显示 `--°C`。用密码认证需 `sudo apt install sshpass`。

## 构建

- **Windows 便携/安装版**：无需编译（`FnOsTempOverlay.ps1` 动态编译运行）。
- **Windows 独立 exe**：`standalone-exe/FnOsTempOverlay.cs` 用 .NET Framework csc 编译：
  ```bat
  csc /target:winexe /platform:anycpu /optimize+ /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Security.dll /r:Renci.SshNet.dll FnOsTempOverlay.cs
  ```
- **Ubuntu DEB**：`cd ubuntu && python3 build_deb.py`（纯 Python，Windows/Linux 均可运行，生成 `linux-cpu-temp_1.0.0_all.deb`）。

## 更新日志

### v1.2.0
- **新增 Ubuntu GNOME 扩展版**：顶部状态栏显示本机 + 远程两个温度，Adw 浅色紧凑三段设置界面（显示传感器 / 显示选项 / 传感器提供程序），菜单标题按开关动态显示「本机　远程」，标题/刷新/设置水平居中。
- **Ubuntu 四种安装方式**：DEB 安装包（推荐）/ install.sh 一键脚本 / 便携 zip / 手动复制；DEB 自动装到系统级扩展目录 + 生成配置 + 启用。
- **skill 升级 v1.2.0 双平台**：Windows `install.ps1` + Ubuntu `install.sh` 一键安装、验证、卸载。
- **代码通用化**：清除历史内网 IP / 用户名，仓库不内置任何凭据。
- **扩展通过 EOG 静态检查**（shexli 0 error / 0 warning），可上架 extensions.gnome.org。

### v1.1.0
- 默认刷新间隔 2s → 10s（低频轮询更省资源）；
- `app.log` 512KB 轮转，不再无限增长；
- 托盘右键菜单新增「立即刷新」；
- 连接失败悬停提示「连接失败，等待重试」；
- 技能版适配 WorkBuddy 技能规范，新增 `uninstall.ps1` 卸载脚本；
- 各变体源码同步。

## 上架 WorkBuddy 技能市场

1. `skill/` 目录即技能包源（SKILL.md + scripts/ + assets/），用 skill-creator 打包为 zip；
2. 访问开放平台 `open.workbuddy.cn`，注册并完成开发者认证；
3. 在「技能发布管理」上传 zip，填写名称、简介、分类，提交审核（一般 1–3 个工作日）；
4. 审核通过后发布；如需收费，需先有 ≥1 个审核通过的免费技能再开通收款账户。

## License

供学习交流使用，可自由使用、修改与分发。

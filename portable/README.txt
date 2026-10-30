飞牛 / 局域网 Linux CPU 温度（系统托盘）
========================================

效果
----
在 Windows 系统托盘显示一个 16×16 的黑色数字图标，字体 Tahoma 8、透明背景，
和 Core Temp 的托盘数字一致。鼠标悬停显示“飞牛 CPU 47°C”。

使用
----
- 桌面快捷方式“飞牛温度”启动；已在“启动”文件夹放好自启脚本。
- 双击托盘里的温度数字（或右键 → 设置…）打开设置。
- 设置里可填写任意局域网 Linux 主机：
  主机、端口、用户名、密码或密钥文件、刷新间隔。
- 读取顺序：/sys/class/thermal 的 x86_pkg_temp / cpu_thermal / soc_thermal，
  然后 hwmon 的 coretemp / k10temp / zenpower，最后回退到所有 thermal_zone 最大值。
  所以 Intel、AMD、ARM 的常见 Linux 都能用。
- “随系统启动”勾选后会在启动文件夹写入 飞牛温度.vbs。
- 退出：右键托盘图标 → 退出；或运行本目录“退出飞牛温度.cmd”。

显示 / 隐藏图标
---------------
Windows 11：设置 → 个性化 → 任务栏 → 其他系统托盘图标。
本工具在这一页显示为 **Windows PowerShell**（见下方说明），开关它就是显示/隐藏。
设置窗口里的“托盘设置”按钮可直接打开这一页。

为什么名字显示 Windows PowerShell
---------------------------------
本机启用了 Smart App Control（智能应用控制），新编译的未签名 exe 会被拦截。
因此工具由 powershell.exe 承载，Windows 就用宿主程序的文件描述显示为
“Windows PowerShell”。托盘图标本身的提示文字是正确的“飞牛 CPU 47°C”。

资源占用
--------
- CPU 基本为 0；每 2 秒一次 SSH 查询，SSH 连接复用。
- 内存约 77 MB（PowerShell 宿主）。如果改成独立 exe 可降到约 30 MB，
  并在系统设置里显示“飞牛 CPU 温度”，但需要关闭 Smart App Control
  （不可逆）或使用代码签名证书。

文件
----
FnOsTempOverlay.ps1   启动脚本（PowerShell + WinForms + SSH.NET）
FnOsTempOverlay.cs    全部源码
Renci.SshNet.dll      SSH.NET 2020（支持 ed25519 / RSA / 密码）
config.ini            主机、端口、用户、认证方式、间隔
fnos_temp_key         ed25519 私钥（已装到飞牛 t 用户）
启动飞牛温度.vbs      隐藏窗口启动
退出飞牛温度.cmd      停止工具
app.log               运行日志（只在出错/启动时写）

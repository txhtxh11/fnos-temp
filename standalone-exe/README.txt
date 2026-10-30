飞牛 / 局域网 Linux CPU 温度 —— 独立 EXE 版
=============================================

这是编译好的独立程序，不再由 PowerShell 承载，托盘名显示“飞牛 CPU 温度”，
内存约 30 MB（原 PowerShell 版约 77 MB）。

要求
----
- Windows 11（系统自带 .NET Framework 4.8，无需额外安装）。
- 目标机【不能】开启“智能应用控制 Smart App Control”。
  否则会拦截未签名 exe，报错 0x800711C7（本机即如此，所以原工具用 PowerShell 承载）。
  关闭位置：Windows 安全中心 → 应用和浏览器控制 → 智能应用控制。

使用
----
1. 把本文件夹整体拷到目标电脑（不要放 OneDrive/网络盘）。
2. 双击 FnosTempOverlay.exe 启动，托盘出现数字图标。
3. 双击托盘数字 → 设置：
   - 同一台飞牛 ：直接用自带的 fnos_temp_key；
   - 另一台 Linux：把 fnos_temp_key.pub 加到该机 ~/.ssh/authorized_keys，
     或改“使用密码”。
4. 需要开机自启：设置里勾“随系统启动”（会写一个静默启动本 exe 的 vbs）。
5. 退出：右键托盘图标 → 退出。

文件
----
FnosTempOverlay.exe   主程序
Renci.SshNet.dll      SSH.NET 2020（必须与 exe 同目录）
config.ini            主机/端口/用户/认证/间隔
fnos_temp_key(.pub)   ed25519 密钥（已配好飞牛 t 用户）
FnOsTempOverlay.cs    源码（含 exe 入口）

提示：Renci.SshNet.dll、config.ini、fnos_temp_key 都要和 exe 放在同一目录。
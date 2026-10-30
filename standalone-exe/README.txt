linux-cpu温度 —— 独立 EXE 版 v1.0.0
====================================
这是编译好的独立程序，不再由 PowerShell 承载，托盘名显示“linux-cpu温度 v1.0.0”，
内存约 30 MB（原 PowerShell 版约 77 MB）。

要求
----
- Windows 11（系统自带 .NET Framework 4.8，无需额外安装）。
- 目标机【不能】开启“智能应用控制 Smart App Control”。
  否则会拦截未签名 exe，报错 0x800711C7。
  关闭位置：Windows 安全中心 → 应用和浏览器控制 → 智能应用控制。

使用
----
1. 把本文件夹整体拷到目标电脑（不要放 OneDrive/网络盘）。
2. 双击 FnosTempOverlay.exe 启动，托盘出现数字图标。
3. 双击托盘数字 → 设置：
   - 主机 IP/域名、SSH 用户名、端口；
   - 认证：密钥文件路径 或 密码（二选一，均可留空）；
   - 刷新间隔。
4. 需要开机自启：设置里勾“随系统启动”（会写一个静默启动本 exe 的 vbs）。
5. 退出：右键托盘图标 → 退出。

文件
----
FnosTempOverlay.exe   主程序（v1.0.0）
Renci.SshNet.dll      SSH.NET 2020（必须与 exe 同目录）
config.ini            主机/端口/用户/认证/间隔（出厂为空模板，通用）
FnOsTempOverlay.cs    源码（含 exe 入口）

通用版：不内置主机、用户名、密码、密钥，请在设置窗口中填写。
设置窗口顶部品牌行：左侧“linux-cpu温度 v1.0.0”，右侧“TXH”。

提示：Renci.SshNet.dll、config.ini 都要和 exe 放在同一目录。

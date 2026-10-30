linux-cpu温度（安装版）v1.0.0
=============================
新电脑使用：
1. 先右键 ZIP → 属性 → 勾“解除锁定” → 确定（防 Smart App Control 拦截）。
2. 解压到本地文件夹（不要直接在 ZIP 里运行，不要放 OneDrive 或网络盘）。
3. 打开 installer 目录，运行安装脚本：
   powershell -ExecutionPolicy Bypass -File install.ps1
   会自动：
   - 安装到 %LOCALAPPDATA%\Programs\FnosTempOverlay
   - 创建桌面“linux-cpu温度”快捷方式和开始菜单“启动/退出”
   - 设置开机启动并启动工具
4. 托盘出现数字后，双击数字打开设置：
   - 主机、端口、用户名
   - 认证：密钥文件路径 或 密码（二选一，均可留空）
   - 刷新间隔；需要开机自启就勾“随系统启动”
5. 显示/隐藏：设置 → 个性化 → 任务栏 → 其他系统托盘图标
   → Windows PowerShell（宿主名，不是工具名）。
停止：右键托盘数字 → 退出，或开始菜单 → 退出linux-cpu温度。
卸载：先退出，再删除安装目录和启动文件夹里的 linux-cpu温度.vbs。
说明：删除桌面快捷方式不会停止工具；程序在安装目录。

本工具为通用版：不内置主机、用户名、密码、密钥，请在设置窗口中填写。

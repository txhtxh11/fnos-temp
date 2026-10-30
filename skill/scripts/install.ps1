<#
飞牛温度工具安装器（豆包技能 fnos-temp-installer 的安装脚本）
用法:
  powershell -ExecutionPolicy Bypass -File install.ps1                # 完整安装并启动
  powershell -ExecutionPolicy Bypass -File install.ps1 -NoStart       # 只部署不启停(不碰正在运行的托盘)
  powershell -ExecutionPolicy Bypass -File install.ps1 -TargetDir "D:\tools\FnosTempOverlay"
  powershell -ExecutionPolicy Bypass -File install.ps1 -NoAutostart   # 不设置开机自启
#>
[CmdletBinding()]
param(
  [string]$TargetDir = '',
  [switch]$NoStart,
  [switch]$NoAutostart,
  [switch]$SkipShortcuts
)

$ErrorActionPreference = 'Stop'

# 定位技能 assets 目录：本脚本位于 <skill>/scripts/install.ps1
$assets = Join-Path (Split-Path $PSScriptRoot -Parent) 'assets'
if (-not (Test-Path -LiteralPath $assets)) { throw "找不到技能 assets 目录: $assets" }

if ([string]::IsNullOrWhiteSpace($TargetDir)) {
  $TargetDir = Join-Path $env:LOCALAPPDATA 'Programs\FnosTempOverlay'
}

Write-Host "安装目录: $TargetDir"
Write-Host "来源目录: $assets"

# 1. 停止旧实例 + 启动（仅完整安装模式；-NoStart 时完全不碰运行中的实例）
if (-not $NoStart) {
  $self = $PID
  $parent = (Get-CimInstance Win32_Process -Filter "ProcessId=$self" -ErrorAction SilentlyContinue).ParentProcessId
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessId -ne $self -and $_.ProcessId -ne $parent -and $_.CommandLine -match 'FnOsTempOverlay\.ps1' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 1
  Write-Host "已停止旧实例"
}

# 2. 建目录并复制文件
New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
$files = 'FnOsTempOverlay.ps1','FnOsTempOverlay.cs','Renci.SshNet.dll','fnos_temp_key.pub','启动飞牛温度.vbs','退出飞牛温度.cmd','stop.ps1'
foreach ($f in $files) {
  Copy-Item -LiteralPath (Join-Path $assets $f) -Destination $TargetDir -Force
}
# 私钥可选：存在才复制（公开仓库不含私钥，需用户自备）
if (Test-Path (Join-Path $assets 'fnos_temp_key')) {
  Copy-Item -LiteralPath (Join-Path $assets 'fnos_temp_key') -Destination $TargetDir -Force
  Write-Host "已复制私钥 fnos_temp_key"
} else {
  Write-Host "提示: assets 中无私钥 fnos_temp_key，请自行放置密钥或改用密码认证"
}
# config.ini 已存在则保留用户配置
$hadConfig = Test-Path (Join-Path $TargetDir 'config.ini')
if (-not $hadConfig) {
  Copy-Item -LiteralPath (Join-Path $assets 'config.ini') -Destination $TargetDir -Force
}
# 解除“来自 Internet”标记
Get-ChildItem -LiteralPath $TargetDir -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue

# 3. 校验关键文件
$need = @('FnOsTempOverlay.ps1','FnOsTempOverlay.cs','Renci.SshNet.dll','启动飞牛温度.vbs','退出飞牛温度.cmd','stop.ps1')
foreach ($f in $need) {
  if (-not (Test-Path (Join-Path $TargetDir $f))) { throw "安装不完整，缺少 $f" }
}
$cfgState = if ($hadConfig) { '保留用户配置' } else { '已写入默认' }
Write-Host "文件部署完成（config.ini $cfgState）"

# 4. 私钥权限：仅当前用户可读（若存在）
if (Test-Path (Join-Path $TargetDir 'fnos_temp_key')) {
  try { icacls (Join-Path $TargetDir 'fnos_temp_key') /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null } catch { }
}

# 5. 桌面 + 开始菜单快捷方式（-SkipShortcuts 时跳过，用于无副作用测试）
if (-not $SkipShortcuts) {
  $ws = New-Object -ComObject WScript.Shell
  $desk = [Environment]::GetFolderPath('Desktop')
  $lnk = $ws.CreateShortcut((Join-Path $desk '飞牛温度.lnk'))
  $lnk.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
  $lnk.Arguments = '"' + (Join-Path $TargetDir '启动飞牛温度.vbs') + '"'
  $lnk.WorkingDirectory = $TargetDir
  $lnk.IconLocation = (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe') + ',0'
  $lnk.Description = '飞牛/局域网 Linux CPU 温度'
  $lnk.Save()
  Write-Host "已创建桌面快捷方式: 飞牛温度.lnk"

  $sm = Join-Path ([Environment]::GetFolderPath('Programs')) '飞牛温度'
  New-Item -ItemType Directory -Force -Path $sm | Out-Null
  $s1 = $ws.CreateShortcut((Join-Path $sm '启动飞牛温度.lnk'))
  $s1.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
  $s1.Arguments = '"' + (Join-Path $TargetDir '启动飞牛温度.vbs') + '"'
  $s1.WorkingDirectory = $TargetDir
  $s1.IconLocation = (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe') + ',0'
  $s1.Description = '启动飞牛 CPU 温度'
  $s1.Save()
  $s2 = $ws.CreateShortcut((Join-Path $sm '退出飞牛温度.lnk'))
  $s2.TargetPath = Join-Path $TargetDir '退出飞牛温度.cmd'
  $s2.WorkingDirectory = $TargetDir
  $s2.Description = '退出飞牛 CPU 温度'
  $s2.Save()
  Write-Host "已创建开始菜单: 飞牛温度\启动/退出"
} else {
  Write-Host "已跳过快捷方式创建"
}

# 6. 开机自启（可选）
if (-not $NoAutostart) {
  $startup = Join-Path ([Environment]::GetFolderPath('Startup')) '飞牛温度.vbs'
  $startupContent = "Set sh = CreateObject(""WScript.Shell"")`r`n" +
                    "sh.Run ""wscript.exe "" & Chr(34) & ""$TargetDir\启动飞牛温度.vbs"" & Chr(34), 0, False`r`n"
  Set-Content -LiteralPath $startup -Value $startupContent -Encoding Unicode
  Write-Host "已设置开机自启: $startup"
} else {
  Write-Host "已跳过开机自启"
}

# 7. 启动（仅完整安装模式）
if (-not $NoStart) {
  Start-Process (Join-Path $env:WINDIR 'System32\wscript.exe') -ArgumentList ('"' + (Join-Path $TargetDir '启动飞牛温度.vbs') + '"')
  Start-Sleep -Seconds 2
  $running = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'FnOsTempOverlay\.ps1' }).Count
  if ($running -gt 0) { Write-Host "托盘已启动（进程数: $running）" }
  else { Write-Host "警告: 未检测到托盘进程，请双击桌面“飞牛温度”手动启动" }
}

Write-Host ''
Write-Host "======== 安装完成 ========"
Write-Host "程序目录: $TargetDir"
Write-Host "启动: 双击桌面“飞牛温度”，或开始菜单“启动飞牛温度”"
Write-Host "退出: 右键托盘图标→退出，或开始菜单“退出飞牛温度”"

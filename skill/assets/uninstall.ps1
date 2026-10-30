<#
linux-cpu温度工具卸载器
用法:
  powershell -ExecutionPolicy Bypass -File uninstall.ps1                # 停止并清除快捷方式/开机自启（保留程序文件）
  powershell -ExecutionPolicy Bypass -File uninstall.ps1 -DeleteFiles   # 同时删除程序目录
  powershell -ExecutionPolicy Bypass -File uninstall.ps1 -TargetDir "D:\tools\FnosTempOverlay"
#>
[CmdletBinding()]
param(
  [string]$TargetDir = '',
  [switch]$DeleteFiles
)

$ErrorActionPreference = 'Continue'

if ([string]::IsNullOrWhiteSpace($TargetDir)) {
  $TargetDir = Join-Path $env:LOCALAPPDATA 'Programs\FnosTempOverlay'
}

# 1. 停止托盘进程
$self = $PID
$parent = (Get-CimInstance Win32_Process -Filter "ProcessId=$self" -ErrorAction SilentlyContinue).ParentProcessId
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessId -ne $self -and $_.ProcessId -ne $parent -and $_.CommandLine -match 'FnOsTempOverlay\.ps1' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Write-Host "已停止托盘进程"

# 2. 删除开机自启
$startup = Join-Path ([Environment]::GetFolderPath('Startup')) 'linux-cpu温度.vbs'
if (Test-Path -LiteralPath $startup) { Remove-Item -LiteralPath $startup -Force -ErrorAction SilentlyContinue; Write-Host "已删除开机自启" }

# 3. 删除快捷方式
$desk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'linux-cpu温度.lnk'
if (Test-Path -LiteralPath $desk) { Remove-Item -LiteralPath $desk -Force -ErrorAction SilentlyContinue; Write-Host "已删除桌面快捷方式" }
$sm = Join-Path ([Environment]::GetFolderPath('Programs')) 'linux-cpu温度'
if (Test-Path -LiteralPath $sm) { Remove-Item -LiteralPath $sm -Recurse -Force -ErrorAction SilentlyContinue; Write-Host "已删除开始菜单" }

# 4. 可选：删除程序文件
if ($DeleteFiles) {
  if (Test-Path -LiteralPath $TargetDir) {
    Remove-Item -LiteralPath $TargetDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "已删除程序目录: $TargetDir"
  }
} else {
  Write-Host "程序文件保留在: $TargetDir（加 -DeleteFiles 可一并删除）"
}

Write-Host ''
Write-Host '======== 卸载完成 ========'

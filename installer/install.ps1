$ErrorActionPreference = 'Stop'
$src = $PSScriptRoot
$dst = Join-Path $env:LOCALAPPDATA 'Programs\FnosTempOverlay'
Write-Host "安装到: $dst"
New-Item -ItemType Directory -Force -Path $dst | Out-Null

# 解除“来自 Internet”的标记，避免 Smart App Control / Defender 拦截
Get-ChildItem $src -File -Recurse -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue

# 停止旧实例
$self = $PID
$parent = (Get-CimInstance Win32_Process -Filter "ProcessId=$self" -ErrorAction SilentlyContinue).ParentProcessId
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessId -ne $self -and $_.ProcessId -ne $parent -and $_.CommandLine -match '-File\s+"?[^"]*FnOsTempOverlay\.ps1' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

$keyDst = Join-Path $dst 'fnos_temp_key'
if (Test-Path $keyDst) {
    try { icacls $keyDst /grant:r "$($env:USERNAME):(F)" | Out-Null } catch { }
    Remove-Item $keyDst -Force -ErrorAction SilentlyContinue
}

$files = @('FnOsTempOverlay.cs','FnOsTempOverlay.ps1','Renci.SshNet.dll','fnos_temp_key.pub','README.txt')
foreach ($f in $files) {
    $p = Join-Path $src $f
    if (Test-Path $p) { Copy-Item $p $dst -Force }
}
if (-not (Test-Path (Join-Path $dst 'config.ini'))) {
    Copy-Item (Join-Path $src 'config.ini') $dst -Force
}
Get-ChildItem $dst -File -Recurse -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue

# 启动器：相对路径，整个文件夹搬走也能用
$vbs = @'
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Run "powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\FnOsTempOverlay.ps1""", 0, False
'@
$vbs | Set-Content (Join-Path $dst '启动飞牛温度.vbs') -Encoding Unicode

$stop = @'
$self = $PID
$parent = (Get-CimInstance Win32_Process -Filter "ProcessId=$self" -ErrorAction SilentlyContinue).ParentProcessId
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object { $_.ProcessId -ne $self -and $_.ProcessId -ne $parent -and $_.CommandLine -match '-File\s+"?[^"]*FnOsTempOverlay\.ps1' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
'@
$stop | Set-Content (Join-Path $dst 'stop.ps1') -Encoding ASCII
@'
@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1"
'@ | Set-Content (Join-Path $dst '退出飞牛温度.cmd') -Encoding ASCII

# 私钥权限（若存在）
if (Test-Path (Join-Path $dst 'fnos_temp_key')) {
    icacls (Join-Path $dst 'fnos_temp_key') /inheritance:r /grant:r "$($env:USERNAME):(R)" | Out-Null
}

# 桌面和开始菜单快捷方式
$ws = New-Object -ComObject WScript.Shell
$desk = [Environment]::GetFolderPath('Desktop')
$lnk = $ws.CreateShortcut((Join-Path $desk '飞牛温度.lnk'))
$lnk.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$lnk.Arguments = '"' + (Join-Path $dst '启动飞牛温度.vbs') + '"'
$lnk.WorkingDirectory = $dst
$lnk.IconLocation = (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe') + ',0'
$lnk.Description = '飞牛/局域网 Linux CPU 温度'
$lnk.Save()

$sm = Join-Path ([Environment]::GetFolderPath('Programs')) '飞牛温度'
New-Item -ItemType Directory -Force -Path $sm | Out-Null
$s1 = $ws.CreateShortcut((Join-Path $sm '启动飞牛温度.lnk'))
$s1.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$s1.Arguments = '"' + (Join-Path $dst '启动飞牛温度.vbs') + '"'
$s1.WorkingDirectory = $dst
$s1.IconLocation = (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe') + ',0'
$s1.Description = '启动飞牛 CPU 温度'
$s1.Save()
$s2 = $ws.CreateShortcut((Join-Path $sm '退出飞牛温度.lnk'))
$s2.TargetPath = Join-Path $dst '退出飞牛温度.cmd'
$s2.WorkingDirectory = $dst
$s2.Description = '退出飞牛 CPU 温度'
$s2.Save()

# 开机启动
$startup = Join-Path ([Environment]::GetFolderPath('Startup')) '飞牛温度.vbs'
$startupContent = @"
Set sh = CreateObject("WScript.Shell")
sh.Run "wscript.exe " & Chr(34) & "$dst\启动飞牛温度.vbs" & Chr(34), 0, False
"@
$startupContent | Set-Content $startup -Encoding Unicode

# 启动
Start-Process (Join-Path $env:WINDIR 'System32\wscript.exe') -ArgumentList ('"' + (Join-Path $dst '启动飞牛温度.vbs') + '"')
Write-Host ''
Write-Host '安装完成。托盘出现数字后，双击数字填写主机、端口、用户名、密码或密钥。'
Write-Host "程序目录: $dst"

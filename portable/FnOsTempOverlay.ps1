param([switch]$CompileOnly)

$ErrorActionPreference = 'Stop'

try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    Add-Type -AssemblyName System.Security

    $dll = Join-Path $PSScriptRoot 'Renci.SshNet.dll'
    if (-not (Test-Path $dll)) { throw "缺少 Renci.SshNet.dll" }

    $refs = @(
        [System.Windows.Forms.Form].Assembly.Location
        [System.Drawing.Bitmap].Assembly.Location
        [System.Security.Cryptography.ProtectedData].Assembly.Location
        $dll
    )

    $src = Get-Content -Raw -Encoding UTF8 (Join-Path $PSScriptRoot 'FnOsTempOverlay.cs')
    Add-Type -TypeDefinition $src -ReferencedAssemblies $refs

    if ($CompileOnly) {
        'compiled'
        return
    }

    [FnOsTempTray.Program]::Run($PSScriptRoot)
}
catch {
    try {
        ($_ | Out-String) | Out-File -FilePath (Join-Path $PSScriptRoot 'launcher-error.log') -Append -Encoding utf8
    } catch { }
    throw
}

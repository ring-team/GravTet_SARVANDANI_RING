# Browser launcher shared by Windows scripts. Root = execution bundle.
$ErrorActionPreference = "Stop"
$Shared = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Resolve-Path (Join-Path $Shared "..")
Set-Location $Root

$Venv = Join-Path $Root "backend\.venv\Scripts\python.exe"
function Ensure-Venv {
    if (Test-Path $Venv) { return }
    Write-Host "Python venv missing — creating backend\.venv and installing dependencies ..."
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
        Write-Error "Python not found. Install Python 3, then run .\setup.ps1"
    }
    python -m venv (Join-Path $Root "backend\.venv")
    & $Venv -m pip install -q --upgrade pip
    & $Venv -m pip install -q -r (Join-Path $Root "backend\requirements.txt")
}

Ensure-Venv
# Prefer the venv python; fall back to system python only if needed.
if (Test-Path $Venv) {
    $pythonExe = (Resolve-Path $Venv).Path
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonExe = (Get-Command python).Source
} else {
    Write-Error "Python executable not found at $Venv and python not in PATH"
}

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
& "$pythonExe" -c "import flask" 2>$null | Out-Null
$flaskMissing = ($LASTEXITCODE -ne 0)
$ErrorActionPreference = $prevEap
if ($flaskMissing) {
    Write-Host "Flask missing in venv — installing Python packages ..."
    & "$pythonExe" -m pip install -q --upgrade pip
    & "$pythonExe" -m pip install -q -r (Join-Path $Root "backend\requirements.txt")
}

$Ui = Join-Path $Root "ui\index.html"
if (-not (Test-Path $Ui)) {
    Write-Error "Built UI is missing at ui\."
}

if (-not (Test-Path (Join-Path $Root "backend"))) {
    Write-Error "backend\ is missing inside the bundle."
}

$LibDir = Join-Path $Root "backend\build\lib"
if (-not (Test-Path $LibDir)) {
    Write-Warning "backend\build\lib not found. Run .\setup.ps1 once to build C++ libraries."
}

$env:PYTHONPATH = "$(Join-Path $Root 'backend')" + $(if ($env:PYTHONPATH) { ";$($env:PYTHONPATH)" } else { "" })
# So dependent DLLs (e.g. synthetic_gravity.dll) resolve next to the solvers.
if (Test-Path $LibDir) {
    $env:PATH = "$LibDir;" + $env:PATH
}

if ($pythonExe) {
    & "$pythonExe" (Join-Path $Shared "run.py") "--browser" @args
} else {
    Write-Error "Python executable not found: $pythonExe"
}
exit $LASTEXITCODE

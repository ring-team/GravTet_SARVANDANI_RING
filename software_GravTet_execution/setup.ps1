# One-time setup for GravTet on Windows: build C++ libs + Python venv.
# Uses CMake directly (no Git Bash / WSL required).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

Write-Host "=========================================="
Write-Host "GravTet setup"
Write-Host "=========================================="

if (-not (Get-Command cmake -ErrorAction SilentlyContinue)) {
    Write-Error "cmake not found on PATH. Install CMake and reopen PowerShell."
}
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "python not found on PATH. Install Python 3 and tick 'Add Python to PATH'."
}

$BuildSystem = Join-Path $Root "backend\build_system"
$BuildDir = Join-Path $Root "backend\build"

Write-Host ""
Write-Host "[1/2] Building C++ gravity libraries ..."

# Automatic stale cache cleanup for moved/unzipped bundles (Windows paths)
if (Test-Path "$BuildDir\CMakeCache.txt") {
  $content = Get-Content "$BuildDir\CMakeCache.txt" -ErrorAction SilentlyContinue
  $recorded = ($content | Select-String 'For build in directory:') -replace '.*: ', '' | ForEach-Object { $_.Trim() } | Select-Object -First 1
  if ($recorded -and ($recorded -ne $BuildDir)) {
    Write-Host "Stale CMake cache from different path ($recorded). Auto-cleaning..."
    Remove-Item -Force -ErrorAction SilentlyContinue "$BuildDir\CMakeCache.txt", "$BuildDir\Makefile", "$BuildDir\cmake_install.cmake"
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "$BuildDir\CMakeFiles"
  }
}

# Let CMake pick the installed Visual Studio. Do not hardcode a VS year.
Write-Host "Using CMake default generator (Visual Studio on Windows)"
& cmake -S $BuildSystem -B $BuildDir
if ($LASTEXITCODE -ne 0) {
    Write-Error "CMake configure failed. Install Visual Studio Build Tools (C++ workload) and CMake."
}
& cmake --build $BuildDir --config Release --parallel
if ($LASTEXITCODE -ne 0) {
    Write-Error "C++ build failed."
}

$LibDir = Join-Path $BuildDir "lib"
if (-not (Test-Path $LibDir)) {
    Write-Error "Expected libraries under backend\build\lib after the build."
}

Write-Host ""
Write-Host "[2/2] Python virtual environment ..."
$VenvPython = Join-Path $Root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
    python -m venv (Join-Path $Root "backend\.venv")
}
& $VenvPython -m pip install -q --upgrade pip
& $VenvPython -m pip install -q -r (Join-Path $Root "backend\requirements.txt")

Write-Host ""
Write-Host "Setup complete."
Write-Host "Next: .\windows\Launch_GravTet.bat"

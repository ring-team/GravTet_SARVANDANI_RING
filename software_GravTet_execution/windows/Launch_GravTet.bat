@echo off
REM Double-click to start GravTet (uses windows\launcher.py).
cd /d "%~dp0"
where python >nul 2>&1
if errorlevel 1 (
	echo Python is not on PATH.
	echo Install Python 3 and tick "Add Python to PATH", then try again.
	pause
	exit /b 1
)
python "%~dp0launcher.py"
if errorlevel 1 pause

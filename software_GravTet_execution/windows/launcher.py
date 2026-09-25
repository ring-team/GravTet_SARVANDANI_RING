"""Windows launcher for GravTet. Double-click Launch_GravTet.bat to run this file.

Uses backend\\.venv when it exists. If the venv or C++ libraries are missing,
runs setup.ps1, then starts shared/run.py in the default browser.
"""

from __future__ import annotations

import os
import subprocess
import sys

WINDOWS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(WINDOWS_DIR, ".."))
os.chdir(ROOT)

VENV_PY = os.path.join(ROOT, "backend", ".venv", "Scripts", "python.exe")
RUN_PY = os.path.join(ROOT, "shared", "run.py")
BUILD_LIB = os.path.join(ROOT, "backend", "build", "lib")
REQUIREMENTS = os.path.join(ROOT, "backend", "requirements.txt")
SETUP_PS1 = os.path.join(ROOT, "setup.ps1")


def _run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    print("[Launcher]", " ".join(cmd))
    return subprocess.run(cmd, check=check)


def _powershell(script: str) -> int:
    completed = subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            script,
        ]
    )
    return completed.returncode


def _venv_python() -> str | None:
    return VENV_PY if os.path.isfile(VENV_PY) else None


def _module_ok(python_exe: str, module: str) -> bool:
    probe = subprocess.run(
        [python_exe, "-c", f"import {module}"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return probe.returncode == 0


def _ensure_setup() -> str:
    python_exe = _venv_python()
    libs_ok = os.path.isdir(BUILD_LIB)

    if python_exe is None or not libs_ok:
        print("[Launcher] First run or missing build: running setup.ps1 ...")
        if not os.path.isfile(SETUP_PS1):
            raise FileNotFoundError(f"setup.ps1 not found: {SETUP_PS1}")
        if _powershell(SETUP_PS1) != 0:
            raise RuntimeError("setup.ps1 failed. Install Python, CMake, and Visual Studio C++ tools.")
        python_exe = _venv_python()
        if python_exe is None:
            raise RuntimeError("backend\\.venv was not created. Is Python on PATH?")

    missing = [name for name in ("flask", "waitress") if not _module_ok(python_exe, name)]
    if missing:
        print("[Launcher] Installing Python science packages ...")
        if os.path.isfile(REQUIREMENTS):
            _run([python_exe, "-m", "pip", "install", "-r", REQUIREMENTS])
        else:
            _run([python_exe, "-m", "pip", "install", "flask", "waitress"])

    return python_exe


def _launch_env() -> dict[str, str]:
    env = os.environ.copy()
    backend = os.path.join(ROOT, "backend")
    env["PYTHONPATH"] = backend + (os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else "")
    if os.path.isdir(BUILD_LIB):
        env["PATH"] = BUILD_LIB + os.pathsep + env.get("PATH", "")
    return env


def main() -> int:
    if not os.path.isfile(RUN_PY):
        print(f"[Launcher] shared\\run.py not found: {RUN_PY}", file=sys.stderr)
        return 1

    python_exe = _ensure_setup()
    print(f"[Launcher] Starting GravTet with {python_exe}")
    result = subprocess.run([python_exe, RUN_PY, "--browser"], env=_launch_env())
    return result.returncode


if __name__ == "__main__":
    try:
        code = main()
    except Exception as exc:
        print(f"\n[Launcher] Failed: {exc}", file=sys.stderr)
        input("\nPress Enter to close...")
        raise SystemExit(1) from exc
    if code != 0:
        input("\nPress Enter to close...")
    raise SystemExit(code)

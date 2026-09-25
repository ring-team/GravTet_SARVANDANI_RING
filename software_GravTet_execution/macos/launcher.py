"""macOS launcher for GravTet.

Launcher_GravTet.command runs this file. On first use it builds the native
libraries, creates the Python environment, and starts the application in the
default web browser.
"""

from __future__ import annotations

import os
import subprocess
import sys


MACOS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(MACOS_DIR, ".."))
os.chdir(ROOT)

VENV_PY3 = os.path.join(ROOT, "backend", ".venv", "bin", "python3")
VENV_PY = os.path.join(ROOT, "backend", ".venv", "bin", "python")
RUN_PY = os.path.join(ROOT, "shared", "run.py")
BUILD_LIB = os.path.join(ROOT, "backend", "build", "lib")
REQUIREMENTS = os.path.join(ROOT, "backend", "requirements.txt")
SETUP_SH = os.path.join(ROOT, "setup.sh")


def _run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    print("[Launcher]", " ".join(cmd))
    return subprocess.run(cmd, check=check)


def _clear_macos_quarantine() -> None:
    """Drop the download quarantine flag so Finder can open the .command file."""
    subprocess.run(
        ["xattr", "-dr", "com.apple.quarantine", ROOT],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )


def _venv_python() -> str | None:
    for path in (VENV_PY3, VENV_PY):
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    return None


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
        print("[Launcher] First run or missing build: running setup.sh ...")
        if not os.path.isfile(SETUP_SH):
            raise FileNotFoundError(f"setup.sh not found: {SETUP_SH}")
        if _run(["bash", SETUP_SH], check=False).returncode != 0:
            raise RuntimeError(
                "setup.sh failed. Install Python 3, CMake, and the Xcode Command Line Tools "
                "(xcode-select --install)."
            )
        python_exe = _venv_python()
        if python_exe is None:
            raise RuntimeError("backend/.venv was not created. Is python3 installed?")

    missing = [name for name in ("flask", "waitress") if not _module_ok(python_exe, name)]
    if missing:
        print("[Launcher] Installing Python science packages ...")
        _run([python_exe, "-m", "pip", "install", "-r", REQUIREMENTS])

    return python_exe


def _launch_env() -> dict[str, str]:
    env = os.environ.copy()
    backend = os.path.join(ROOT, "backend")
    env["PYTHONPATH"] = backend + (os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else "")
    if os.path.isdir(BUILD_LIB):
        env["DYLD_LIBRARY_PATH"] = BUILD_LIB + (
            os.pathsep + env["DYLD_LIBRARY_PATH"] if env.get("DYLD_LIBRARY_PATH") else ""
        )
    return env


def main() -> int:
    _clear_macos_quarantine()
    if not os.path.isfile(RUN_PY):
        print(f"[Launcher] shared/run.py not found: {RUN_PY}", file=sys.stderr)
        return 1

    python_exe = _ensure_setup()
    print(f"[Launcher] Starting GravTet with {python_exe}")
    return subprocess.run([python_exe, RUN_PY, "--browser"], env=_launch_env()).returncode


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"\n[Launcher] Failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc

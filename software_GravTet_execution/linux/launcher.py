"""Linux launcher for GravTet. Launch_GravTet.sh runs this file.

Uses backend/.venv when it exists. If the venv or C++ libraries are missing,
runs setup.sh, then starts shared/run.py in the default browser.
"""

from __future__ import annotations

import os
import subprocess
import sys

LINUX_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(LINUX_DIR, ".."))
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


def _launch_env() -> dict[str, str]:
    env = os.environ.copy()
    backend = os.path.join(ROOT, "backend")
    env["PYTHONPATH"] = backend + (os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else "")
    if os.path.isdir(BUILD_LIB):
        env["LD_LIBRARY_PATH"] = BUILD_LIB + (
            os.pathsep + env["LD_LIBRARY_PATH"] if env.get("LD_LIBRARY_PATH") else ""
        )
    return env


def _ensure_setup() -> str:
    python_exe = _venv_python()
    libs_ok = os.path.isdir(BUILD_LIB)

    if python_exe is None or not libs_ok:
        print("[Launcher] First run or missing build: running setup.sh ...")
        if not os.path.isfile(SETUP_SH):
            raise FileNotFoundError(f"setup.sh not found: {SETUP_SH}")
        if _run(["bash", SETUP_SH], check=False).returncode != 0:
            raise RuntimeError(
                "setup.sh failed. Need python3 (with venv), cmake, and g++ on PATH. "
                "On a locked lab machine try: module load python cmake gcc. "
                "On Ubuntu/Debian: sudo apt install python3 python3-venv python3-pip cmake g++."
            )
        python_exe = _venv_python()
        if python_exe is None:
            raise RuntimeError("backend/.venv was not created. Is python3 installed?")

    missing = [name for name in ("flask", "waitress") if not _module_ok(python_exe, name)]
    if missing:
        print("[Launcher] Installing Python science packages ...")
        if os.path.isfile(REQUIREMENTS):
            _run([python_exe, "-m", "pip", "install", "-r", REQUIREMENTS])
        else:
            _run([python_exe, "-m", "pip", "install", "flask", "waitress"])

    return python_exe


def main() -> int:
    if not os.path.isfile(RUN_PY):
        print(f"[Launcher] shared/run.py not found: {RUN_PY}", file=sys.stderr)
        return 1

    python_exe = _ensure_setup()
    print(f"[Launcher] Starting GravTet with {python_exe}")
    result = subprocess.run([python_exe, RUN_PY, "--browser"], env=_launch_env())
    return result.returncode


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"\n[Launcher] Failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc

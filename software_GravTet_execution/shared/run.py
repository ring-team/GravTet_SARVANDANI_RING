#!/usr/bin/env python3
"""GravTet launcher: existing Flask API + built UI in one process.

Does not start Vite dev server.
"""

from __future__ import annotations

import argparse
import multiprocessing
import os
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser

from pathlib import Path

from paths import (
    BACKEND_DIR,
    DEFAULT_HOST,
    DEFAULT_PORT,
    LIB_DIR,
    PROJECT_ROOT,
    UI_DIR,
    apply_runtime_env,
    ensure_backend_on_path,
)
from serve import attach_ui


def _port_free(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError:
            return False
    return True


def _pick_port(host: str, preferred: int) -> int:
    if _port_free(host, preferred):
        return preferred
    for port in range(preferred + 1, preferred + 20):
        if _port_free(host, port):
            return port
    raise RuntimeError(f"No free port near {preferred}")


def _redirect_frozen_stdio() -> None:
    if not getattr(sys, "frozen", False):
        return
    log_path = Path.home() / ".gravtet.log"
    try:
        handle = open(log_path, "a", encoding="utf-8", buffering=1)
    except OSError:
        return
    sys.stdout = handle
    sys.stderr = handle
    print(f"\n--- GravTet {time.strftime('%Y-%m-%d %H:%M:%S')} ---")
    print(f"executable={sys.executable}")
    print(f"MEIPASS={getattr(sys, '_MEIPASS', None)}")


def _keep_alive() -> None:
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        print("\nStopped.", flush=True)


def _wait_until_healthy(health_url: str, timeout_s: float = 30.0) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(health_url, timeout=2) as response:
                if response.status == 200:
                    return True
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(0.25)
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Run GravTet locally.")
    parser.add_argument("--host", default=os.environ.get("GRAVTET_HOST", DEFAULT_HOST))
    parser.add_argument("--port", type=int, default=int(os.environ.get("GRAVTET_PORT", DEFAULT_PORT)))
    parser.add_argument(
        "--browser",
        action="store_true",
        help="Open the system browser instead of a native window.",
    )
    parser.add_argument(
        "--no-window",
        action="store_true",
        help="Serve UI+API only (no browser, no native window).",
    )
    args = parser.parse_args()

    _redirect_frozen_stdio()
    apply_runtime_env()
    os.chdir(PROJECT_ROOT)
    ensure_backend_on_path()

    if not (UI_DIR / "index.html").is_file():
        print("UI is missing at ui/index.html.", file=sys.stderr)
        return 1

    if not BACKEND_DIR.is_dir() and not getattr(sys, "frozen", False):
        print(f"Backend not found at {BACKEND_DIR}", file=sys.stderr)
        return 1

    from api.gravity.api_server import app

    attach_ui(app, UI_DIR)
    port = _pick_port(args.host, args.port)
    origin = f"http://{args.host}:{port}"
    home = f"{origin}/homepage"
    health = f"{origin}/api/health"

    print("GravTet")
    try:
        ui_rel = UI_DIR.relative_to(PROJECT_ROOT)
        lib_rel = LIB_DIR.relative_to(PROJECT_ROOT)
    except Exception:
        ui_rel = UI_DIR
        lib_rel = LIB_DIR
    print(f"  UI:     {ui_rel}")
    print(f"  Native: {lib_rel}")
    if args.browser:
        print("  Launch: browser")
    print(f"  Open:   {home}")
    print("  Stop:   close the window, or Ctrl+C")

    def _run_flask() -> None:
        # Waitress is a small production WSGI server (Windows/macOS/Linux).
        # Avoids Flask's "development server" warning for this local desktop app.
        from waitress import serve

        serve(app, host=args.host, port=port, threads=8)

    threading.Thread(target=_run_flask, name="gravtet-flask", daemon=True).start()


    if args.no_window:
        if not _wait_until_healthy(health):
            print(f"Server did not become ready at {health}", file=sys.stderr)
            return 1
        print("Serving without a window. Ctrl+C to stop.", flush=True)
        _keep_alive()
        return 0

    if _wait_until_healthy(health):
        opened = webbrowser.open(home)
        if not opened:
            print(f"Browser did not open automatically. Open this URL:\n  {home}", flush=True)
    else:
        print(f"Server did not become ready; open {home} manually.", flush=True)
    _keep_alive()
    return 0


if __name__ == "__main__":
    multiprocessing.freeze_support()
    raise SystemExit(main())

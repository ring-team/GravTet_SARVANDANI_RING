"""Attach the built UI to the Flask gravity app."""

from pathlib import Path
from typing import Optional

from flask import send_from_directory


def attach_ui(app, ui_dir: Path) -> None:
    ui_root = ui_dir.resolve()

    @app.route("/assets/<path:filename>")
    def serve_assets(filename: str):
        # Serve files from ui/assets when requested via /assets/...
        return send_from_directory(ui_root / "assets", filename)

    @app.route("/logo/<path:filename>")
    def serve_logo(filename: str):
        # Serve logo files from ui/logo when requested via /logo/...
        return send_from_directory(ui_root / "logo", filename)

    def _safe_file(rel: str) -> Optional[Path]:
        if not rel or rel.endswith("/"):
            return None
        candidate = (ui_root / rel).resolve()
        try:
            candidate.relative_to(ui_root)
        except ValueError:
            return None
        return candidate if candidate.is_file() else None

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_ui(path: str):
        if path == "api" or path.startswith("api/"):
            return ("Not Found", 404)
        found = _safe_file(path)
        if found is not None:
            return send_from_directory(ui_root, str(found.relative_to(ui_root)))
        return send_from_directory(ui_root, "index.html")

#!/usr/bin/env python3
"""Thin launcher kept for backward compatibility.

Main implementation now lives under backend/api/.
"""

import os

from api.app import app


# --- CLI entry (dev / legacy launcher) ---

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5002))
    print("Starting Flask API server...")
    print(f"Listening on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=True, threaded=True, use_reloader=False)

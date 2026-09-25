#!/usr/bin/env python3
"""Benchmark Barnes–Hut before/after API refactors.

Run from repo root::

    cd backend && .venv/bin/python tests/benchmark_barnes_hut_refactor.py --label before

Compare labels::

    cd backend && .venv/bin/python tests/benchmark_barnes_hut_refactor.py --compare before after
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from api.gravity.api_server import app  # noqa: E402


def _cube_payload(*, nx: int = 6, ny: int = 6, nz: int = 6, rx: int = 24, ry: int = 24) -> dict:
    return {
        "modelType": "Cube - Hexahedral",
        "numSourcesX": nx,
        "numSourcesY": ny,
        "numSourcesZ": nz,
        "numReceiversX": rx,
        "numReceiversY": ry,
        "cubeX": 100.0,
        "cubeY": 100.0,
        "cubeZ": 100.0,
        "density": 2500.0,
        "centerZ": -52.0,
        "theta0": 0.5,
    }


def _tetra_payload(*, nx: int = 4, ny: int = 4, nz: int = 4, rx: int = 20, ry: int = 20) -> dict:
    return {
        "modelType": "Cube - Tetrahedral",
        "numSourcesX": nx,
        "numSourcesY": ny,
        "numSourcesZ": nz,
        "numReceiversX": rx,
        "numReceiversY": ry,
        "cubeX": 100.0,
        "cubeY": 100.0,
        "cubeZ": 100.0,
        "density": 2500.0,
        "centerZ": -52.0,
        "theta0": 0.5,
    }


def _flatten_results(body: dict | None) -> list[float]:
    if not isinstance(body, dict):
        return []
    results = body.get("results") or []
    if not results:
        return []
    if isinstance(results[0], (list, tuple)):
        return [float(v) for row in results for v in row]
    return [float(v) for v in results]


def _run_case(client, payload: dict, repeats: int, warmup: int) -> dict:
    for _ in range(warmup):
        resp = client.post("/api/compute_gravity_barnes_hut", json=payload)
        if resp.status_code != 200:
            raise RuntimeError(f"warmup failed: {resp.status_code} {resp.get_json()}")
    samples_ms: list[float] = []
    last_body: dict | None = None
    for _ in range(repeats):
        t0 = time.perf_counter()
        resp = client.post("/api/compute_gravity_barnes_hut", json=payload)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        if resp.status_code != 200:
            raise RuntimeError(f"request failed: {resp.status_code} {resp.get_json()}")
        last_body = resp.get_json()
        samples_ms.append(elapsed_ms)
    flat = _flatten_results(last_body)
    checksum = round(sum(flat), 6) if flat else 0.0
    solver_meta = last_body.get("solver_meta") if isinstance(last_body, dict) else {}
    return {
        "median_ms": float(statistics.median(samples_ms)),
        "spread_ms": float(max(samples_ms) - min(samples_ms)),
        "checksum": checksum,
        "num_sources": last_body.get("num_sources") if isinstance(last_body, dict) else None,
        "input_mode": solver_meta.get("input_mode") if isinstance(solver_meta, dict) else None,
        "native_entrypoint": solver_meta.get("native_entrypoint") if isinstance(solver_meta, dict) else None,
    }


def _benchmark(repeats: int, warmup: int) -> dict:
    client = app.test_client()
    health = client.get("/api/health").get_json()
    if not health.get("barnes_hut_loaded"):
        raise SystemExit("Barnes–Hut library not loaded. Build backend native libs first.")
    return {
        "legacy_cube": _run_case(client, _cube_payload(), repeats, warmup),
        "tetra_mesh": _run_case(client, _tetra_payload(), repeats, warmup),
    }


def _results_dir() -> Path:
    d = BACKEND_DIR / "tests" / ".benchmark_results"
    d.mkdir(parents=True, exist_ok=True)
    return d


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--label", help="Save benchmark snapshot under this label")
    parser.add_argument("--compare", nargs=2, metavar=("A", "B"), help="Compare two saved labels")
    parser.add_argument("--repeats", type=int, default=5)
    parser.add_argument("--warmup", type=int, default=1)
    args = parser.parse_args()

    if args.compare:
        a_path = _results_dir() / f"{args.compare[0]}.json"
        b_path = _results_dir() / f"{args.compare[1]}.json"
        if not a_path.exists() or not b_path.exists():
            print("Missing benchmark files:", a_path, b_path, file=sys.stderr)
            return 1
        a = json.loads(a_path.read_text())
        b = json.loads(b_path.read_text())
        print(json.dumps({"before": a, "after": b}, indent=2))
        for case in ("legacy_cube", "tetra_mesh"):
            am = a[case]["median_ms"]
            bm = b[case]["median_ms"]
            ratio = bm / am if am > 0 else float("nan")
            print(f"{case}: median {am:.2f} ms -> {bm:.2f} ms ({ratio:.3f}x)")
            if a[case]["checksum"] != b[case]["checksum"]:
                print(f"  WARNING: checksum changed {a[case]['checksum']} -> {b[case]['checksum']}")
            else:
                print(f"  checksum OK ({a[case]['checksum']})")
        return 0

    if not args.label:
        parser.error("provide --label or --compare")

    result = {
        "label": args.label,
        "repeats": args.repeats,
        "warmup": args.warmup,
        **_benchmark(args.repeats, args.warmup),
    }
    out = _results_dir() / f"{args.label}.json"
    out.write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Benchmark quadrature second-order native forward vs execution_mode.

Run from repo root::

    python3 backend/tests/benchmark_quadrature_execution_modes.py

Or with custom workload (grid cells = nx*ny*nz hexa cells × 5 tets)::

    python3 backend/tests/benchmark_quadrature_execution_modes.py --nx 12 --ny 12 --nz 12 --rx 48 --ry 48

``reference`` (mode 3) is intentionally slow (no precompute, ``pow``, optnone/O0).
``simd_threading_tiled`` (mode 2) is the fast path used by default in the app.

**Important:** On small receiver grids the dense sum is cheap and **mesh generation**
can dominate; modes then look similar. Use a larger ``rx×ry`` (e.g. 80×80) with a
moderate cell count so the **reference** path’s per-(receiver, cell) geometry
recompute shows up — then speedups on the order of **tens–80×** vs
``simd_threading_tiled`` are expected (matches paper-style tables).
"""

from __future__ import annotations

import argparse
import ctypes
import statistics
import sys
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from api.gravity.shared.constants import QUADRATURE_SECOND_ORDER_LIB_PATH  # noqa: E402
from api.gravity.forward_methods.quadrature.ffi import QuadratureModelParams  # noqa: E402
from api.gravity.shared.helpers import create_quadrature_model_params  # noqa: E402
from api.gravity.shared.libraries import load_libraries  # noqa: E402


def _median_ms(fn, warmup: int, repeats: int) -> tuple[float, float]:
    for _ in range(warmup):
        fn()
    samples: list[float] = []
    for _ in range(repeats):
        t0 = time.perf_counter()
        fn()
        samples.append((time.perf_counter() - t0) * 1000.0)
    return statistics.median(samples), max(samples) - min(samples)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--nx",
        type=int,
        default=8,
        help="Source grid X (hexa cells; tetra count ≈ nx·ny·nz·5)",
    )
    p.add_argument("--ny", type=int, default=8, help="Source grid Y")
    p.add_argument("--nz", type=int, default=8, help="Source grid Z")
    p.add_argument(
        "--rx",
        type=int,
        default=80,
        help="Receivers along X (large grids amplify mode-3 vs optimized gap)",
    )
    p.add_argument("--ry", type=int, default=80, help="Receivers along Y")
    p.add_argument("--warmup-fast", type=int, default=1)
    p.add_argument("--repeats-fast", type=int, default=5)
    p.add_argument("--warmup-ref", type=int, default=0, help="Warmup for mode 3 (usually 0; very slow)")
    p.add_argument("--repeats-ref", type=int, default=2)
    args = p.parse_args()

    if not QUADRATURE_SECOND_ORDER_LIB_PATH.exists():
        print(f"Missing library: {QUADRATURE_SECOND_ORDER_LIB_PATH}", file=sys.stderr)
        print("Build backend native targets first (see README).", file=sys.stderr)
        return 1

    libs = load_libraries()
    if not libs.quadrature_second_order:
        print("Quadrature library failed to load.", file=sys.stderr)
        return 1

    lib = libs.quadrature_second_order
    n_cells = args.nx * args.ny * args.nz * 12
    n_rec = args.rx * args.ry
    print(f"Library: {QUADRATURE_SECOND_ORDER_LIB_PATH}")
    print(f"Workload: ~{n_cells} tetra cells, {n_rec} receivers (dense quadrature sum).")
    print()

    base = {
        "modelType": "Cube - Tetrahedral",
        "numSourcesX": args.nx,
        "numSourcesY": args.ny,
        "numSourcesZ": args.nz,
        "numReceiversX": args.rx,
        "numReceiversY": args.ry,
        "cubeX": 100.0,
        "cubeY": 100.0,
        "cubeZ": 100.0,
        "density": 2500.0,
        "centerZ": -52.0,
        "numThreads": 0,
    }

    modes = [
        ("reference", 3, args.warmup_ref, args.repeats_ref),
        ("tiled", 0, args.warmup_fast, args.repeats_fast),
        ("simd_tiled", 1, args.warmup_fast, args.repeats_fast),
        ("simd_tiled_threading", 2, args.warmup_fast, args.repeats_fast),
    ]

    results: list[tuple[str, int, float, float]] = []

    for label, em, wu, rep in modes:
        data = dict(base)
        data["executionMode"] = label
        params = create_quadrature_model_params(data)
        assert int(params.execution_mode) == em

        def run_once() -> None:
            rs = ctypes.c_int(0)
            ptr = lib.forward_gravity_quadrature_model(ctypes.byref(params), ctypes.byref(rs))
            if not ptr or rs.value <= 0:
                raise RuntimeError(f"{label}: forward returned empty (ptr={ptr!r}, size={rs.value})")
            lib.free_quadrature_result(ptr)

        med, spread = _median_ms(run_once, warmup=wu, repeats=rep)
        results.append((label, em, med, spread))
        print(f"  {label:24s}  median {med:10.2f} ms   (spread {spread:.2f} ms, repeats={rep})")

    print()
    ref_med = next(r[2] for r in results if r[1] == 3)
    fast_med = next(r[2] for r in results if r[1] == 2)
    tiled_med = next(r[2] for r in results if r[1] == 0)
    print(f"Speedup reference(3) / simd_threading_tiled(2): {ref_med / fast_med:.2f}x")
    print(f"Speedup reference(3) / reference_tiled(0):        {ref_med / tiled_med:.2f}x")
    print(f"Ratio simd_threading_tiled / reference_tiled:    {tiled_med / fast_med:.2f}x (often ~1 on memory-bound runs)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

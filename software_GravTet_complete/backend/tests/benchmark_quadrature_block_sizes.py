#!/usr/bin/env python3
"""Compare quadrature tiled-mode timing vs receiver/source block sizes (Br, Bs).

Rebuild the native library first if you changed C++::

    cd backend && bash ./build_system/build.sh

Then from the project root::

    python3 backend/tests/benchmark_quadrature_block_sizes.py
    python3 backend/tests/benchmark_quadrature_block_sizes.py --br 16,64,256 --bs 64,512,2048
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
from api.gravity.shared.helpers import create_quadrature_model_params  # noqa: E402
from api.gravity.shared.libraries import load_libraries  # noqa: E402


def _parse_int_list(s: str) -> list[int]:
    return [int(x.strip()) for x in s.split(",") if x.strip()]


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
    p.add_argument("--nx", type=int, default=8)
    p.add_argument("--ny", type=int, default=8)
    p.add_argument("--nz", type=int, default=8)
    p.add_argument("--rx", type=int, default=64)
    p.add_argument("--ry", type=int, default=64)
    p.add_argument(
        "--mode",
        default="simd_tiled",
        choices=("tiled", "simd_tiled", "simd_tiled_threading"),
        help="Tiled execution mode (reference ignores Br/Bs)",
    )
    p.add_argument("--br", default="16,64,256", help="Comma-separated receiver block sizes")
    p.add_argument("--bs", default="64,512,2048", help="Comma-separated source/cell block sizes")
    p.add_argument("--warmup", type=int, default=1)
    p.add_argument("--repeats", type=int, default=5)
    p.add_argument("--num-threads", type=int, default=0, help="Only for simd_tiled_threading")
    args = p.parse_args()

    if not QUADRATURE_SECOND_ORDER_LIB_PATH.exists():
        print(f"Missing library: {QUADRATURE_SECOND_ORDER_LIB_PATH}", file=sys.stderr)
        print("Build with: cd backend && bash ./build_system/build.sh", file=sys.stderr)
        return 1

    libs = load_libraries()
    if not libs.quadrature_second_order:
        print("Quadrature library failed to load.", file=sys.stderr)
        return 1

    lib = libs.quadrature_second_order
    br_list = _parse_int_list(args.br)
    bs_list = _parse_int_list(args.bs)
    n_cells = args.nx * args.ny * args.nz * 12
    n_rec = args.rx * args.ry
    print(f"Library: {QUADRATURE_SECOND_ORDER_LIB_PATH}")
    print(f"Mode: {args.mode}  |  ~{n_cells} tetra cells, {n_rec} receivers")
    print(f"Sweep Br={br_list}  Bs={bs_list}")
    print()
    print(f"{'Br':>6} {'Bs':>6} {'median_ms':>12} {'spread_ms':>10}")

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
        "executionMode": args.mode,
        "numThreads": args.num_threads,
    }

    best: tuple[float, int, int] | None = None
    for br in br_list:
        for bs in bs_list:
            data = dict(base)
            data["receiverBlockSize"] = br
            data["sourceBlockSize"] = bs
            params = create_quadrature_model_params(data)
            assert int(params.receiver_block_size) == br
            assert int(params.source_block_size) == bs

            def run_once() -> None:
                rs = ctypes.c_int(0)
                ptr = lib.forward_gravity_quadrature_model(ctypes.byref(params), ctypes.byref(rs))
                if not ptr or rs.value <= 0:
                    raise RuntimeError(f"forward empty (Br={br}, Bs={bs}, size={rs.value})")
                lib.free_quadrature_result(ptr)

            med, spread = _median_ms(run_once, warmup=args.warmup, repeats=args.repeats)
            print(f"{br:6d} {bs:6d} {med:12.2f} {spread:10.2f}")
            if best is None or med < best[0]:
                best = (med, br, bs)

    if best is not None:
        print()
        print(f"Fastest in this sweep: Br={best[1]}, Bs={best[2]}  ({best[0]:.2f} ms median)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

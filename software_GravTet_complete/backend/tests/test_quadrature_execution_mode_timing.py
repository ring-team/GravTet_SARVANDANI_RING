"""Native quadrature: execution modes must differ; reference vs fast path ~paper-scale.

Requires ``backend/build/lib/libquadrature_second_order_gravity.{dylib,so}``.
Skipped automatically if the library is missing (e.g. CI without a C++ build).

The ``reference`` (mode 3) path recomputes tetra quadrature geometry for every
(receiver, cell) pair; ``simd_tiled_threading`` (mode 2) precomputes once and uses
SIMD + threads. On a moderate dense grid the ratio is tens–80×; on tiny grids
all modes can look similar because work is negligible or mesh build dominates.
"""

from __future__ import annotations

import ctypes
import statistics
import sys
import time
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from api.gravity.shared.constants import QUADRATURE_SECOND_ORDER_LIB_PATH  # noqa: E402
from api.gravity.shared.helpers import create_quadrature_model_params  # noqa: E402
from api.gravity.shared.libraries import load_libraries  # noqa: E402


def _median_ms(callable_run, repeats: int) -> float:
    samples = []
    for _ in range(repeats):
        t0 = time.perf_counter()
        callable_run()
        samples.append((time.perf_counter() - t0) * 1000.0)
    return float(statistics.median(samples))


@pytest.mark.skip(
    reason="Catalog Tetrahedral uses server Gmsh mesh; legacy synthetic quadrature cell generation was removed.",
)
@pytest.mark.skipif(
    not QUADRATURE_SECOND_ORDER_LIB_PATH.exists(),
    reason="Quadrature native library not built",
)
def test_quadrature_reference_much_slower_than_simd_tiled_threading():
    libs = load_libraries()
    assert libs.quadrature_second_order is not None
    lib = libs.quadrature_second_order

    base = {
        "modelType": "Cube - Tetrahedral",
        "numSourcesX": 8,
        "numSourcesY": 8,
        "numSourcesZ": 8,
        "numReceiversX": 64,
        "numReceiversY": 64,
        "cubeX": 100.0,
        "cubeY": 100.0,
        "cubeZ": 100.0,
        "density": 2500.0,
        "centerZ": -52.0,
        "numThreads": 0,
    }

    def forward_ms(execution_mode: str, repeats: int) -> float:
        data = dict(base)
        data["executionMode"] = execution_mode
        params = create_quadrature_model_params(data)

        def once() -> None:
            rs = ctypes.c_int(0)
            ptr = lib.forward_gravity_quadrature_model(ctypes.byref(params), ctypes.byref(rs))
            assert ptr and rs.value > 0
            lib.free_quadrature_result(ptr)

        return _median_ms(once, repeats=repeats)

    t_ref = forward_ms("reference", repeats=1)
    t_fast = forward_ms("simd_tiled_threading", repeats=3)
    t_tiled = forward_ms("tiled", repeats=2)

    assert t_ref > t_fast * 20.0, (
        f"expected reference (mode 3) >> simd_tiled_threading (mode 2); "
        f"got ref={t_ref:.1f} ms vs fast={t_fast:.1f} ms "
        f"(ratio {t_ref / max(t_fast, 1e-9):.1f}x). "
        "If this fails on a very small machine, widen workload in this test."
    )
    assert t_ref > t_tiled * 2.0, (
        f"expected reference slower than tiled; ref={t_ref:.1f} ms tiled={t_tiled:.1f} ms"
    )
    assert t_tiled > t_fast * 1.5, (
        f"expected simd_tiled_threading faster than tiled on this workload; "
        f"tiled={t_tiled:.1f} ms fast={t_fast:.1f} ms"
    )

"""Compare Cube-Tetra mesh prep + solver timing across forward methods.

Run: cd backend && .venv/bin/python tests/benchmark_cube_tetra_methods.py
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, ".")

from api.gravity.mesh.mesh_route_utils import _gmsh_mesh_cache_key

BASE = "http://127.0.0.1:5002"


def post(path: str, body: dict) -> tuple[dict, float]:
    data = json.dumps(body).encode()
    req = urllib.request.Request(BASE + path, data=data, headers={"Content-Type": "application/json"})
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=300) as resp:
        out = json.loads(resp.read().decode())
    return out, (time.perf_counter() - t0) * 1000.0


def warm_body() -> dict:
    return {
        "modelType": "Cube - Tetrahedral",
        "centerX": 0,
        "centerY": 0,
        "centerZ": -50,
        "h": 0,
        "density": 2500,
        "targetElementSize": 2.0,
        "surfaceRefinement": 0.4,
        "localRefinementNearEdges": 0.4,
        "cubeX": 100,
        "cubeY": 100,
        "cubeZ": 100,
        "warmCacheOnly": True,
        "warmCenterZ": -80,
        "numSourcesX": 40,
        "numSourcesY": 40,
        "numSourcesZ": 20,
    }


def calc_body() -> dict:
    return {
        "modelType": "Cube - Tetrahedral",
        "centerX": 0,
        "centerY": 0,
        "centerZ": -80,
        "h": 30,
        "density": 2500,
        "numSourcesX": 40,
        "numSourcesY": 40,
        "numSourcesZ": 20,
        "numReceiversX": 100,
        "numReceiversY": 100,
        "surfaceXMin": -150,
        "surfaceXMax": 150,
        "surfaceYMin": -150,
        "surfaceYMax": 150,
        "surfaceZ": 0,
        "targetElementSize": 2.0,
        "surfaceRefinement": 0.4,
        "localRefinementNearEdges": 0.4,
        "cubeX": 100,
        "cubeY": 100,
        "cubeZ": 100,
        "theta0": 0.5,
    }


def summarize(label: str, resp: dict, wall_ms: float) -> None:
    gb = (resp.get("solver_meta") or {}).get("gmshBuild") or {}
    total = resp.get("total_ms")
    compute = resp.get("compute_ms")
    hidden = (total - compute) if isinstance(total, (int, float)) and isinstance(compute, (int, float)) else None
    print(
        f"{label:28} wall={wall_ms:8.0f} ms  total={total!s:>8}  compute={compute!s:>8}"
        f"  hidden={hidden!s:>8}  gmshCacheHit={gb.get('cacheHit')}  gmshBuildMs={gb.get('buildMs')}"
    )


def main() -> None:
    warm = warm_body()
    calc = calc_body()
    print("cache keys match:", _gmsh_mesh_cache_key(warm) == _gmsh_mesh_cache_key(calc))
    print("mesh: targetElementSize=2.0, ~2.7M elements when cold\n")

    print("=== A) Cold calculate (no prior warm) ===")
    for name, path in [
        ("Direct Newton", "/api/compute_gravity"),
        ("Quadrature", "/api/compute_gravity_quadrature"),
        ("Barnes-Hut", "/api/compute_gravity_barnes_hut"),
    ]:
        try:
            resp, wall = post(path, calc)
            summarize(name, resp, wall)
        except urllib.error.HTTPError as e:
            print(f"{name:28} HTTP {e.code}: {e.read().decode()[:200]}")

    print("\n=== B) After synthetic warm ===")
    warm_resp, warm_wall = post("/api/build_gmsh_tetra_mesh", warm)
    print(
        f"{'Synthetic warm':28} wall={warm_wall:8.0f} ms  buildMs={warm_resp.get('buildMs')}"
        f"  cacheHit={warm_resp.get('cacheHit')}  elements={warm_resp.get('numElements')}"
    )

    for name, path in [
        ("Direct Newton #1", "/api/compute_gravity"),
        ("Direct Newton #2", "/api/compute_gravity"),
        ("Quadrature #1", "/api/compute_gravity_quadrature"),
        ("Quadrature #2", "/api/compute_gravity_quadrature"),
        ("Barnes-Hut #1", "/api/compute_gravity_barnes_hut"),
        ("Barnes-Hut #2", "/api/compute_gravity_barnes_hut"),
    ]:
        resp, wall = post(path, calc)
        summarize(name, resp, wall)

    print("\n=== C) Redundant forward warm (should be fast when geometry already cached) ===")
    warm2_resp, warm2_wall = post("/api/build_gmsh_tetra_mesh", warm)
    print(
        f"{'Forward warm again':28} wall={warm2_wall:8.0f} ms  buildMs={warm2_resp.get('buildMs')}"
        f"  cacheHit={warm2_resp.get('cacheHit')}"
    )

    print("\nNotes:")
    print("- hidden = total_ms - compute_ms (mesh ctypes prep before solver timer)")
    print("- Barnes-Hut shows ~60ms when hidden≈0; slow first click = cold mesh/geometry cache")
    print("- Direct/Quadrature solver time dominates; Barnes-Hut solver is much faster on large meshes")
    for name, path in [
        ("Direct Newton", "/api/compute_gravity"),
        ("Quadrature", "/api/compute_gravity_quadrature"),
        ("Barnes-Hut", "/api/compute_gravity_barnes_hut"),
    ]:
        try:
            resp, wall = post(path, calc)
            summarize(name, resp, wall)
        except urllib.error.HTTPError as e:
            print(f"{name:28} HTTP {e.code}: {e.read().decode()[:200]}")

    print("\n=== B) After synthetic warm ===")
    warm_resp, warm_wall = post("/api/build_gmsh_tetra_mesh", warm)
    print(
        f"{'Synthetic warm':28} wall={warm_wall:8.0f} ms  buildMs={warm_resp.get('buildMs')}"
        f"  cacheHit={warm_resp.get('cacheHit')}  elements={warm_resp.get('numElements')}"
    )

    for name, path in [
        ("Direct Newton #1", "/api/compute_gravity"),
        ("Direct Newton #2", "/api/compute_gravity"),
        ("Quadrature #1", "/api/compute_gravity_quadrature"),
        ("Quadrature #2", "/api/compute_gravity_quadrature"),
        ("Barnes-Hut #1", "/api/compute_gravity_barnes_hut"),
        ("Barnes-Hut #2", "/api/compute_gravity_barnes_hut"),
    ]:
        resp, wall = post(path, calc)
        summarize(name, resp, wall)

    print("\n=== C) Redundant forward warm (view change simulation) ===")
    warm2_resp, warm2_wall = post("/api/build_gmsh_tetra_mesh", warm)
    print(
        f"{'Forward warm again':28} wall={warm2_wall:8.0f} ms  buildMs={warm2_resp.get('buildMs')}"
        f"  cacheHit={warm2_resp.get('cacheHit')}"
    )


if __name__ == "__main__":
    main()

"""Shared route utilities for mesh-first payload gating."""

from __future__ import annotations

import copy
import ctypes
import json
import logging
import os
import time
from collections import OrderedDict
from threading import Lock
from typing import Any

LEGACY_SHAPE_KEYS = (
    "modelType",
    "cubeX",
    "cubeY",
    "cubeZ",
    "sphereRadius",
    "ellipsoidA",
    "numSourcesX",
    "numSourcesY",
    "numSourcesZ",
)

GMSH_MESH_CACHE_MAX_ENTRIES = int(os.environ.get("GMSH_MESH_CACHE_MAX_ENTRIES", "8"))
_GMSH_MESH_CACHE: OrderedDict[str, dict[str, Any]] = OrderedDict()
_GMSH_MESH_CACHE_LOCK = Lock()
_TETRA_GEOMETRY_CACHE: OrderedDict[str, tuple[Any, Any]] = OrderedDict()
_TETRA_GEOMETRY_CACHE_LOCK = Lock()
_TRANSLATED_NODE_CACHE: OrderedDict[str, Any] = OrderedDict()
_TRANSLATED_NODE_CACHE_LOCK = Lock()
_GMSH_COMPUTE_ONLY_KEYS = {
    "numSourcesX",
    "numSourcesY",
    "numSourcesZ",
    "numReceiversX",
    "numReceiversY",
    "surfaceXMin",
    "surfaceXMax",
    "surfaceYMin",
    "surfaceYMax",
    "surfaceZ",
    "executionMode",
    "numThreads",
    "receiverBlockSize",
    "sourceBlockSize",
    "warmCenterZ",
    "theta0",
    "criticalDistanceFactor",
    "maxDepth",
    "maxSourcesPerNode",
}
_GMSH_RESPONSE_ONLY_KEYS = {
    "countOnly",
    "warmCacheOnly",
    "mesh",
}
_GMSH_DEPTH_KEYS = {
    "h",
    "sphereH",
    "ellipsoidH",
    "verticalCylinderH",
    "horizontalCylinderH",
    "faultedBlockH",
    "cube1H",
    "cube2H",
    "cube3H",
    "cube4H",
}

_GMSH_SHARED_MESH_KEYS = {
    "modelType",
    "centerX",
    "centerY",
    "centerZ",
    "density",
    "targetElementSize",
    "surfaceRefinement",
    "localRefinementNearEdges",
}

_GMSH_MODEL_MESH_KEYS = {
    "Sphere": {"sphereRadius", "sphereDensity"},
    "Cube": {"cubeX", "cubeY", "cubeZ"},
    "Rectangular Prism (Cuboid)": {"cubeX", "cubeY", "cubeZ"},
    "Ellipsoid": {"ellipsoidA", "ellipsoidB", "ellipsoidC", "ellipsoidDensity"},
    "Vertical Cylinder": {"verticalCylinderRadius", "verticalCylinderHeight", "verticalCylinderDensity"},
    "Horizontal Cylinder": {"horizontalCylinderRadius", "horizontalCylinderLength", "horizontalCylinderDensity"},
    "4 Cubes": {
        "cube1X",
        "cube1Y",
        "cube1Z",
        "cube1Density",
        "cube2X",
        "cube2Y",
        "cube2Z",
        "cube2Density",
        "cube3X",
        "cube3Y",
        "cube3Z",
        "cube3Density",
        "cube4X",
        "cube4Y",
        "cube4Z",
        "cube4Density",
        "spacingX",
        "spacingY",
    },
    "Faulted Block Model": {
        "faultedBlockX",
        "faultedBlockY",
        "faultedBlockZ",
        "faultedBlockFaultOffset",
        "density",
    },
    "Valley-Mountain Model": {
        "valleyMountainX",
        "valleyMountainY",
        "valleyMountainZ",
        "valleyMountainHeight",
        "valleyMountainDepth",
        "valleyMountainDensity",
        "valleyMountainMountainDensity",
        "valleyMountainValleyDensity",
        "valleyMountainHalfSpaceDensity",
    },
}


def _mesh_dict_has_content(mesh: dict) -> bool:
    if not isinstance(mesh, dict):
        return False
    nodes = mesh.get("nodes")
    elements = mesh.get("elements") or mesh.get("tets")
    return (
        isinstance(nodes, list)
        and len(nodes) > 0
        and isinstance(elements, list)
        and len(elements) > 0
    )


def has_mesh_payload(data: dict) -> bool:
    """Return True when request includes any supported mesh input form."""
    if not isinstance(data, dict):
        return False
    mesh = data.get("mesh")
    if mesh is not None:
        if isinstance(mesh, dict):
            return _mesh_dict_has_content(mesh)
        return True
    mesh_text = data.get("meshText")
    if isinstance(mesh_text, str) and mesh_text.strip():
        return True
    mesh_file = data.get("meshFilePath")
    return isinstance(mesh_file, str) and bool(mesh_file.strip())


def warn_if_legacy_shape_fields(logger, data: dict) -> None:
    """Log legacy shape-field usage on mesh-first routes."""
    if not isinstance(data, dict):
        return
    hit = [k for k in LEGACY_SHAPE_KEYS if k in data]
    if hit:
        logger.warning("Mesh-first route received legacy shape fields: %s", ", ".join(hit))


def is_tetrahedral_catalog_request(data: dict) -> bool:
    if not isinstance(data, dict):
        return False
    mt = str(data.get("modelType", "") or "")
    if "Unstructured Tetrahedral" in mt or "Gmsh Tetrahedral" in mt:
        return True
    return mt.endswith(" - Tetrahedral")


def is_gmsh_build_request(data: dict) -> bool:
    if not isinstance(data, dict):
        return False
    return is_tetrahedral_catalog_request(data)


def _coerce_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _base_model(data: dict) -> str:
    return str(data.get("modelType", "") or "").split(" - ")[0].strip()


def _canonical_center_z(data: dict) -> float:
    """Depth-zero center used for mesh-count/cache stability.

    Gmsh can produce slightly different tetra counts when the same shape is
    translated in Z. The paper tables used a depth-independent count, so cache
    and preview builds are anchored at the h=0 center and forward runs translate
    that cached mesh to the requested burial depth.
    """
    base = _base_model(data)
    if base == "Sphere":
        return -_coerce_float(data.get("sphereRadius"), 100.0)
    if base == "Ellipsoid":
        return -_coerce_float(data.get("ellipsoidC"), 150.0)
    if base == "Vertical Cylinder":
        return -_coerce_float(data.get("verticalCylinderHeight"), 100.0) / 2.0
    if base == "Horizontal Cylinder":
        return -_coerce_float(data.get("horizontalCylinderRadius"), 50.0)
    if base == "4 Cubes":
        return -_coerce_float(data.get("cube1Z"), 20.0) / 2.0
    if base == "Faulted Block Model":
        return -_coerce_float(data.get("faultedBlockZ"), 100.0) / 2.0
    if base == "Valley-Mountain Model":
        return -_coerce_float(data.get("valleyMountainZ", data.get("cubeZ")), 90.0) / 2.0
    if base == "Rectangular Prism (Cuboid)":
        return -_coerce_float(data.get("cubeZ"), 150.0) / 2.0
    return -_coerce_float(data.get("cubeZ"), 100.0) / 2.0


def _canonical_gmsh_mesh_data(data: dict) -> dict[str, Any]:
    base = _base_model(data)
    mesh_keys = _GMSH_SHARED_MESH_KEYS | _GMSH_MODEL_MESH_KEYS.get(base, set())
    out = {
        k: v
        for k, v in data.items()
        if k in mesh_keys and k not in _GMSH_COMPUTE_ONLY_KEYS and k not in _GMSH_RESPONSE_ONLY_KEYS
    }
    for key in _GMSH_DEPTH_KEYS:
        if key in out:
            out[key] = 0
    out["centerZ"] = _canonical_center_z(out)
    return out


def _translated_gmsh_mesh(built: dict[str, Any], dz: float) -> dict[str, Any]:
    if abs(dz) < 1e-12:
        return built
    out = copy.deepcopy(built)
    mesh = out.get("mesh")
    if not isinstance(mesh, dict):
        return out
    nodes = mesh.get("nodes")
    if not isinstance(nodes, list):
        return out
    for node in nodes:
        if isinstance(node, list) and len(node) >= 3:
            node[2] = _coerce_float(node[2], 0.0) + dz
        elif isinstance(node, dict) and "z" in node:
            node["z"] = _coerce_float(node.get("z"), 0.0) + dz
    return out


def _gmsh_mesh_cache_key(data: dict) -> str:
    mesh_inputs = _canonical_gmsh_mesh_data(data)
    return json.dumps(mesh_inputs, sort_keys=True, separators=(",", ":"), default=str)


def _get_cached_gmsh_mesh(cache_key: str) -> dict[str, Any] | None:
    if GMSH_MESH_CACHE_MAX_ENTRIES <= 0:
        return None
    with _GMSH_MESH_CACHE_LOCK:
        cached = _GMSH_MESH_CACHE.get(cache_key)
        if cached is None:
            return None
        _GMSH_MESH_CACHE.move_to_end(cache_key)
        return copy.deepcopy(cached)


def _peek_cached_gmsh_mesh(cache_key: str) -> dict[str, Any] | None:
    """Return cached mesh metadata without copying the full node/element payload."""
    if GMSH_MESH_CACHE_MAX_ENTRIES <= 0:
        return None
    with _GMSH_MESH_CACHE_LOCK:
        cached = _GMSH_MESH_CACHE.get(cache_key)
        if cached is None:
            return None
        _GMSH_MESH_CACHE.move_to_end(cache_key)
        return cached


def _gmsh_built_summary(built: dict[str, Any], model_type: str) -> dict[str, Any]:
    return {
        "numNodes": int(built.get("numNodes", 0)),
        "numElements": int(built.get("numElements", 0)),
        "modelType": built.get("modelType", model_type),
    }


def _translated_node_cache_key(geom_cache_key: str, requested_center_z: float) -> str:
    return f"{geom_cache_key}|cz={requested_center_z:.9f}"


def _is_translated_node_cached(geom_cache_key: str, requested_center_z: float) -> bool:
    tkey = _translated_node_cache_key(geom_cache_key, requested_center_z)
    with _TRANSLATED_NODE_CACHE_LOCK:
        return tkey in _TRANSLATED_NODE_CACHE


def _put_cached_gmsh_mesh(cache_key: str, built: dict[str, Any]) -> None:
    if GMSH_MESH_CACHE_MAX_ENTRIES <= 0:
        return
    with _GMSH_MESH_CACHE_LOCK:
        _GMSH_MESH_CACHE[cache_key] = copy.deepcopy(built)
        _GMSH_MESH_CACHE.move_to_end(cache_key)
        while len(_GMSH_MESH_CACHE) > GMSH_MESH_CACHE_MAX_ENTRIES:
            evicted_key, _ = _GMSH_MESH_CACHE.popitem(last=False)
            with _TETRA_GEOMETRY_CACHE_LOCK:
                _TETRA_GEOMETRY_CACHE.pop(evicted_key, None)
    _cache_tetra_geometry_from_built(cache_key, built)


def _cache_tetra_geometry_from_built(cache_key: str, built: dict[str, Any]) -> None:
    from gravity.mesh.parser import build_tetra_mesh_arrays

    mesh = built.get("mesh")
    if not isinstance(mesh, dict):
        return
    raw_nodes = mesh.get("nodes")
    raw_elements = mesh.get("elements") or mesh.get("tets")
    if not isinstance(raw_nodes, list) or not isinstance(raw_elements, list):
        return
    if not raw_nodes or not raw_elements:
        return
    with _TETRA_GEOMETRY_CACHE_LOCK:
        if cache_key in _TETRA_GEOMETRY_CACHE:
            return
    node_arr, elem_arr = build_tetra_mesh_arrays(raw_nodes, raw_elements)
    with _TETRA_GEOMETRY_CACHE_LOCK:
        if cache_key in _TETRA_GEOMETRY_CACHE:
            return
        _TETRA_GEOMETRY_CACHE[cache_key] = (node_arr, elem_arr)
        _TETRA_GEOMETRY_CACHE.move_to_end(cache_key)
        while len(_TETRA_GEOMETRY_CACHE) > GMSH_MESH_CACHE_MAX_ENTRIES:
            evicted_key, _ = _TETRA_GEOMETRY_CACHE.popitem(last=False)
            with _GMSH_MESH_CACHE_LOCK:
                _GMSH_MESH_CACHE.pop(evicted_key, None)


def _get_cached_tetra_geometry(cache_key: str) -> tuple[Any, Any] | None:
    with _TETRA_GEOMETRY_CACHE_LOCK:
        geom = _TETRA_GEOMETRY_CACHE.get(cache_key)
        if geom is None:
            return None
        _TETRA_GEOMETRY_CACHE.move_to_end(cache_key)
        return geom


def _translated_node_array(node_arr, dz: float):
    """Return a copy of *node_arr* with every node's Z coordinate shifted by *dz*.

    Uses memmove for the bulk copy and a numpy vectorised add for the Z update,
    which is orders of magnitude faster than a Python element-by-element loop on
    large (>100 k node) meshes.  Falls back to the loop if numpy is unavailable.
    """
    from gravity.mesh.types import MeshNode

    if abs(dz) < 1e-12:
        return node_arr
    n = len(node_arr)
    out = (MeshNode * n)()
    # Bulk byte copy — O(1) call into libc memmove, much faster than field loop.
    ctypes.memmove(out, node_arr, ctypes.sizeof(out))
    try:
        import numpy as np
        # MeshNode = [x: f64, y: f64, z: f64] → 3 doubles per node, z is index 2.
        # Cast the ctypes array to a flat numpy float64 view and update z column.
        flat = np.frombuffer(out, dtype=np.float64)  # length = 3 * n, read-write via buffer
        flat[2::3] += dz  # every third value starting at index 2 is z
    except Exception:
        # Numpy not available — fall back to plain loop (only z needs updating).
        for i in range(n):
            out[i].z += dz
    return out


def _node_array_for_depth(canonical_node_arr, geom_cache_key: str, requested_center_z: float, canonical_center_z: float):
    dz = requested_center_z - canonical_center_z
    if abs(dz) < 1e-12:
        return canonical_node_arr
    tkey = f"{geom_cache_key}|cz={requested_center_z:.9f}"
    with _TRANSLATED_NODE_CACHE_LOCK:
        cached = _TRANSLATED_NODE_CACHE.get(tkey)
        if cached is not None:
            _TRANSLATED_NODE_CACHE.move_to_end(tkey)
            return cached
    translated = _translated_node_array(canonical_node_arr, dz)
    with _TRANSLATED_NODE_CACHE_LOCK:
        _TRANSLATED_NODE_CACHE[tkey] = translated
        _TRANSLATED_NODE_CACHE.move_to_end(tkey)
        while len(_TRANSLATED_NODE_CACHE) > GMSH_MESH_CACHE_MAX_ENTRIES * 2:
            _TRANSLATED_NODE_CACHE.popitem(last=False)
    return translated


def _warm_tetra_geometry_for_depth(
    cache_key: str,
    built: dict[str, Any],
    requested_center_z: float,
    canonical_center_z: float,
) -> None:
    """Populate ctypes tetra arrays and the depth-shifted node cache ahead of calculate."""
    geom = _get_cached_tetra_geometry(cache_key)
    if geom is None:
        _cache_tetra_geometry_from_built(cache_key, built)
        geom = _get_cached_tetra_geometry(cache_key)
    if geom is None:
        return
    canonical_node_arr, _elem_arr = geom
    _node_array_for_depth(canonical_node_arr, cache_key, requested_center_z, canonical_center_z)


def _geometry_readiness_meta(
    cache_key: str,
    *,
    depth_center_z: float,
    canonical_center_z: float,
) -> dict[str, bool]:
    geometry_ready = _get_cached_tetra_geometry(cache_key) is not None
    dz = depth_center_z - canonical_center_z
    depth_shift_ready = geometry_ready and (
        abs(dz) < 1e-12 or _is_translated_node_cached(cache_key, depth_center_z)
    )
    return {
        "geometryReady": geometry_ready,
        "depthShiftReady": depth_shift_ready,
        "calculateReady": geometry_ready and depth_shift_ready,
    }


def _gmsh_meta_from_built(built: dict[str, Any], *, cache_hit: bool, build_ms: float = 0.0) -> dict[str, Any]:
    mesh = built.get("mesh") if isinstance(built.get("mesh"), dict) else {}
    nodes = mesh.get("nodes") if isinstance(mesh, dict) else None
    elements = None
    if isinstance(mesh, dict):
        elements = mesh.get("elements") or mesh.get("tets")
    num_nodes = int(built.get("numNodes", len(nodes) if isinstance(nodes, list) else 0))
    num_elements = int(built.get("numElements", len(elements) if isinstance(elements, list) else 0))
    return {
        "numNodes": num_nodes,
        "numElements": num_elements,
        "buildMs": build_ms,
        "cacheHit": cache_hit,
    }


def prepare_forward_tetra_mesh_input(data: dict, logger: logging.Logger | None = None):
    """Return FFI-ready tetra mesh input; Gmsh + ctypes geometry are built once and cached."""
    from gravity.mesh.parser import bind_tetra_mesh_params, create_tetra_mesh_input

    if has_mesh_payload(data):
        params, node_arr, elem_arr = create_tetra_mesh_input(data)
        return params, node_arr, elem_arr, None

    if not is_gmsh_build_request(data):
        raise ValueError("Expected a tetrahedral catalog request or explicit mesh payload.")

    build_data = _canonical_gmsh_mesh_data(data)
    cache_key = _gmsh_mesh_cache_key(build_data)
    geom = _get_cached_tetra_geometry(cache_key)
    gmsh_build_meta: dict[str, Any] | None = None

    with _GMSH_MESH_CACHE_LOCK:
        cached_built = _GMSH_MESH_CACHE.get(cache_key)

    if cached_built is None:
        built, gmsh_build_meta = build_or_get_gmsh_mesh(data, logger)
        geom = _get_cached_tetra_geometry(cache_key)
        if geom is None:
            _cache_tetra_geometry_from_built(cache_key, built)
            geom = _get_cached_tetra_geometry(cache_key)
    else:
        gmsh_build_meta = _gmsh_meta_from_built(cached_built, cache_hit=True, build_ms=0.0)
        if geom is None:
            _cache_tetra_geometry_from_built(cache_key, cached_built)
            geom = _get_cached_tetra_geometry(cache_key)

    if geom is None:
        raise RuntimeError("Gmsh tetrahedral geometry cache is missing after mesh build.")

    canonical_node_arr, elem_arr = geom
    requested_center_z = _coerce_float(data.get("centerZ"), _coerce_float(build_data.get("centerZ"), 0.0))
    canonical_center_z = _coerce_float(build_data.get("centerZ"), requested_center_z)
    node_arr = _node_array_for_depth(canonical_node_arr, cache_key, requested_center_z, canonical_center_z)
    params = bind_tetra_mesh_params(data, node_arr, elem_arr)
    return params, node_arr, elem_arr, gmsh_build_meta


def build_or_get_gmsh_mesh(
    data: dict,
    logger: logging.Logger | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build or return a cached Gmsh tetrahedral mesh for identical mesh parameters."""
    from gravity.mesh.gmsh_build import (
        build_gmsh_tetra_mesh_with_timeout,
        gmsh_python_available,
        is_gmsh_mesh_build_supported,
    )

    model_type = str(data.get("modelType", "") or "").strip()
    if not is_gmsh_mesh_build_supported(model_type):
        base = model_type.split(" - ")[0] if " - " in model_type else model_type
        raise ValueError(
            f"Tetrahedral mesh generation for '{base}' is not implemented yet. "
            "Supported: Sphere, Cube, Cuboid, Ellipsoid, Vertical/Horizontal Cylinder."
        )
    if not gmsh_python_available():
        raise ValueError(
            "Gmsh Python API is not installed on the server. "
            "Run: pip install -r backend/requirements.txt"
        )

    build_data = _canonical_gmsh_mesh_data(data)
    count_only = bool(data.get("countOnly"))
    if count_only:
        # Count previews should not allocate/serialize the full mesh. They are also
        # intentionally not stored in the mesh cache, which is reserved for forward runs.
        build_data["countOnly"] = True
        t0 = time.perf_counter()
        built = build_gmsh_tetra_mesh_with_timeout(build_data)
        build_ms = (time.perf_counter() - t0) * 1000.0
        meta = {
            "numNodes": int(built.get("numNodes", 0)),
            "numElements": int(built.get("numElements", 0)),
            "buildMs": build_ms,
            "cacheHit": False,
        }
        if logger is not None:
            logger.info(
                "build_or_get_gmsh_mesh countOnly: %s nodes=%s elements=%s build_ms=%.1f",
                model_type,
                meta["numNodes"],
                meta["numElements"],
                build_ms,
            )
        return built, meta

    cache_key = _gmsh_mesh_cache_key(build_data)
    warm_cache_only = bool(data.get("warmCacheOnly"))
    requested_center_z = _coerce_float(data.get("centerZ"), _coerce_float(build_data.get("centerZ"), 0.0))
    canonical_center_z = _coerce_float(build_data.get("centerZ"), requested_center_z)
    depth_center_z = (
        _coerce_float(data.get("warmCenterZ"), requested_center_z)
        if warm_cache_only and "warmCenterZ" in data
        else requested_center_z
    )

    if warm_cache_only:
        cached_ref = _peek_cached_gmsh_mesh(cache_key)
        if cached_ref is not None:
            readiness = _geometry_readiness_meta(
                cache_key,
                depth_center_z=depth_center_z,
                canonical_center_z=canonical_center_z,
            )
            if readiness["calculateReady"]:
                meta = {
                    "numNodes": int(cached_ref.get("numNodes", 0)),
                    "numElements": int(cached_ref.get("numElements", 0)),
                    "buildMs": 0.0,
                    "cacheHit": True,
                    **readiness,
                }
                return _gmsh_built_summary(cached_ref, model_type), meta

    if warm_cache_only:
        built = _peek_cached_gmsh_mesh(cache_key)
    else:
        built = _get_cached_gmsh_mesh(cache_key)
    cache_hit = built is not None
    if built is None:
        t0 = time.perf_counter()
        built = build_gmsh_tetra_mesh_with_timeout(build_data)
        build_ms = (time.perf_counter() - t0) * 1000.0
        if "mesh" not in built:
            raise ValueError("Gmsh mesh build did not return mesh payload.")
        _put_cached_gmsh_mesh(cache_key, built)
    else:
        build_ms = 0.0

    meta = {
        "numNodes": int(built.get("numNodes", 0)),
        "numElements": int(built.get("numElements", 0)),
        "buildMs": build_ms,
        "cacheHit": cache_hit,
    }
    if warm_cache_only:
        _warm_tetra_geometry_for_depth(cache_key, built, depth_center_z, canonical_center_z)
        meta.update(_geometry_readiness_meta(cache_key, depth_center_z=depth_center_z, canonical_center_z=canonical_center_z))
        if logger is not None:
            logger.info(
                "build_or_get_gmsh_mesh warm: %s nodes=%s elements=%s build_ms=%.1f cache_hit=%s "
                "geometry_ready=%s depth_shift_ready=%s",
                model_type,
                meta["numNodes"],
                meta["numElements"],
                build_ms,
                cache_hit,
                meta.get("geometryReady"),
                meta.get("depthShiftReady"),
            )
        return _gmsh_built_summary(built, model_type), meta

    if logger is not None:
        logger.info(
            "build_or_get_gmsh_mesh: %s nodes=%s elements=%s build_ms=%.1f cache_hit=%s",
            model_type,
            meta["numNodes"],
            meta["numElements"],
            build_ms,
            cache_hit,
        )
    return _translated_gmsh_mesh(built, requested_center_z - canonical_center_z), meta


def ensure_gmsh_mesh_in_request(data: dict, logger: logging.Logger | None = None) -> tuple[dict, dict[str, Any] | None]:
    """Build a Gmsh tet mesh on the server when catalog params arrive without mesh payload."""
    if not isinstance(data, dict) or has_mesh_payload(data) or not is_gmsh_build_request(data):
        return data, None

    built, meta = build_or_get_gmsh_mesh(data, logger)
    out = dict(data)
    out["mesh"] = built["mesh"]
    return out, meta

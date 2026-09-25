"""Request normalization, grid stats, JSON payloads, and ``ModelParams`` construction for FFI.

**FFI boundary (keep in sync with C++):**
- ``model_type_to_int`` / ``create_model_params`` must match ``enum ModelType`` and ``struct ModelParams``
  in ``backend/gravity/forward_methods/direct_newton/step02_direct_newton_model_params.h`` (and ``ffi_types.ModelParams``).
- When adding a synthetic model label, update the mapping here *and* the C enum + dispatch in that file.
"""

import logging
import math

from .constants import MAX_MAP_SIDE, MAX_TET_MESH_ELEMENTS, MAX_TET_MESH_NODES
from ..sources.model_params import ModelParams
from ..forward_methods.quadrature.ffi import QuadratureModelParams

logger = logging.getLogger(__name__)

QUADRATURE_TETRA_MODEL_TYPES = {55, 56, 57, 58, 59, 60, 61, 62, 63}


def _coerce_int(value, default: int) -> int:
    """Parse JSON/scalar values into int (avoids TypeError when e.g. ``"40"`` slips through)."""
    if value is None:
        return default
    if isinstance(value, bool):
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError, OverflowError):
        return default


def _coerce_float(value, default: float) -> float:
    if value is None:
        return default
    if isinstance(value, bool):
        return default
    try:
        return float(value)
    except (TypeError, ValueError, OverflowError):
        return default


# --- Full-grid min/max/mean (no spread) ---

def gravity_grid_stats(values):
    if not values:
        return 0.0, 0.0, 0.0
    mn = float("inf")
    mx = float("-inf")
    s = 0.0
    for v in values:
        if v < mn:
            mn = v
        if v > mx:
            mx = v
        s += v
    n = len(values)
    return mn, mx, s / n


# --- Browser map preview (box average to MAX_MAP_SIDE) ---

def downsample_gravity_grid(results, nx, ny, max_side=MAX_MAP_SIDE):
    n = len(results)
    if nx < 1 or ny < 1 or nx * ny != n:
        return results, max(1, nx), max(1, ny), False
    if nx <= max_side and ny <= max_side:
        return results, nx, ny, False
    scale = min(max_side / nx, max_side / ny)
    out_nx = max(2, int(math.floor(nx * scale)))
    out_ny = max(2, int(math.floor(ny * scale)))
    out = []
    for oi in range(out_nx):
        for oj in range(out_ny):
            i0 = (oi * nx) // out_nx
            i1 = ((oi + 1) * nx) // out_nx
            j0 = (oj * ny) // out_ny
            j1 = ((oj + 1) * ny) // out_ny
            if i1 <= i0:
                i1 = i0 + 1
            if j1 <= j0:
                j1 = j0 + 1
            acc = 0.0
            cnt = 0
            for ii in range(i0, min(i1, nx)):
                for jj in range(j0, min(j1, ny)):
                    acc += results[ii * ny + jj]
                    cnt += 1
            out.append(acc / cnt if cnt else 0.0)
    return out, out_nx, out_ny, True


# --- Unified JSON body for gravity endpoints ---

def gravity_json_payload(results, rx, ry, compute_ms, *, total_ms=None, num_sources=None, solver_meta=None):
    rx = int(rx)
    ry = int(ry)
    stats_min, stats_max, stats_mean = gravity_grid_stats(results)
    preview, map_nx, map_ny, down = downsample_gravity_grid(results, rx, ry, MAX_MAP_SIDE)
    payload = {
        "results": preview,
        "compute_ms": round(compute_ms, 2),
        "num_receivers_x": rx,
        "num_receivers_y": ry,
        "num_receivers": rx * ry,
        "map_num_x": map_nx,
        "map_num_y": map_ny,
        "stats_min": stats_min,
        "stats_max": stats_max,
        "stats_mean": stats_mean,
        "downsampled_for_display": down,
    }
    if total_ms is not None:
        payload["total_ms"] = round(total_ms, 2)
    if num_sources is not None:
        payload["num_sources"] = int(num_sources)
    if solver_meta is not None:
        payload["solver_meta"] = solver_meta
    return payload


# --- Synthetic model label → C++ enum (direct Newton / source gen) ---
# DEPRECATED: keep temporarily for legacy routes only. New compute/analysis routes
# should use generic tetra-mesh parsing via create_tetra_mesh_input().

def normalize_catalog_model_type(model_type: str) -> str:
    """Map legacy mesh labels to current catalog entries (tetra focus; hexa/poly not offered in UI)."""
    if not model_type:
        return model_type
    model_type = model_type.replace("Unstructured Tetrahedral FEM/FVM", "Tetrahedral")
    if " - Unstructured Tetrahedral" in model_type:
        model_type = model_type.replace(" - Unstructured Tetrahedral", " - Tetrahedral")
    if " - Gmsh Tetrahedral" in model_type:
        model_type = model_type.replace(" - Gmsh Tetrahedral", " - Tetrahedral")
    # hexa and poly not offered; no rewrite
    return model_type


def model_type_to_int(model_type: str) -> int:
    model_type = normalize_catalog_model_type(model_type)
    mapping = {
        "Cube - Hexahedral": 0,
        "Rectangular Prism (Cuboid) - Hexahedral": 1,
        "Sphere - Hexahedral": 2,
        "Ellipsoid - Hexahedral": 3,
        "Vertical Cylinder - Hexahedral": 4,
        "Horizontal Cylinder - Hexahedral": 5,
        "Faulted Block Model - Hexahedral": 7,
        "Valley-Mountain Model - Hexahedral": 8,
        "Voxel-Based Density Model - Hexahedral": 9,
        "Cube - Tetrahedral": 55,
        "Rectangular Prism (Cuboid) - Tetrahedral": 56,
        "Sphere - Tetrahedral": 57,
        "Ellipsoid - Tetrahedral": 58,
        "Vertical Cylinder - Tetrahedral": 59,
        "Horizontal Cylinder - Tetrahedral": 60,
        "Faulted Block Model - Tetrahedral": 61,
        "Valley-Mountain Model - Tetrahedral": 62,
        "4 Cubes - Tetrahedral": 63,
        "4 Cubes - Hexahedral": 30,
    }
    return mapping.get(model_type, 0)


_LEGACY_UNSTRUCTURED_TETRA_TO_TETRA: dict[int, int] = {
    33: 55,
    34: 56,
    35: 57,
    36: 58,
    37: 59,
    38: 60,
    40: 61,
    41: 62,
    43: 63,
}


def migrate_legacy_model_type_int(model_type_int: int) -> int:
    """Route retired structured / grid tetrahedral enum IDs to catalog Tetrahedral."""
    return _LEGACY_UNSTRUCTURED_TETRA_TO_TETRA.get(model_type_int, model_type_int)


# --- Deserialize POST JSON into ctypes ModelParams ---
# DEPRECATED: this shape-based builder is retained only until all legacy routes are retired.

def create_model_params(data: dict) -> ModelParams:
    model_type_str = data.get("modelType", "Cube - Hexahedral")
    model_type_int = migrate_legacy_model_type_int(model_type_to_int(model_type_str))

    h = _coerce_float(data.get("h", 2), 2.0)
    center_x = _coerce_float(data.get("centerX", 0.0), 0.0)
    center_y = _coerce_float(data.get("centerY", 0.0), 0.0)
    center_z = _coerce_float(data.get("centerZ", -h - 50.0), -h - 50.0)

    nx = _coerce_int(data.get("numSourcesX"), 5)
    ny = _coerce_int(data.get("numSourcesY"), 5)
    nz = _coerce_int(data.get("numSourcesZ"), 5)
    nrx = _coerce_int(data.get("numReceiversX"), 20)
    nry = _coerce_int(data.get("numReceiversY"), 20)

    params = ModelParams()
    params.model_type = model_type_int
    params.center_x = center_x
    params.center_y = center_y
    params.center_z = center_z
    params.density = data.get("density", 2500.0)
    params.num_sources_x = nx
    params.num_sources_y = ny
    params.num_sources_z = nz
    params.num_receivers_x = nrx
    params.num_receivers_y = nry
    params.surface_x_min = data.get("surfaceXMin", -100.0)
    params.surface_x_max = data.get("surfaceXMax", 100.0)
    params.surface_y_min = data.get("surfaceYMin", -100.0)
    params.surface_y_max = data.get("surfaceYMax", 100.0)
    params.surface_z = data.get("surfaceZ", 0.0)
    params.size_x = data.get("cubeX", 100.0)
    params.size_y = data.get("cubeY", 100.0)
    params.size_z = data.get("cubeZ", 100.0)
    params.layer1_thickness = 0.0
    params.layer2_thickness = 0.0
    params.layer3_thickness = 0.0
    params.layer1_density = params.density
    params.layer2_density = params.density
    params.layer3_density = params.density

    if model_type_int in (7, 17, 27):
        params.size_x = data.get("faultedBlockX", params.size_x)
        params.size_y = data.get("faultedBlockY", params.size_y)
        params.size_z = data.get("faultedBlockZ", params.size_z)
    elif model_type_int in (8, 18, 28, 41, 52):
        params.size_x = data.get("valleyMountainX", data.get("cubeX", params.size_x))
        params.size_y = data.get("valleyMountainY", data.get("cubeY", params.size_y))
        params.size_z = data.get("valleyMountainZ", data.get("cubeZ", params.size_z))
        params.layer1_thickness = data.get("valleyMountainHeight", 20.0)
        params.layer2_thickness = data.get("valleyMountainDepth", 20.0)
        params.layer3_thickness = max(1.0, data.get("valleyMountainZ", data.get("cubeZ", params.size_z)))
        halfspace_rho = data.get(
            "valleyMountainHalfSpaceDensity",
            data.get("valleyMountainValleyDensity", params.density),
        )
        anomaly_rho = data.get("valleyMountainMountainDensity", params.density)
        params.layer1_density = anomaly_rho
        params.layer2_density = halfspace_rho
        params.layer3_density = -2.0
    elif model_type_int in (9, 19, 29):
        params.size_x = data.get("voxelModelX", params.size_x)
        params.size_y = data.get("voxelModelY", params.size_y)
        params.size_z = data.get("voxelModelZ", params.size_z)

    params.radius = data.get("sphereRadius", 100.0)
    params.num_sources_radial = nx
    params.num_sources_theta = ny
    params.num_sources_phi = nz
    params.a = data.get("ellipsoidA", 100.0)
    params.b = data.get("ellipsoidB", 100.0)
    params.c = data.get("ellipsoidC", 150.0)
    params.cylinder_radius = data.get("verticalCylinderRadius", 50.0)
    params.cylinder_height = data.get("verticalCylinderHeight", 100.0)
    params.num_sources_radial_cyl = nx
    params.num_sources_theta_cyl = ny
    params.h_cylinder_radius = data.get("horizontalCylinderRadius", 50.0)
    params.h_cylinder_length = data.get("horizontalCylinderLength", 100.0)
    params.num_sources_radial_hcyl = nx
    params.num_sources_theta_hcyl = ny
    params.num_sources_length = nz
    params.base_radius = data.get("saltDomeBaseRadius", 80.0)
    params.top_radius = data.get("saltDomeTopRadius", 40.0)
    params.dome_height = data.get("saltDomeHeight", 120.0)
    params.num_sources_radial_dome = nx
    params.num_sources_theta_dome = ny
    params.fault_offset = data.get("faultedBlockFaultOffset", 20.0)
    params.voxel_size = data.get("voxelModelVoxelSize", 10.0)
    params.cube1_x = data.get("cube1X", 20.0)
    params.cube1_y = data.get("cube1Y", 20.0)
    params.cube1_z = data.get("cube1Z", 20.0)
    params.cube1_h = data.get("cube1H", 2.0)
    params.cube1_density = data.get("cube1Density", 2500.0)
    params.cube2_x = data.get("cube2X", 20.0)
    params.cube2_y = data.get("cube2Y", 20.0)
    params.cube2_z = data.get("cube2Z", 20.0)
    params.cube2_h = data.get("cube2H", 2.0)
    params.cube2_density = data.get("cube2Density", 2500.0)
    params.cube3_x = data.get("cube3X", 20.0)
    params.cube3_y = data.get("cube3Y", 20.0)
    params.cube3_z = data.get("cube3Z", 20.0)
    params.cube3_h = data.get("cube3H", 2.0)
    params.cube3_density = data.get("cube3Density", 2500.0)
    params.cube4_x = data.get("cube4X", 20.0)
    params.cube4_y = data.get("cube4Y", 20.0)
    params.cube4_z = data.get("cube4Z", 20.0)
    params.cube4_h = data.get("cube4H", 2.0)
    params.cube4_density = data.get("cube4Density", 2500.0)
    params.spacing_x = data.get("spacingX", 30.0)
    params.spacing_y = data.get("spacingY", 30.0)
    if model_type_int in (8, 18, 28, 41, 52):
        params.spacing_x = max(
            1e-6,
            float(
                data.get(
                    "valleyMountainWavelength",
                    data.get("valleyMountainX", params.size_x),
                )
            ),
        )
    params.cube1_offset_x = data.get("cube1OffsetX", 0.0)
    params.cube1_offset_y = data.get("cube1OffsetY", 0.0)
    params.cube2_offset_x = data.get("cube2OffsetX", 0.0)
    params.cube2_offset_y = data.get("cube2OffsetY", 0.0)
    params.cube3_offset_x = data.get("cube3OffsetX", 0.0)
    params.cube3_offset_y = data.get("cube3OffsetY", 0.0)
    params.cube4_offset_x = data.get("cube4OffsetX", 0.0)
    params.cube4_offset_y = data.get("cube4OffsetY", 0.0)

    # Curved primitives: circumscribed box sizes must match quadrature conventions
    # (cubeX/Y/Z are prism/cube extents only; leaving defaults breaks parity where size_* is read).
    if model_type_int in (2, 12, 22, 35, 46):
        d = 2.0 * max(1e-9, float(params.radius))
        params.size_x = d
        params.size_y = d
        params.size_z = d
    elif model_type_int in (3, 13, 23, 36, 47):
        params.size_x = 2.0 * max(1e-9, float(params.a))
        params.size_y = 2.0 * max(1e-9, float(params.b))
        params.size_z = 2.0 * max(1e-9, float(params.c))
    elif model_type_int in (4, 14, 24, 37, 48):
        d = 2.0 * max(1e-9, float(params.cylinder_radius))
        params.size_x = d
        params.size_y = d
        params.size_z = max(1e-9, float(params.cylinder_height))
    elif model_type_int in (5, 15, 25, 38, 49):
        d = 2.0 * max(1e-9, float(params.h_cylinder_radius))
        params.size_x = max(1e-9, float(params.h_cylinder_length))
        params.size_y = d
        params.size_z = d

    params.num_threads = int(data.get("numThreads", 0) or 0)
    execution_mode = str(data.get("executionMode", "simd_tiled_threading")).strip().lower()
    if execution_mode in {"scalar", "reference_tiled", "tiled"}:
        params.execution_mode = 0
    elif execution_mode in {"simd", "simd_tiled"}:
        params.execution_mode = 1
    elif execution_mode in {"simd_threads", "simd_threading_tiled", "simd_tiled_threading"}:
        params.execution_mode = 2
    elif execution_mode == "reference":
        params.execution_mode = 3
    else:
        params.execution_mode = 2
    params.receiver_block_size = int(data.get("receiverBlockSize", 0) or 0)
    params.source_block_size = int(data.get("sourceBlockSize", 0) or 0)
    n_rec = max(1, int(params.num_receivers_x) * int(params.num_receivers_y))
    if params.receiver_block_size > n_rec:
        params.receiver_block_size = n_rec
    if params.receiver_block_size < 0:
        params.receiver_block_size = 0
    if params.source_block_size < 0:
        params.source_block_size = 0
    return params


# --- Rough source/receiver counts (validation before FFI) ---

def estimate_sources_and_receivers(data):
    nx = _coerce_int(data.get("numSourcesX"), 5)
    ny = _coerce_int(data.get("numSourcesY"), 5)
    nz = _coerce_int(data.get("numSourcesZ"), 5)
    rx = _coerce_int(data.get("numReceiversX"), 20)
    ry = _coerce_int(data.get("numReceiversY"), 20)
    model_type = data.get("modelType", "Cube - Hexahedral")
    base = nx * ny * nz
    base_model = (model_type.split(" - ")[0] or "").strip()
    if "Tetrahedral" in model_type:
        voxels = base * 4 if base_model == "4 Cubes" else base
        n_src = voxels * 12
    else:
        n_src = base
    n_rec = rx * ry
    return n_src, n_rec


def log_scaled_interaction_measure(n_src: int, n_rec: int) -> int:
    """Rough workload proxy for tree gravity (AMFM, Barnes–Hut): floor((N·M) / log2(max(N,2))).

    Dense Direct Newton uses the raw product N·M; approximate methods amortize with trees,
    so validation uses this scaled measure (must match frontend ``logScaledInteractionMeasure``).
    """
    if n_src <= 0 or n_rec <= 0:
        return 0
    n_src = int(n_src)
    n_rec = int(n_rec)
    log_n = int(math.log2(max(n_src, 2)))
    denom = max(log_n, 1)
    return (n_src * n_rec) // denom


def create_quadrature_model_params(data: dict) -> QuadratureModelParams:
    model_type_str = data.get("modelType", "Cube - Tetrahedral")
    model_type_int = migrate_legacy_model_type_int(model_type_to_int(model_type_str))
    if model_type_int not in QUADRATURE_TETRA_MODEL_TYPES:
        raise ValueError(
            "Quadrature second-order supports only Tetrahedral model types."
        )

    params = QuadratureModelParams()
    params.model_type = model_type_int
    params.center_x = data.get("centerX", 0.0)
    params.center_y = data.get("centerY", 0.0)
    params.center_z = data.get("centerZ", -52.0)
    params.density = data.get("density", 2500.0)
    params.num_sources_x = data.get("numSourcesX", 5)
    params.num_sources_y = data.get("numSourcesY", 5)
    params.num_sources_z = data.get("numSourcesZ", 5)
    params.num_receivers_x = data.get("numReceiversX", 20)
    params.num_receivers_y = data.get("numReceiversY", 20)
    params.surface_x_min = data.get("surfaceXMin", -100.0)
    params.surface_x_max = data.get("surfaceXMax", 100.0)
    params.surface_y_min = data.get("surfaceYMin", -100.0)
    params.surface_y_max = data.get("surfaceYMax", 100.0)
    params.surface_z = data.get("surfaceZ", 0.0)

    params.size_x = data.get("cubeX", 100.0)
    params.size_y = data.get("cubeY", 100.0)
    params.size_z = data.get("cubeZ", 100.0)
    params.radius = data.get("sphereRadius", 100.0)
    params.a = data.get("ellipsoidA", 100.0)
    params.b = data.get("ellipsoidB", 100.0)
    params.c = data.get("ellipsoidC", 150.0)
    params.cylinder_radius = data.get("verticalCylinderRadius", 50.0)
    params.cylinder_height = data.get("verticalCylinderHeight", 100.0)
    params.h_cylinder_radius = data.get("horizontalCylinderRadius", 50.0)
    params.h_cylinder_length = data.get("horizontalCylinderLength", 100.0)
    params.fault_offset = data.get("faultedBlockFaultOffset", 20.0)
    params.layer1_thickness = data.get("valleyMountainHeight", 50.0)
    params.layer2_thickness = data.get("valleyMountainDepth", 50.0)
    params.voxel_size = data.get("voxelModelVoxelSize", 10.0)
    params.cube1_x = data.get("cube1X", 20.0)
    params.cube1_y = data.get("cube1Y", 20.0)
    params.cube1_z = data.get("cube1Z", 20.0)
    params.cube1_h = data.get("cube1H", 2.0)
    params.cube1_density = data.get("cube1Density", params.density)
    params.cube2_x = data.get("cube2X", 20.0)
    params.cube2_y = data.get("cube2Y", 20.0)
    params.cube2_z = data.get("cube2Z", 20.0)
    params.cube2_h = data.get("cube2H", 2.0)
    params.cube2_density = data.get("cube2Density", params.density)
    params.cube3_x = data.get("cube3X", 20.0)
    params.cube3_y = data.get("cube3Y", 20.0)
    params.cube3_z = data.get("cube3Z", 20.0)
    params.cube3_h = data.get("cube3H", 2.0)
    params.cube3_density = data.get("cube3Density", params.density)
    params.cube4_x = data.get("cube4X", 20.0)
    params.cube4_y = data.get("cube4Y", 20.0)
    params.cube4_z = data.get("cube4Z", 20.0)
    params.cube4_h = data.get("cube4H", 2.0)
    params.cube4_density = data.get("cube4Density", params.density)
    params.spacing_x = data.get("spacingX", 30.0)
    params.spacing_y = data.get("spacingY", 30.0)
    params.cube1_offset_x = data.get("cube1OffsetX", 0.0)
    params.cube1_offset_y = data.get("cube1OffsetY", 0.0)
    params.cube2_offset_x = data.get("cube2OffsetX", 0.0)
    params.cube2_offset_y = data.get("cube2OffsetY", 0.0)
    params.cube3_offset_x = data.get("cube3OffsetX", 0.0)
    params.cube3_offset_y = data.get("cube3OffsetY", 0.0)
    params.cube4_offset_x = data.get("cube4OffsetX", 0.0)
    params.cube4_offset_y = data.get("cube4OffsetY", 0.0)

    # Keep quadrature geometry bounds consistent with model type controls.
    if model_type_int == 57:  # Sphere - Tetrahedral
        d = 2.0 * max(1e-9, params.radius)
        params.size_x = d
        params.size_y = d
        params.size_z = d
    elif model_type_int == 58:  # Ellipsoid - Tetrahedral
        params.size_x = 2.0 * max(1e-9, params.a)
        params.size_y = 2.0 * max(1e-9, params.b)
        params.size_z = 2.0 * max(1e-9, params.c)
    elif model_type_int == 59:  # Vertical Cylinder - Tetrahedral
        d = 2.0 * max(1e-9, params.cylinder_radius)
        params.size_x = d
        params.size_y = d
        params.size_z = max(1e-9, params.cylinder_height)
    elif model_type_int == 60:  # Horizontal Cylinder - Tetrahedral
        d = 2.0 * max(1e-9, params.h_cylinder_radius)
        params.size_x = max(1e-9, params.h_cylinder_length)
        params.size_y = d
        params.size_z = d
    elif model_type_int == 61:  # Faulted Block Model - Tetrahedral
        params.size_x = data.get("faultedBlockX", params.size_x)
        params.size_y = data.get("faultedBlockY", params.size_y)
        params.size_z = data.get("faultedBlockZ", params.size_z)
    elif model_type_int == 62:  # Valley-Mountain Model - Tetrahedral
        params.size_x = data.get("valleyMountainX", params.size_x)
        params.size_y = data.get("valleyMountainY", params.size_y)
        params.size_z = data.get("valleyMountainZ", params.size_z)
        # Match create_model_params / layered basin: vertical extent is layer sum + remainder.
        l1 = float(data.get("valleyMountainHeight", 50.0))
        l2 = float(data.get("valleyMountainDepth", 50.0))
        params.layer1_thickness = l1
        params.layer2_thickness = l2
        sz_vm = float(params.size_z)
        params.layer3_thickness = max(0.0, sz_vm - l1 - l2)
        vd = float(data.get("valleyMountainDensity", params.density))
        params.layer1_density = float(data.get("layeredBasinLayer1Density", vd))
        params.layer2_density = float(data.get("layeredBasinLayer2Density", vd))
        params.layer3_density = float(data.get("layeredBasinLayer3Density", 0.0))

    execution_mode = str(data.get("executionMode", "simd_tiled_threading")).strip().lower()
    params.num_threads = int(data.get("numThreads", 0) or 0)
    if execution_mode in {"scalar", "reference_tiled", "tiled"}:
        params.execution_mode = 0
    elif execution_mode in {"simd", "simd_tiled"}:
        params.execution_mode = 1
    elif execution_mode in {"simd_threads", "simd_threading_tiled", "simd_tiled_threading"}:
        params.execution_mode = 2
    elif execution_mode == "reference":
        params.execution_mode = 3
    else:
        params.execution_mode = 2
    params.receiver_block_size = int(data.get("receiverBlockSize", 0) or 0)
    params.source_block_size = int(data.get("sourceBlockSize", 0) or 0)
    params.simd_lanes = int(data.get("simdLanes", 0) or 0)
    # Hard limits: Br ≤ N_r, Bs left for C++ (needs N_T after mesh build).
    n_rec = max(1, int(params.num_receivers_x) * int(params.num_receivers_y))
    if params.receiver_block_size > n_rec:
        params.receiver_block_size = n_rec
    if params.receiver_block_size < 0:
        params.receiver_block_size = 0
    if params.source_block_size < 0:
        params.source_block_size = 0

    return params


# -----------------------------------------------------------------------------
# Mesh parsing/types are being centralized under backend/gravity/mesh.
# Keep API-level names here for backwards compatibility during phased refactor.
# -----------------------------------------------------------------------------
from gravity.mesh.parser import (  # noqa: E402
    create_tetra_mesh_input as _mesh_create_tetra_mesh_input,
    load_tetra_mesh_from_text as _mesh_load_tetra_mesh_from_text,
    parse_tetra_mesh_payload as _mesh_parse_tetra_mesh_payload,
)


def parse_tetra_mesh_payload(data: dict):
    return _mesh_parse_tetra_mesh_payload(data)


def load_tetra_mesh_from_text(mesh_text: str, mesh_format: str):
    return _mesh_load_tetra_mesh_from_text(mesh_text, mesh_format)


def create_tetra_mesh_input(data: dict):
    return _mesh_create_tetra_mesh_input(data)

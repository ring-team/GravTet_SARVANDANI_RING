"""Build tetrahedral meshes with Gmsh for synthetic catalog shapes."""

from __future__ import annotations

import math
import os
from multiprocessing import get_context
from typing import Any, Callable

from api.gravity.shared.constants import MAX_TET_MESH_ELEMENTS, MAX_TET_MESH_NODES

GMSH_TET_ELEMENT_TYPE = 4  # 4-node tetrahedron in Gmsh
GMSH_BUILD_TIMEOUT_S = float(os.environ.get("GMSH_BUILD_TIMEOUT_S", "120"))

GMSH_SUPPORTED_BASE_MODELS = frozenset(
    {
        "Sphere",
        "Cube",
        "Rectangular Prism (Cuboid)",
        "Ellipsoid",
        "Vertical Cylinder",
        "Horizontal Cylinder",
        "4 Cubes",
        "Faulted Block Model",
        "Valley-Mountain Model",
    }
)


def gmsh_python_available() -> bool:
    try:
        import gmsh  # noqa: F401

        return True
    except ImportError:
        return False


def _coerce_float(v, default: float, name: str) -> float:
    try:
        out = float(v)
    except (TypeError, ValueError):
        out = default
    if not math.isfinite(out):
        raise ValueError(f"Non-finite numeric value for '{name}'")
    return out


def _coerce_nonneg(v, default: float, name: str) -> float:
    out = _coerce_float(v, default, name)
    if out < 0:
        raise ValueError(f"'{name}' must be non-negative.")
    return out


def _base_model(model_type: str) -> str:
    return (model_type or "").split(" - ")[0].strip()


def is_gmsh_mesh_build_supported(model_type: str) -> bool:
    mt = model_type or ""
    if not (
        mt.endswith(" - Tetrahedral")
        or "Gmsh Tetrahedral" in mt
        or "Unstructured Tetrahedral" in mt
    ):
        return False
    return _base_model(mt) in GMSH_SUPPORTED_BASE_MODELS


def _positive(v, default: float, name: str) -> float:
    out = _coerce_float(v, default, name)
    if out <= 0:
        raise ValueError(f"'{name}' must be positive.")
    return out


def _model_center(data: dict) -> tuple[float, float, float]:
    cx = _coerce_float(data.get("centerX", 0.0), 0.0, "centerX")
    cy = _coerce_float(data.get("centerY", 0.0), 0.0, "centerY")
    cz = _coerce_float(data.get("centerZ", 0.0), 0.0, "centerZ")
    return cx, cy, cz


def _mesh_sizing(data: dict) -> tuple[float, float, float, float]:
    target_size = _positive(data.get("targetElementSize", 2.0), 2.0, "targetElementSize")
    surface_refinement = _coerce_nonneg(data.get("surfaceRefinement", 0.25), 0.25, "surfaceRefinement")
    edge_refinement = _coerce_nonneg(
        data.get("localRefinementNearEdges", 0.25), 0.25, "localRefinementNearEdges"
    )
    density = _coerce_float(data.get("density", 2500.0), 2500.0, "density")
    return target_size, surface_refinement, edge_refinement, density


def _apply_size_fields(target_size: float, surface_refinement: float, edge_refinement: float) -> None:
    import gmsh

    lc_bg = max(1e-3, target_size)
    lc_surf = lc_bg / (1.0 + 2.0 * max(0.0, surface_refinement))
    lc_edge = lc_bg / (1.0 + 2.0 * max(0.0, edge_refinement))
    lc_min = min(lc_bg, lc_surf, lc_edge)

    gmsh.option.setNumber("Mesh.CharacteristicLengthMin", lc_min * 0.25)
    gmsh.option.setNumber("Mesh.CharacteristicLengthMax", lc_bg)
    gmsh.option.setNumber("Mesh.Algorithm3D", 1)

    f_bg = gmsh.model.mesh.field.add("Constant")
    gmsh.model.mesh.field.setNumber(f_bg, "VIn", lc_bg)
    gmsh.model.mesh.field.setNumber(f_bg, "VOut", lc_bg)

    field_ids = [f_bg]
    surfaces = [ent[1] for ent in gmsh.model.getEntities(2)]
    if surfaces and (surface_refinement > 0 or edge_refinement > 0):
        f_dist = gmsh.model.mesh.field.add("Distance")
        gmsh.model.mesh.field.setNumbers(f_dist, "SurfacesList", surfaces)
        gmsh.model.mesh.field.setNumber(f_dist, "Sampling", 100)
        f_th = gmsh.model.mesh.field.add("Threshold")
        gmsh.model.mesh.field.setNumber(f_th, "InField", f_dist)
        gmsh.model.mesh.field.setNumber(f_th, "SizeMin", min(lc_surf, lc_edge))
        gmsh.model.mesh.field.setNumber(f_th, "SizeMax", lc_bg)
        gmsh.model.mesh.field.setNumber(f_th, "DistMin", 0.0)
        gmsh.model.mesh.field.setNumber(f_th, "DistMax", lc_bg * 3.0)
        field_ids.append(f_th)

    if len(field_ids) > 1:
        f_min = gmsh.model.mesh.field.add("Min")
        gmsh.model.mesh.field.setNumbers(f_min, "FieldsList", field_ids)
        gmsh.model.mesh.field.setAsBackgroundMesh(f_min)
    else:
        gmsh.model.mesh.field.setAsBackgroundMesh(f_bg)


def _count_volume_mesh_stats() -> tuple[int, int]:
    """Fast node/tet counts from Gmsh without extracting full connectivity."""
    import gmsh

    node_tags, _coords, _ = gmsh.model.mesh.getNodes()
    num_nodes = len(node_tags)
    if num_nodes == 0:
        raise ValueError("Gmsh produced an empty node set.")

    elem_types, _elem_tags, elem_node_tags = gmsh.model.mesh.getElements(dim=3)
    num_tets = 0
    for etype, enodes in zip(elem_types, elem_node_tags):
        if int(etype) != GMSH_TET_ELEMENT_TYPE:
            continue
        num_tets += len(enodes) // 4

    if num_tets == 0:
        raise ValueError("Gmsh produced no 3D tetrahedral elements.")
    return num_nodes, num_tets


def _extract_volume_tets() -> tuple[list[list[float]], list[list[int]]]:
    import gmsh

    node_tags, coords, _ = gmsh.model.mesh.getNodes()
    if len(node_tags) == 0:
        raise ValueError("Gmsh produced an empty node set.")

    tag_to_idx = {int(tag): i for i, tag in enumerate(node_tags)}
    nodes = [[coords[3 * i], coords[3 * i + 1], coords[3 * i + 2]] for i in range(len(node_tags))]

    elem_types, _elem_tags, elem_node_tags = gmsh.model.mesh.getElements(dim=3)
    tets: list[list[int]] = []
    for etype, enodes in zip(elem_types, elem_node_tags):
        if int(etype) != GMSH_TET_ELEMENT_TYPE:
            continue
        flat = [int(v) for v in enodes]
        for j in range(0, len(flat), 4):
            ids = flat[j : j + 4]
            if len(ids) < 4:
                continue
            try:
                tets.append([tag_to_idx[ids[k]] for k in range(4)])
            except KeyError as exc:
                raise ValueError("Gmsh tet references unknown node tag.") from exc

    if not tets:
        raise ValueError("Gmsh produced no 3D tetrahedral elements.")
    return nodes, tets


def _tet_centroid(nodes: list[list[float]], tet: list[int]) -> tuple[float, float, float]:
    cx = cy = cz = 0.0
    for idx in tet:
        x, y, z = nodes[idx]
        cx += x
        cy += y
        cz += z
    return cx * 0.25, cy * 0.25, cz * 0.25


def _centroid_in_box(
    cx: float,
    cy: float,
    cz: float,
    x0: float,
    y0: float,
    z0: float,
    sx: float,
    sy: float,
    sz: float,
    tol: float = 1e-6,
) -> bool:
    return (
        x0 - tol <= cx <= x0 + sx + tol
        and y0 - tol <= cy <= y0 + sy + tol
        and z0 - tol <= cz <= z0 + sz + tol
    )


def _valley_mountain_display_relief_x(
    x: float, size_x: float, mountain_height: float, valley_depth: float
) -> float:
    mountain_center = -0.22 * size_x
    valley_center = 0.24 * size_x
    mountain_sigma = 0.16 * size_x
    valley_sigma = 0.17 * size_x
    mountain = mountain_height * math.exp(
        -((x - mountain_center) ** 2) / (2.0 * mountain_sigma * mountain_sigma)
    )
    valley = valley_depth * math.exp(-((x - valley_center) ** 2) / (2.0 * valley_sigma * valley_sigma))
    return mountain - valley


def _resolve_valley_mountain_params(data: dict) -> dict[str, float]:
    block_x = _positive(data.get("valleyMountainX", data.get("cubeX", 400.0)), 400.0, "valleyMountainX")
    block_y = _positive(data.get("valleyMountainY", data.get("cubeY", 140.0)), 140.0, "valleyMountainY")
    block_z = _positive(data.get("valleyMountainZ", data.get("cubeZ", 90.0)), 90.0, "valleyMountainZ")
    mountain_height = _coerce_nonneg(
        data.get("valleyMountainHeight", data.get("valleyMountainAmplitude", 50.0)), 50.0, "valleyMountainHeight"
    )
    valley_depth = _coerce_nonneg(
        data.get("valleyMountainDepth", data.get("valleyMountainAmplitude", 50.0)), 50.0, "valleyMountainDepth"
    )
    half_space_density = _coerce_float(
        data.get("valleyMountainHalfSpaceDensity", data.get("valleyMountainValleyDensity", 2850.0)),
        2850.0,
        "valleyMountainHalfSpaceDensity",
    )
    mountain_valley_density = _coerce_float(
        data.get("valleyMountainMountainDensity", data.get("density", 2550.0)),
        2550.0,
        "valleyMountainMountainDensity",
    )
    return {
        "block_x": block_x,
        "block_y": block_y,
        "block_z": block_z,
        "mountain_height": mountain_height,
        "valley_depth": valley_depth,
        "half_space_density": half_space_density,
        "mountain_valley_density": mountain_valley_density,
        "half_space_x": block_x + 200.0,
        "half_space_y": block_y + 100.0,
        "half_space_z": block_z + 30.0,
    }


def _count_source_tets(
    element_density: Callable[[list[list[float]], list[int]], float | None],
) -> tuple[int, int]:
    """Count mesh nodes and source tets after ``mesh.generate(3)`` (density filter applied)."""
    nodes, tets = _extract_volume_tets()
    num_sources = 0
    for tet in tets:
        if element_density(nodes, tet) is not None:
            num_sources += 1
    if num_sources == 0:
        raise ValueError("Gmsh produced no tetrahedra after geometry filtering.")
    return len(nodes), num_sources


def _run_gmsh_build(
    model_name: str,
    create_geometry: Callable[[], None],
    data: dict,
    element_density: Callable[[list[list[float]], list[int]], float | None] | None = None,
):
    import gmsh

    count_only = bool(data.get("countOnly"))
    target_size, surface_refinement, edge_refinement, default_density = _mesh_sizing(data)
    gmsh.initialize()
    try:
        gmsh.model.add(model_name)
        create_geometry()
        gmsh.model.occ.synchronize()
        _apply_size_fields(target_size, surface_refinement, edge_refinement)
        gmsh.model.mesh.generate(3)
        if count_only and element_density is None:
            num_nodes, num_elements = _count_volume_mesh_stats()
            return [], [], num_nodes, num_elements
        if count_only and element_density is not None:
            num_nodes, num_elements = _count_source_tets(element_density)
            return [], [], num_nodes, num_elements
        nodes, tets = _extract_volume_tets()
    finally:
        gmsh.finalize()

    elements: list[dict[str, float | int]] = []
    for tet in tets:
        rho = element_density(nodes, tet) if element_density is not None else default_density
        if rho is None:
            continue
        elements.append({"i0": tet[0], "i1": tet[1], "i2": tet[2], "i3": tet[3], "density": float(rho)})
    if not elements:
        raise ValueError("Gmsh produced no tetrahedra after geometry filtering.")
    return nodes, elements, len(nodes), len(elements)


def _build_sphere_mesh(data: dict):
    cx, cy, cz = _model_center(data)
    radius = _positive(data.get("sphereRadius", 100.0), 100.0, "sphereRadius")

    def create():
        import gmsh

        gmsh.model.occ.addSphere(cx, cy, cz, radius)

    return _run_gmsh_build("sphere_gmsh_tetra", create, data)


def _build_box_mesh(data: dict):
    cx, cy, cz = _model_center(data)
    sx = _positive(data.get("cubeX", 100.0), 100.0, "cubeX")
    sy = _positive(data.get("cubeY", 100.0), 100.0, "cubeY")
    sz = _positive(data.get("cubeZ", 100.0), 100.0, "cubeZ")
    x0, y0, z0 = cx - sx / 2, cy - sy / 2, cz - sz / 2

    def create():
        import gmsh

        gmsh.model.occ.addBox(x0, y0, z0, sx, sy, sz)

    return _run_gmsh_build("box_gmsh_tetra", create, data)


def _build_ellipsoid_mesh(data: dict):
    cx, cy, cz = _model_center(data)
    a = _positive(data.get("ellipsoidA", 100.0), 100.0, "ellipsoidA")
    b = _positive(data.get("ellipsoidB", 100.0), 100.0, "ellipsoidB")
    c = _positive(data.get("ellipsoidC", 150.0), 150.0, "ellipsoidC")

    def create():
        import gmsh

        tag = gmsh.model.occ.addSphere(cx, cy, cz, 1.0)
        gmsh.model.occ.dilate([(3, tag)], cx, cy, cz, a, b, c)

    return _run_gmsh_build("ellipsoid_gmsh_tetra", create, data)


def _build_vertical_cylinder_mesh(data: dict):
    cx, cy, cz = _model_center(data)
    radius = _positive(data.get("verticalCylinderRadius", 50.0), 50.0, "verticalCylinderRadius")
    height = _positive(data.get("verticalCylinderHeight", 100.0), 100.0, "verticalCylinderHeight")
    z0 = cz - height / 2

    def create():
        import gmsh

        gmsh.model.occ.addCylinder(cx, cy, z0, 0, 0, height, radius)

    return _run_gmsh_build("vertical_cylinder_gmsh_tetra", create, data)


def _build_horizontal_cylinder_mesh(data: dict):
    cx, cy, cz = _model_center(data)
    radius = _positive(data.get("horizontalCylinderRadius", 50.0), 50.0, "horizontalCylinderRadius")
    length = _positive(data.get("horizontalCylinderLength", 100.0), 100.0, "horizontalCylinderLength")
    x0 = cx - length / 2

    def create():
        import gmsh

        # Axis along +X (matches hexahedral / analytical horizontal-cylinder convention).
        gmsh.model.occ.addCylinder(x0, cy, cz, length, 0, 0, radius)

    return _run_gmsh_build("horizontal_cylinder_gmsh_tetra", create, data)


def _four_cube_specs(data: dict) -> list[dict[str, float]]:
    cx, cy, cz = _model_center(data)
    spacing_x = _positive(data.get("spacingX", 80.0), 80.0, "spacingX")
    spacing_y = _positive(data.get("spacingY", 80.0), 80.0, "spacingY")
    positions = [
        (
            -spacing_x * 0.5 + _coerce_float(data.get("cube1OffsetX", 0.0), 0.0, "cube1OffsetX"),
            -spacing_y * 0.5 + _coerce_float(data.get("cube1OffsetY", 0.0), 0.0, "cube1OffsetY"),
        ),
        (
            spacing_x * 0.5 + _coerce_float(data.get("cube2OffsetX", 0.0), 0.0, "cube2OffsetX"),
            -spacing_y * 0.5 + _coerce_float(data.get("cube2OffsetY", 0.0), 0.0, "cube2OffsetY"),
        ),
        (
            -spacing_x * 0.5 + _coerce_float(data.get("cube3OffsetX", 0.0), 0.0, "cube3OffsetX"),
            spacing_y * 0.5 + _coerce_float(data.get("cube3OffsetY", 0.0), 0.0, "cube3OffsetY"),
        ),
        (
            spacing_x * 0.5 + _coerce_float(data.get("cube4OffsetX", 0.0), 0.0, "cube4OffsetX"),
            spacing_y * 0.5 + _coerce_float(data.get("cube4OffsetY", 0.0), 0.0, "cube4OffsetY"),
        ),
    ]
    dims = [
        (
            _positive(data.get("cube1X", 20.0), 20.0, "cube1X"),
            _positive(data.get("cube1Y", 20.0), 20.0, "cube1Y"),
            _positive(data.get("cube1Z", 20.0), 20.0, "cube1Z"),
            _coerce_float(data.get("cube1H", 2.0), 2.0, "cube1H"),
            _coerce_float(data.get("cube1Density", data.get("density", 2500.0)), 2500.0, "cube1Density"),
        ),
        (
            _positive(data.get("cube2X", 20.0), 20.0, "cube2X"),
            _positive(data.get("cube2Y", 20.0), 20.0, "cube2Y"),
            _positive(data.get("cube2Z", 20.0), 20.0, "cube2Z"),
            _coerce_float(data.get("cube2H", 2.0), 2.0, "cube2H"),
            _coerce_float(data.get("cube2Density", data.get("density", 2500.0)), 2500.0, "cube2Density"),
        ),
        (
            _positive(data.get("cube3X", 20.0), 20.0, "cube3X"),
            _positive(data.get("cube3Y", 20.0), 20.0, "cube3Y"),
            _positive(data.get("cube3Z", 20.0), 20.0, "cube3Z"),
            _coerce_float(data.get("cube3H", 2.0), 2.0, "cube3H"),
            _coerce_float(data.get("cube3Density", data.get("density", 2500.0)), 2500.0, "cube3Density"),
        ),
        (
            _positive(data.get("cube4X", 20.0), 20.0, "cube4X"),
            _positive(data.get("cube4Y", 20.0), 20.0, "cube4Y"),
            _positive(data.get("cube4Z", 20.0), 20.0, "cube4Z"),
            _coerce_float(data.get("cube4H", 2.0), 2.0, "cube4H"),
            _coerce_float(data.get("cube4Density", data.get("density", 2500.0)), 2500.0, "cube4Density"),
        ),
    ]
    specs: list[dict[str, float]] = []
    for (px, py), (sx, sy, sz, hs, rho) in zip(positions, dims):
        ccx = cx + px
        ccy = cy + py
        ccz = cz - hs - sz * 0.5
        specs.append(
            {
                "x0": ccx - sx * 0.5,
                "y0": ccy - sy * 0.5,
                "z0": ccz - sz * 0.5,
                "sx": sx,
                "sy": sy,
                "sz": sz,
                "density": abs(rho),
            }
        )
    return specs


def _build_four_cubes_mesh(data: dict):
    specs = _four_cube_specs(data)

    def create():
        import gmsh

        for spec in specs:
            gmsh.model.occ.addBox(spec["x0"], spec["y0"], spec["z0"], spec["sx"], spec["sy"], spec["sz"])

    def density_fn(nodes: list[list[float]], tet: list[int]) -> float | None:
        cx, cy, cz = _tet_centroid(nodes, tet)
        for spec in specs:
            if _centroid_in_box(cx, cy, cz, spec["x0"], spec["y0"], spec["z0"], spec["sx"], spec["sy"], spec["sz"]):
                return spec["density"]
        return None

    return _run_gmsh_build("four_cubes_gmsh_tetra", create, data, density_fn)


def _build_faulted_block_mesh(data: dict):
    cx, cy, cz = _model_center(data)
    sx = _positive(data.get("faultedBlockX", 100.0), 100.0, "faultedBlockX")
    sy = _positive(data.get("faultedBlockY", 100.0), 100.0, "faultedBlockY")
    sz = _positive(data.get("faultedBlockZ", 100.0), 100.0, "faultedBlockZ")
    fault = _coerce_float(data.get("faultedBlockFaultOffset", 20.0), 20.0, "faultedBlockFaultOffset")
    rho = _coerce_float(data.get("faultedBlockDensity", data.get("density", 2500.0)), 2500.0, "faultedBlockDensity")
    left = {
        "x0": cx - sx * 0.5,
        "y0": cy - sy * 0.5,
        "z0": cz - sz * 0.5,
        "sx": sx * 0.5,
        "sy": sy,
        "sz": sz,
        "density": rho,
    }
    right = {
        "x0": cx,
        "y0": cy - sy * 0.5,
        "z0": cz - sz * 0.5 - fault,
        "sx": sx * 0.5,
        "sy": sy,
        "sz": sz,
        "density": 0.7 * rho,
    }
    blocks = [left, right]

    def create():
        import gmsh

        for block in blocks:
            gmsh.model.occ.addBox(block["x0"], block["y0"], block["z0"], block["sx"], block["sy"], block["sz"])

    def density_fn(nodes: list[list[float]], tet: list[int]) -> float | None:
        cx_t, cy_t, cz_t = _tet_centroid(nodes, tet)
        for block in blocks:
            if _centroid_in_box(
                cx_t, cy_t, cz_t, block["x0"], block["y0"], block["z0"], block["sx"], block["sy"], block["sz"]
            ):
                return block["density"]
        return None

    return _run_gmsh_build("faulted_block_gmsh_tetra", create, data, density_fn)


def _build_valley_mountain_mesh(data: dict):
    vm = _resolve_valley_mountain_params(data)
    cx, cy, cz = _model_center(data)
    hs_x = vm["half_space_x"]
    hs_y = vm["half_space_y"]
    hs_z = vm["half_space_z"]
    z_min = cz - hs_z * 0.5
    z_surface = 0.0
    z_ref = cz + vm["block_z"] * 0.5
    x0 = cx - hs_x * 0.5
    y0 = cy - hs_y * 0.5
    ax = vm["block_x"] * 0.5
    ay = vm["block_y"] * 0.5
    bz0 = cz - vm["block_z"] * 0.5
    relief_margin = vm["mountain_height"] + vm["valley_depth"]
    anomaly_height = vm["block_z"] + relief_margin
    # Half-space below the observation surface (z=0), like other catalog Gmsh bodies — no air volume.
    hs_height = max(hs_z, z_surface - z_min)

    def create():
        import gmsh

        gmsh.model.occ.addBox(x0, y0, z_min, hs_x, hs_y, hs_height)
        gmsh.model.occ.addBox(cx - ax, cy - ay, bz0, vm["block_x"], vm["block_y"], anomaly_height)

    def density_fn(nodes: list[list[float]], tet: list[int]) -> float | None:
        tcx, tcy, tcz = _tet_centroid(nodes, tet)
        if tcz > z_surface + 1e-3:
            return None
        xc = tcx - cx
        yc = tcy - cy
        in_anomaly = abs(xc) <= ax and abs(yc) <= ay
        relief = (
            _valley_mountain_display_relief_x(xc, vm["block_x"], vm["mountain_height"], vm["valley_depth"])
            if in_anomaly
            else 0.0
        )
        if tcz > z_ref + relief + 1e-3:
            return None
        if in_anomaly:
            return vm["mountain_valley_density"] if relief >= 0.0 else vm["half_space_density"]
        return vm["half_space_density"]

    return _run_gmsh_build("valley_mountain_gmsh_tetra", create, data, density_fn)


def _build_mesh_for_model(data: dict) -> tuple[list[list[float]], list[dict[str, float | int]], int, int]:
    base = _base_model(str(data.get("modelType", "") or ""))
    builders = {
        "Sphere": _build_sphere_mesh,
        "Cube": _build_box_mesh,
        "Rectangular Prism (Cuboid)": _build_box_mesh,
        "Ellipsoid": _build_ellipsoid_mesh,
        "Vertical Cylinder": _build_vertical_cylinder_mesh,
        "Horizontal Cylinder": _build_horizontal_cylinder_mesh,
        "4 Cubes": _build_four_cubes_mesh,
        "Faulted Block Model": _build_faulted_block_mesh,
        "Valley-Mountain Model": _build_valley_mountain_mesh,
    }
    builder = builders.get(base)
    if builder is None:
        raise NotImplementedError(
            f"Tetrahedral mesh generation for '{base}' is not implemented yet. "
            f"Supported shapes: {', '.join(sorted(GMSH_SUPPORTED_BASE_MODELS))}."
        )
    return builder(data)


def _build_gmsh_tetra_mesh_impl(data: dict) -> dict[str, Any]:
    """Core Gmsh build (runs in current process — use subprocess wrapper from Flask)."""
    if not gmsh_python_available():
        raise RuntimeError(
            "Gmsh Python API is not installed. Run: pip install gmsh (or ./scripts/dev.sh)."
        )

    model_type = str(data.get("modelType", "") or "").strip()
    if not (
        model_type.endswith(" - Tetrahedral")
        or "Gmsh Tetrahedral" in model_type
        or "Unstructured Tetrahedral" in model_type
    ):
        raise ValueError("modelType must be a catalog Tetrahedral entry.")

    count_only = bool(data.get("countOnly"))
    nodes, elements, num_nodes, num_elements = _build_mesh_for_model(data)

    if len(nodes) > MAX_TET_MESH_NODES:
        raise ValueError(
            f"Gmsh mesh has too many nodes ({len(nodes):,}). "
            f"Increase target element size (limit {MAX_TET_MESH_NODES:,})."
        )
    if len(elements) > MAX_TET_MESH_ELEMENTS:
        raise ValueError(
            f"Gmsh mesh has too many tetrahedra ({len(elements):,}). "
            f"Increase target element size (limit {MAX_TET_MESH_ELEMENTS:,})."
        )

    if num_nodes > MAX_TET_MESH_NODES:
        raise ValueError(
            f"Gmsh mesh has too many nodes ({num_nodes:,}). "
            f"Increase target element size (limit {MAX_TET_MESH_NODES:,})."
        )
    if num_elements > MAX_TET_MESH_ELEMENTS:
        raise ValueError(
            f"Gmsh mesh has too many tetrahedra ({num_elements:,}). "
            f"Increase target element size (limit {MAX_TET_MESH_ELEMENTS:,})."
        )

    payload: dict[str, Any] = {
        "numNodes": num_nodes,
        "numElements": num_elements,
        "modelType": model_type,
    }
    if count_only:
        payload["countOnly"] = True
    else:
        payload["mesh"] = {"nodes": nodes, "elements": elements}
    return payload


def build_gmsh_tetra_mesh(data: dict) -> dict[str, Any]:
    """Build nodes + tet elements (direct call — for tests and subprocess worker)."""
    return _build_gmsh_tetra_mesh_impl(data)


def _gmsh_build_worker(data: dict) -> dict[str, Any]:
    """Child-process entry point (spawn): Gmsh must run in the subprocess main thread."""
    return _build_gmsh_tetra_mesh_impl(data)


def build_gmsh_tetra_mesh_with_timeout(data: dict) -> dict[str, Any]:
    """Run Gmsh in an isolated subprocess (Flask worker threads break gmsh.initialize)."""
    ctx = get_context("spawn")
    with ctx.Pool(processes=1) as pool:
        async_result = pool.apply_async(_gmsh_build_worker, (data,))
        try:
            return async_result.get(timeout=GMSH_BUILD_TIMEOUT_S)
        except Exception as exc:
            pool.terminate()
            if isinstance(exc, TimeoutError) or exc.__class__.__name__ == "TimeoutError":
                raise TimeoutError(
                    f"Gmsh mesh build timed out after {GMSH_BUILD_TIMEOUT_S:.0f}s. "
                    "Increase target element size or set GMSH_BUILD_TIMEOUT_S."
                ) from exc
            raise

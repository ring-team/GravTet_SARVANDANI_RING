"""Shared tetra-mesh payload parsing/building for gravity routes."""

import ctypes
import math
from pathlib import Path

import numpy as np

from api.gravity.shared.constants import MAX_TET_MESH_ELEMENTS, MAX_TET_MESH_NODES
from .types import MeshNode, TetraElement, TetraMeshInput


def _to_number(v, name: str) -> float:
    try:
        out = float(v)
    except (TypeError, ValueError):
        raise ValueError(f"Invalid numeric value for '{name}'")
    if not math.isfinite(out):
        raise ValueError(f"Non-finite numeric value for '{name}'")
    return out


def _to_int(v, name: str) -> int:
    try:
        out = int(v)
    except (TypeError, ValueError):
        raise ValueError(f"Invalid integer value for '{name}'")
    return out


def _parse_medit_mesh_text(mesh_text: str):
    lines = [ln.strip() for ln in mesh_text.splitlines()]
    i = 0
    nodes = []
    tets = []
    n = len(lines)
    while i < n:
        tok = lines[i]
        if not tok or tok.startswith("#"):
            i += 1
            continue
        low = tok.lower()
        if low == "vertices":
            i += 1
            if i >= n:
                break
            nverts = int(lines[i].split()[0])
            i += 1
            for _ in range(nverts):
                parts = lines[i].split()
                if len(parts) < 3:
                    raise ValueError("Invalid MEDIT vertex line.")
                nodes.append([float(parts[0]), float(parts[1]), float(parts[2])])
                i += 1
            continue
        if low in {"tetrahedra", "tetrahedrons"}:
            i += 1
            if i >= n:
                break
            ntets = int(lines[i].split()[0])
            i += 1
            for _ in range(ntets):
                parts = lines[i].split()
                if len(parts) < 4:
                    raise ValueError("Invalid MEDIT tetrahedra line.")
                tets.append([int(parts[0]) - 1, int(parts[1]) - 1, int(parts[2]) - 1, int(parts[3]) - 1])
                i += 1
            continue
        i += 1
    return nodes, tets


def _parse_vtk_legacy_text(mesh_text: str):
    lines = [ln.strip() for ln in mesh_text.splitlines() if ln.strip()]
    nodes = []
    tets = []
    i = 0
    n = len(lines)
    while i < n:
        parts = lines[i].split()
        key = parts[0].upper() if parts else ""
        if key == "POINTS" and len(parts) >= 2:
            npts = int(parts[1])
            vals = []
            i += 1
            while i < n and len(vals) < 3 * npts:
                vals.extend(lines[i].split())
                i += 1
            if len(vals) < 3 * npts:
                raise ValueError("Invalid VTK POINTS section.")
            for k in range(npts):
                nodes.append([float(vals[3 * k]), float(vals[3 * k + 1]), float(vals[3 * k + 2])])
            continue
        if key == "CELLS" and len(parts) >= 3:
            ncells = int(parts[1])
            i += 1
            raw_cells = []
            for _ in range(ncells):
                if i >= n:
                    raise ValueError("Invalid VTK CELLS section.")
                raw_cells.append([int(v) for v in lines[i].split()])
                i += 1
            cell_types = None
            if i < n and lines[i].split()[0].upper() == "CELL_TYPES":
                ct_parts = lines[i].split()
                nct = int(ct_parts[1]) if len(ct_parts) > 1 else len(raw_cells)
                i += 1
                cell_types = []
                while i < n and len(cell_types) < nct:
                    cell_types.extend(int(v) for v in lines[i].split())
                    i += 1
            for idx, c in enumerate(raw_cells):
                if not c or c[0] != 4:
                    continue
                if cell_types is not None and idx < len(cell_types) and cell_types[idx] != 10:
                    continue
                tets.append([c[1], c[2], c[3], c[4]])
            continue
        i += 1
    return nodes, tets


def _parse_gmsh_msh_text(mesh_text: str):
    lines = [ln.strip() for ln in mesh_text.splitlines()]
    nodes = []
    tets = []
    i = 0
    n = len(lines)
    node_id_to_idx = {}
    while i < n:
        if lines[i] == "$Nodes":
            i += 1
            n_nodes = int(lines[i])
            i += 1
            for local_idx in range(n_nodes):
                parts = lines[i].split()
                if len(parts) < 4:
                    raise ValueError("Invalid .msh node line.")
                nid = int(parts[0])
                node_id_to_idx[nid] = local_idx
                nodes.append([float(parts[1]), float(parts[2]), float(parts[3])])
                i += 1
            while i < n and lines[i] != "$EndNodes":
                i += 1
            i += 1
            continue
        if lines[i] == "$Elements":
            i += 1
            n_elem = int(lines[i])
            i += 1
            for _ in range(n_elem):
                parts = lines[i].split()
                if len(parts) < 4:
                    raise ValueError("Invalid .msh element line.")
                etype = int(parts[1])
                ntags = int(parts[2])
                if etype == 4:
                    base = 3 + ntags
                    if len(parts) < base + 4:
                        raise ValueError("Invalid tetra element in .msh.")
                    ids = [int(parts[base + k]) for k in range(4)]
                    try:
                        tets.append([node_id_to_idx[v] for v in ids])
                    except KeyError:
                        raise ValueError("Element references unknown node id in .msh.")
                i += 1
            while i < n and lines[i] != "$EndElements":
                i += 1
            i += 1
            continue
        i += 1
    return nodes, tets


def load_tetra_mesh_from_text(mesh_text: str, mesh_format: str):
    fmt = (mesh_format or "").strip().lower()
    if fmt in {"mesh", "medit"}:
        return _parse_medit_mesh_text(mesh_text)
    if fmt in {"vtk", "vtk-legacy"}:
        return _parse_vtk_legacy_text(mesh_text)
    if fmt in {"msh", "gmsh"}:
        return _parse_gmsh_msh_text(mesh_text)
    raise ValueError(f"Unsupported meshFormat '{mesh_format}'. Use one of: mesh, vtk, msh.")


def _load_mesh_from_payload(data: dict):
    mesh = data.get("mesh", data)
    raw_nodes = mesh.get("nodes", None)
    raw_elements = mesh.get("elements", mesh.get("tets", None))
    if isinstance(raw_nodes, list) and isinstance(raw_elements, list) and raw_nodes and raw_elements:
        return raw_nodes, raw_elements

    mesh_text = mesh.get("meshText", data.get("meshText", None))
    mesh_format = mesh.get("meshFormat", data.get("meshFormat", None))
    mesh_file_path = mesh.get("meshFilePath", data.get("meshFilePath", None))
    if mesh_text is None and mesh_file_path:
        p = Path(str(mesh_file_path)).expanduser()
        if not p.exists() or not p.is_file():
            raise ValueError(f"meshFilePath does not exist: {mesh_file_path}")
        mesh_text = p.read_text(encoding="utf-8", errors="ignore")
        if not mesh_format:
            mesh_format = p.suffix.lower().lstrip(".")
    if isinstance(mesh_text, str) and mesh_text.strip():
        nodes, tets = load_tetra_mesh_from_text(mesh_text, str(mesh_format or ""))
        density_default = float(data.get("density", 2500.0))
        elements = [{"i0": t[0], "i1": t[1], "i2": t[2], "i3": t[3], "density": density_default} for t in tets]
        return nodes, elements
    return [], []


def build_tetra_mesh_arrays(raw_nodes, raw_elements, *, default_density: float = 2500.0):
    """Build ctypes node/element arrays from raw mesh lists (shared by parser and server cache).

    Uses numpy for bulk conversion so that large meshes (hundreds of thousands of
    nodes/elements) are processed in milliseconds rather than several seconds.
    Falls back to a pure-Python path for exotic element/node formats.
    """
    if not isinstance(raw_nodes, list) or len(raw_nodes) == 0:
        raise ValueError("Mesh must include non-empty 'nodes' list.")
    if not isinstance(raw_elements, list) or len(raw_elements) == 0:
        raise ValueError("Mesh must include non-empty 'elements' (or 'tets') list.")
    if len(raw_nodes) > MAX_TET_MESH_NODES:
        raise ValueError(f"Too many mesh nodes ({len(raw_nodes)}). Limit is {MAX_TET_MESH_NODES}.")
    if len(raw_elements) > MAX_TET_MESH_ELEMENTS:
        raise ValueError(f"Too many tetra elements ({len(raw_elements)}). Limit is {MAX_TET_MESH_ELEMENTS}.")

    n_nodes = len(raw_nodes)
    n_elems = len(raw_elements)
    node_arr = (MeshNode * n_nodes)()
    elem_arr = (TetraElement * n_elems)()

    # --- Nodes: vectorised path for list-of-lists or list-of-dicts ---
    try:
        first_node = raw_nodes[0]
        if isinstance(first_node, (list, tuple)):
            # Most common Gmsh output: [[x,y,z], ...]
            xyz = np.array(raw_nodes, dtype=np.float64)  # (n, ≥3)
            if xyz.ndim != 2 or xyz.shape[1] < 3:
                raise ValueError("Node rows must have at least 3 coordinates.")
            # MeshNode = [x:f64, y:f64, z:f64] → lay flat and memmove in
            flat = np.ascontiguousarray(xyz[:, :3])  # (n, 3) float64
            ctypes.memmove(node_arr, flat.ctypes.data, flat.nbytes)
        elif isinstance(first_node, dict):
            xs = np.array([float(n.get("x", 0.0)) for n in raw_nodes], dtype=np.float64)
            ys = np.array([float(n.get("y", 0.0)) for n in raw_nodes], dtype=np.float64)
            zs = np.array([float(n.get("z", 0.0)) for n in raw_nodes], dtype=np.float64)
            flat = np.ascontiguousarray(np.column_stack([xs, ys, zs]))  # (n, 3) float64
            ctypes.memmove(node_arr, flat.ctypes.data, flat.nbytes)
        else:
            raise TypeError("Unknown node format")
    except Exception:
        # Fallback: element-by-element (handles edge-case formats)
        for i, nd in enumerate(raw_nodes):
            if isinstance(nd, dict):
                x = _to_number(nd.get("x"), f"nodes[{i}].x")
                y = _to_number(nd.get("y"), f"nodes[{i}].y")
                z = _to_number(nd.get("z"), f"nodes[{i}].z")
            elif isinstance(nd, (list, tuple)) and len(nd) >= 3:
                x = _to_number(nd[0], f"nodes[{i}][0]")
                y = _to_number(nd[1], f"nodes[{i}][1]")
                z = _to_number(nd[2], f"nodes[{i}][2]")
            else:
                raise ValueError(f"Invalid node format at index {i}.")
            node_arr[i] = MeshNode(x=x, y=y, z=z)

    # --- Elements: vectorised path for list-of-lists or list-of-dicts ---
    # TetraElement = [i0:i32, i1:i32, i2:i32, i3:i32, density:f64]
    # Struct size = 4*4 + 8 = 24 bytes, but alignment may pad to 32; verify:
    _elem_size = ctypes.sizeof(TetraElement)  # expected 24 or 32
    _has_padding = (_elem_size != 24)
    try:
        first_elem = raw_elements[0]
        if isinstance(first_elem, (list, tuple)) and len(first_elem) >= 5 and not _has_padding:
            # [[i0,i1,i2,i3,density], ...] — Gmsh server output
            ea = np.array(raw_elements, dtype=object)  # keep mixed types
            indices = np.array(ea[:, :4], dtype=np.int32)   # (m, 4)
            densities = np.array(ea[:, 4], dtype=np.float64)  # (m,)
            # Bounds check
            if int(indices.min()) < 0 or int(indices.max()) >= n_nodes:
                raise ValueError("Element node index out of bounds.")
            # Build a structured numpy array matching the ctypes layout
            # [i0,i1,i2,i3] as int32 then density as float64
            flat_i = np.ascontiguousarray(indices)          # (m,4) int32
            flat_d = np.ascontiguousarray(densities)        # (m,) float64
            # Write int fields then density field for each element
            int_buf = flat_i.tobytes()                      # 4*4*m bytes
            # Interleave: write per-element (4 ints + 1 double)
            # Fastest approach: construct structured array then memmove
            dt = np.dtype([("i0", np.int32), ("i1", np.int32),
                           ("i2", np.int32), ("i3", np.int32),
                           ("density", np.float64)])
            sa = np.empty(n_elems, dtype=dt)
            sa["i0"] = flat_i[:, 0]
            sa["i1"] = flat_i[:, 1]
            sa["i2"] = flat_i[:, 2]
            sa["i3"] = flat_i[:, 3]
            sa["density"] = flat_d
            ctypes.memmove(elem_arr, sa.ctypes.data, sa.nbytes)
        elif isinstance(first_elem, dict) and not _has_padding:
            i0s = np.array([int(e.get("i0", 0)) for e in raw_elements], dtype=np.int32)
            i1s = np.array([int(e.get("i1", 0)) for e in raw_elements], dtype=np.int32)
            i2s = np.array([int(e.get("i2", 0)) for e in raw_elements], dtype=np.int32)
            i3s = np.array([int(e.get("i3", 0)) for e in raw_elements], dtype=np.int32)
            dens = np.array([float(e.get("density", default_density)) for e in raw_elements], dtype=np.float64)
            if int(min(i0s.min(), i1s.min(), i2s.min(), i3s.min())) < 0:
                raise ValueError("Negative element index.")
            if int(max(i0s.max(), i1s.max(), i2s.max(), i3s.max())) >= n_nodes:
                raise ValueError("Element node index out of bounds.")
            dt = np.dtype([("i0", np.int32), ("i1", np.int32),
                           ("i2", np.int32), ("i3", np.int32),
                           ("density", np.float64)])
            sa = np.empty(n_elems, dtype=dt)
            sa["i0"] = i0s; sa["i1"] = i1s; sa["i2"] = i2s; sa["i3"] = i3s
            sa["density"] = dens
            ctypes.memmove(elem_arr, sa.ctypes.data, sa.nbytes)
        else:
            raise TypeError("Fallback to element loop")
    except Exception:
        # Fallback: element-by-element
        for i, e in enumerate(raw_elements):
            if isinstance(e, dict):
                i0 = _to_int(e.get("i0"), f"elements[{i}].i0")
                i1 = _to_int(e.get("i1"), f"elements[{i}].i1")
                i2 = _to_int(e.get("i2"), f"elements[{i}].i2")
                i3 = _to_int(e.get("i3"), f"elements[{i}].i3")
                density = _to_number(e.get("density", default_density), f"elements[{i}].density")
            elif isinstance(e, (list, tuple)) and len(e) >= 5:
                i0 = _to_int(e[0], f"elements[{i}][0]")
                i1 = _to_int(e[1], f"elements[{i}][1]")
                i2 = _to_int(e[2], f"elements[{i}][2]")
                i3 = _to_int(e[3], f"elements[{i}][3]")
                density = _to_number(e[4], f"elements[{i}][4]")
            else:
                raise ValueError(f"Invalid tetra element format at index {i}.")
            for idx_val, idx_name in ((i0, "i0"), (i1, "i1"), (i2, "i2"), (i3, "i3")):
                if idx_val < 0 or idx_val >= n_nodes:
                    raise ValueError(f"elements[{i}].{idx_name} out of node-index bounds.")
            elem_arr[i] = TetraElement(i0=i0, i1=i1, i2=i2, i3=i3, density=density)

    return node_arr, elem_arr


def parse_tetra_mesh_payload(data: dict):
    raw_nodes, raw_elements = _load_mesh_from_payload(data)
    return build_tetra_mesh_arrays(
        raw_nodes,
        raw_elements,
        default_density=float(data.get("density", 2500.0)),
    )


def bind_tetra_mesh_params(data: dict, node_arr, elem_arr) -> TetraMeshInput:
    """Attach receiver grid / execution flags to already-built mesh arrays."""
    params = TetraMeshInput()
    params.nodes = ctypes.cast(node_arr, ctypes.POINTER(MeshNode))
    params.num_nodes = len(node_arr)
    params.elements = ctypes.cast(elem_arr, ctypes.POINTER(TetraElement))
    params.num_elements = len(elem_arr)
    params.num_receivers_x = int(data.get("numReceiversX", 20))
    params.num_receivers_y = int(data.get("numReceiversY", 20))
    params.surface_x_min = float(data.get("surfaceXMin", -100.0))
    params.surface_x_max = float(data.get("surfaceXMax", 100.0))
    params.surface_y_min = float(data.get("surfaceYMin", -100.0))
    params.surface_y_max = float(data.get("surfaceYMax", 100.0))
    params.surface_z = float(data.get("surfaceZ", 0.0))
    if params.num_receivers_x <= 0 or params.num_receivers_y <= 0:
        raise ValueError("numReceiversX/numReceiversY must be positive.")
    if not math.isfinite(params.surface_x_min) or not math.isfinite(params.surface_x_max):
        raise ValueError("Invalid surface X bounds.")
    if not math.isfinite(params.surface_y_min) or not math.isfinite(params.surface_y_max):
        raise ValueError("Invalid surface Y bounds.")
    if params.surface_x_max <= params.surface_x_min or params.surface_y_max <= params.surface_y_min:
        raise ValueError("Surface bounds must satisfy max > min for both X and Y.")
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
    params.num_threads = int(data.get("numThreads", 0) or 0)
    params.receiver_block_size = int(data.get("receiverBlockSize", 0) or 0)
    params.source_block_size = int(data.get("sourceBlockSize", 0) or 0)
    params.simd_lanes = int(data.get("simdLanes", 0) or 0)
    n_rec = max(1, int(params.num_receivers_x) * int(params.num_receivers_y))
    n_src = max(1, int(params.num_elements))
    if params.receiver_block_size > n_rec:
        params.receiver_block_size = n_rec
    if params.source_block_size > n_src:
        params.source_block_size = n_src
    if params.receiver_block_size < 0:
        params.receiver_block_size = 0
    if params.source_block_size < 0:
        params.source_block_size = 0
    return params


def create_tetra_mesh_input(data: dict):
    node_arr, elem_arr = parse_tetra_mesh_payload(data)
    params = bind_tetra_mesh_params(data, node_arr, elem_arr)
    return params, node_arr, elem_arr


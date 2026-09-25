"""Tetra mesh → ctypes source/receiver arrays (shared by forward routes and analysis)."""

import ctypes


def tet_mesh_source_arrays(mesh_params):
    """Centroid sources with tet volumes from a populated ``TetraMeshInput``."""
    nodes = mesh_params.nodes
    elements = mesh_params.elements
    num_elements = int(mesh_params.num_elements)
    src_t = ctypes.c_double * num_elements
    x = src_t()
    y = src_t()
    z = src_t()
    density = src_t()
    volume = src_t()

    for i in range(num_elements):
        e = elements[i]
        n0 = nodes[e.i0]
        n1 = nodes[e.i1]
        n2 = nodes[e.i2]
        n3 = nodes[e.i3]
        x[i] = 0.25 * (n0.x + n1.x + n2.x + n3.x)
        y[i] = 0.25 * (n0.y + n1.y + n2.y + n3.y)
        z[i] = 0.25 * (n0.z + n1.z + n2.z + n3.z)
        ax = n1.x - n0.x
        ay = n1.y - n0.y
        az = n1.z - n0.z
        bx = n2.x - n0.x
        by = n2.y - n0.y
        bz = n2.z - n0.z
        cx = n3.x - n0.x
        cy = n3.y - n0.y
        cz = n3.z - n0.z
        triple = ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)
        volume[i] = abs(triple) / 6.0
        density[i] = float(e.density)
    return x, y, z, density, volume


def tet_mesh_receiver_arrays(mesh_params):
    """Surface observation grid from mesh receiver parameters."""
    rx = int(mesh_params.num_receivers_x)
    ry = int(mesh_params.num_receivers_y)
    n = rx * ry
    rec_t = ctypes.c_double * n
    x = rec_t()
    y = rec_t()
    z = rec_t()
    x_min = float(mesh_params.surface_x_min)
    x_max = float(mesh_params.surface_x_max)
    y_min = float(mesh_params.surface_y_min)
    y_max = float(mesh_params.surface_y_max)
    zz = float(mesh_params.surface_z)
    dx = (x_max - x_min) / float(max(rx - 1, 1))
    dy = (y_max - y_min) / float(max(ry - 1, 1))
    k = 0
    for i in range(rx):
        xi = x_min + i * dx
        for j in range(ry):
            x[k] = xi
            y[k] = y_min + j * dy
            z[k] = zz
            k += 1
    return x, y, z

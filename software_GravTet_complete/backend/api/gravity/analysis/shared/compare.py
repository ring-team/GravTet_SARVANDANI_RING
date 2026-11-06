"""Compare a candidate gravity field against the analytical reference."""

from __future__ import annotations

from gravity.analysis_gravity.metrics import compute_metrics, global_l2_normalized_pointwise_percent

from api.gravity.shared.helpers import downsample_gravity_grid

from .reference import validate_burial_center_consistency


def resolve_cached_candidate(data: dict) -> tuple[list[float] | None, int | None, int | None]:
    """Return (candidate, comparison_nx, comparison_ny) when client sent a safe cached field."""
    cached = data.get("candidateResults")
    if not isinstance(cached, list) or len(cached) == 0:
        return None, None, None
    if not all(isinstance(v, (int, float)) for v in cached):
        return None, None, None
    vals = [float(v) for v in cached]
    ref_nx = int(data.get("numReceiversX", 100))
    ref_ny = int(data.get("numReceiversY", 100))
    if len(vals) == ref_nx * ref_ny:
        return vals, ref_nx, ref_ny
    map_nx = int(data.get("mapNumX") or data.get("map_num_x") or 0)
    map_ny = int(data.get("mapNumY") or data.get("map_num_y") or 0)
    if map_nx > 0 and map_ny > 0 and len(vals) == map_nx * map_ny:
        return vals, map_nx, map_ny
    return None, None, None


def align_reference_to_grid(
    reference: list[float],
    ref_nx: int,
    ref_ny: int,
    cmp_nx: int,
    cmp_ny: int,
) -> list[float]:
    if ref_nx == cmp_nx and ref_ny == cmp_ny:
        return reference
    aligned, out_nx, out_ny, _ = downsample_gravity_grid(
        reference,
        ref_nx,
        ref_ny,
        max_side=min(cmp_nx, cmp_ny),
    )
    if out_nx == cmp_nx and out_ny == cmp_ny and len(aligned) == cmp_nx * cmp_ny:
        return aligned
    raise RuntimeError(
        f"Cannot align analytical reference grid {ref_nx}x{ref_ny} to candidate map {cmp_nx}x{cmp_ny}"
    )


def validate_candidate_reference_amplitude(reference: list[float], candidate: list[float]) -> None:
    n = min(len(reference), len(candidate))
    if n == 0:
        return
    mean_ref = sum(reference[:n]) / n
    mean_can = sum(candidate[:n]) / n
    scale = max(abs(mean_ref), abs(mean_can), 1e-9)
    if abs(mean_can - mean_ref) / scale > 0.2:
        raise ValueError(
            "Gravity map amplitude does not match the analytical reference for the current burial depth. "
            "Click Calculate Gravity after changing depth or model size, then run analysis again."
        )


def build_comparison_payload(reference: list[float], candidate: list[float], nx: int, ny: int) -> dict:
    n = min(len(reference), len(candidate))
    global_norm_pct = global_l2_normalized_pointwise_percent(reference, candidate)
    residual = [candidate[i] - reference[i] for i in range(n)]

    global_norm_map, map_nx, map_ny, _ = downsample_gravity_grid(global_norm_pct, nx, ny)
    reference_map, _, _, _ = downsample_gravity_grid(reference, nx, ny)
    candidate_map, _, _, _ = downsample_gravity_grid(candidate, nx, ny)

    return {
        "map_num_x": map_nx,
        "map_num_y": map_ny,
        "analytical_reference_map": reference_map,
        "candidate_map": candidate_map,
        "candidate_stats_min": min(candidate) if candidate else 0.0,
        "candidate_stats_max": max(candidate) if candidate else 0.0,
        "comparison_maps": {
            "relative_l2_percent_pointwise": global_norm_map,
            "correlation_residual": downsample_gravity_grid(residual, nx, ny)[0],
        },
    }


def try_finalize_with_cached_candidate(
    *,
    analysis_method: str,
    data: dict,
    reference: list[float],
    reference_compute_ms: float,
    ref_nx: int,
    ref_ny: int,
) -> dict | None:
    """Reuse the browser forward map when sent; avoids a second native forward solve."""
    cached, cmp_nx, cmp_ny = resolve_cached_candidate(data)
    if cached is None or cmp_nx is None or cmp_ny is None:
        return None
    reference = align_reference_to_grid(reference, ref_nx, ref_ny, cmp_nx, cmp_ny)
    return finalize_analysis(
        analysis_method=analysis_method,
        data=data,
        reference=reference,
        reference_compute_ms=reference_compute_ms,
        candidate=cached,
        candidate_compute_ms=0.0,
        grid_nx=cmp_nx,
        grid_ny=cmp_ny,
    )


def finalize_analysis(
    *,
    analysis_method: str,
    data: dict,
    reference: list[float],
    reference_compute_ms: float,
    candidate: list[float],
    candidate_compute_ms: float,
    grid_nx: int,
    grid_ny: int,
) -> dict:
    validate_burial_center_consistency(data)
    validate_candidate_reference_amplitude(reference, candidate)
    metrics = compute_metrics(reference, candidate)
    maps = build_comparison_payload(reference, candidate, grid_nx, grid_ny)
    return {
        "analysis_method": analysis_method,
        "reference_method": "analytical_closedform",
        "compute_ms": candidate_compute_ms,
        "reference_compute_ms": reference_compute_ms,
        **maps,
        **metrics,
    }

"""Accuracy metric methods used by analysis service."""

import math


def mae(reference, candidate):
    n = min(len(reference), len(candidate))
    if n == 0:
        raise RuntimeError("No data points available for analysis")
    return sum(abs(candidate[i] - reference[i]) for i in range(n)) / n


def rmse(reference, candidate):
    n = min(len(reference), len(candidate))
    if n == 0:
        raise RuntimeError("No data points available for analysis")
    return math.sqrt(sum((candidate[i] - reference[i]) ** 2 for i in range(n)) / n)


def max_abs_error(reference, candidate):
    n = min(len(reference), len(candidate))
    if n == 0:
        raise RuntimeError("No data points available for analysis")
    return max(abs(candidate[i] - reference[i]) for i in range(n))


def relative_l2_percent(reference, candidate):
    """Global relative RMS: ||c - r||_2 / ||r||_2 as a percentage (no per-cell ε, no α)."""
    n = min(len(reference), len(candidate))
    if n == 0:
        raise RuntimeError("No data points available for analysis")
    ref_norm2 = sum(reference[i] * reference[i] for i in range(n))
    err_norm2 = sum((candidate[i] - reference[i]) ** 2 for i in range(n))
    if ref_norm2 <= 1e-30:
        return 0.0
    return math.sqrt(err_norm2 / ref_norm2) * 100.0


def _local_relative_denominator_floor(reference: list, n: int) -> float:
    """Avoid division by zero where |r_i| is tiny (Ren-style local relative maps)."""
    if n <= 0:
        return 1e-12
    max_abs_ref = max(abs(reference[i]) for i in range(n))
    return max(1e-12, 1e-6 * max_abs_ref)


def global_l2_normalized_pointwise_percent(reference: list, candidate: list) -> list[float]:
    """Per receiver: 100 * |c_i - r_i| / ||r||_2 (global denominator, not local %)."""
    n = min(len(reference), len(candidate))
    ref_norm2 = sum(reference[i] * reference[i] for i in range(n))
    if ref_norm2 <= 1e-30:
        return [0.0] * n
    ref_rms = math.sqrt(ref_norm2)
    return [abs(candidate[i] - reference[i]) / ref_rms * 100.0 for i in range(n)]


def local_relative_percent_pointwise(reference: list, candidate: list) -> list[float]:
    """Per receiver (Ren et al. style): 100 * |c_i - r_i| / max(|r_i|, ε)."""
    n = min(len(reference), len(candidate))
    floor = _local_relative_denominator_floor(reference, n)
    return [abs(candidate[i] - reference[i]) / max(abs(reference[i]), floor) * 100.0 for i in range(n)]


def signed_local_relative_percent_pointwise(reference: list, candidate: list) -> list[float]:
    """Ren-style signed map: 100 * (c_i - r_i) / max(|r_i|, ε) (not absolute value)."""
    n = min(len(reference), len(candidate))
    floor = _local_relative_denominator_floor(reference, n)
    out: list[float] = []
    for i in range(n):
        denom = max(abs(reference[i]), floor)
        out.append((candidate[i] - reference[i]) / denom * 100.0)
    return out


def max_local_relative_percent(reference, candidate) -> float:
    """Maximum pointwise local relative error (%) — scalar reported in Ren et al. tables."""
    pointwise = local_relative_percent_pointwise(reference, candidate)
    return max(pointwise) if pointwise else 0.0


def correlation_r(reference, candidate):
    n = min(len(reference), len(candidate))
    if n == 0:
        raise RuntimeError("No data points available for analysis")
    mean_ref = sum(reference[:n]) / n
    mean_can = sum(candidate[:n]) / n
    cov = 0.0
    var_ref = 0.0
    var_can = 0.0
    for i in range(n):
        dr = reference[i] - mean_ref
        dc = candidate[i] - mean_can
        cov += dr * dc
        var_ref += dr * dr
        var_can += dc * dc
    denom = math.sqrt(var_ref * var_can)
    return 0.0 if denom <= 1e-30 else cov / denom


def compute_metrics(reference, candidate):
    n = min(len(reference), len(candidate))
    if n == 0:
        raise RuntimeError("No data points available for analysis")
    return {
        "mae_mgal": mae(reference, candidate),
        "rmse_mgal": rmse(reference, candidate),
        "max_abs_error_mgal": max_abs_error(reference, candidate),
        "relative_l2_percent": relative_l2_percent(reference, candidate),
        "correlation_r": correlation_r(reference, candidate),
        "num_points_compared": n,
    }


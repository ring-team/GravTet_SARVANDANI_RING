"""Analysis metric definitions (closed-form reference vs candidate)."""

import math

import pytest

from gravity.analysis_gravity.metrics import (
    global_l2_normalized_pointwise_percent,
    local_relative_percent_pointwise,
    max_local_relative_percent,
    relative_l2_percent,
    signed_local_relative_percent_pointwise,
)


def test_relative_l2_percent_matches_manual():
    reference = [1.0, 2.0, 3.0, 4.0]
    candidate = [1.1, 1.9, 3.2, 3.8]
    err_norm2 = sum((c - r) ** 2 for c, r in zip(candidate, reference))
    ref_norm2 = sum(r * r for r in reference)
    expected = math.sqrt(err_norm2 / ref_norm2) * 100.0
    assert relative_l2_percent(reference, candidate) == pytest.approx(expected)


def test_global_normalized_pointwise_uses_global_ref_l2_norm():
    reference = [3.0, 4.0]
    candidate = [3.0, 5.0]
    ref_rms = math.sqrt(9 + 16)
    pointwise = global_l2_normalized_pointwise_percent(reference, candidate)
    assert pointwise[0] == pytest.approx(0.0)
    assert pointwise[1] == pytest.approx(abs(5.0 - 4.0) / ref_rms * 100.0)


def test_local_relative_is_per_receiver():
    reference = [1.0, 2.0]
    candidate = [1.1, 1.8]
    local = local_relative_percent_pointwise(reference, candidate)
    assert local[0] == pytest.approx(10.0)
    assert local[1] == pytest.approx(10.0)
    assert max_local_relative_percent(reference, candidate) == pytest.approx(10.0)


def test_signed_local_relative_keeps_sign():
    reference = [1.0, -2.0]
    candidate = [1.05, -1.9]
    signed = signed_local_relative_percent_pointwise(reference, candidate)
    assert signed[0] == pytest.approx(5.0)
    assert signed[1] == pytest.approx(5.0)

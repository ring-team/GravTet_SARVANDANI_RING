"""The UI must advertise native kernel support, not browser CPU guesses."""
import ctypes
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api.gravity.shared.routes_misc import quadrature_simd_capabilities


@pytest.mark.parametrize('lanes,available', [(1, []), (2, [2]), (4, [4])])
def test_reports_only_compiled_width(lanes, available):
    query = Mock(return_value=lanes)
    result = quadrature_simd_capabilities(SimpleNamespace(quadrature_simd_lanes=query))
    assert result == {'available_lanes': available, 'active_lanes': lanes}
    assert query.argtypes == []
    assert query.restype is ctypes.c_int


@pytest.mark.parametrize('library', [None, SimpleNamespace()])
def test_missing_library_or_old_build_is_unknown(library):
    assert quadrature_simd_capabilities(library) == {
        'available_lanes': [], 'active_lanes': None,
    }


@pytest.mark.parametrize('widths', [[2], [2, 4], [2, 4, 8]])
def test_all_runtime_supported_widths_are_offered(widths):
    library = SimpleNamespace(
        quadrature_simd_lanes=Mock(return_value=max(widths)),
        quadrature_simd_supports=Mock(side_effect=lambda width: width in widths),
    )
    assert quadrature_simd_capabilities(library)['available_lanes'] == widths


def test_native_lane_selection_and_validation():
    from api.app import app
    client = app.test_client()
    widths = client.get('/api/health').get_json()['quadrature_simd']['available_lanes']
    if not widths:
        pytest.skip('Native SIMD library unavailable')
    payload = {
        'mesh': {
            'nodes': [[0, 0, -100], [10, 0, -100], [0, 10, -100], [0, 0, -110]],
            # Odd number exercises half-filled eight-lane batches and tile tails.
            'elements': [[0, 1, 2, 3, density] for density in (2500, -200, 1700)],
        },
        'numReceiversX': 5, 'numReceiversY': 3,
        'surfaceXMin': -30, 'surfaceXMax': 30,
        'surfaceYMin': -20, 'surfaceYMax': 20, 'surfaceZ': 0,
        'receiverBlockSize': 2, 'sourceBlockSize': 3, 'numThreads': 2,
    }
    url = '/api/compute_gravity_mesh_quadrature'
    reference = client.post(url, json={**payload, 'executionMode': 'tiled'})
    assert reference.status_code == 200, reference.get_json()
    expected = reference.get_json()['results']
    for mode in ('simd_tiled', 'simd_tiled_threading'):
        for width in widths:
            response = client.post(url, json={**payload, 'executionMode': mode, 'simdLanes': width})
            assert response.status_code == 200, response.get_json()
            assert response.get_json()['results'] == pytest.approx(expected, rel=1e-12, abs=1e-14)
            assert response.get_json()['solver_meta']['simd_lanes'] == width
        response = client.post(url, json={**payload, 'executionMode': mode, 'simdLanes': 16})
        assert response.status_code == 400

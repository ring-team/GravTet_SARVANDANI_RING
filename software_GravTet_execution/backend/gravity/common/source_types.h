#pragma once

// Shared discrete point types used by the synthetic-model discretization
// code (`synthetic_gravity`) and by every forward solver that consumes it
// (Direct Newton, AMFM, Barnes-Hut, Quadrature).
//
// This header belongs to no single solver: `synthetic_gravity` must be
// buildable without any forward-method folder present, so it (and the
// `gravity_sources_*.h` headers it uses) include this file instead of a
// solver-specific header. Keep it that way -- do not add solver-specific
// fields here.

#include <vector>

struct Source {
    double x, y, z;     // position (m)
    double density;     // kg/m^3
    double volume;      // m^3
};

struct Receiver {
    double x, y, z;      // position (m)
};

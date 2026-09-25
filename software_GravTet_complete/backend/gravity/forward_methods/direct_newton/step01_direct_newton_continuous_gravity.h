// Step 01 — Direct Newton continuous-gravity API surface and discrete runtime types.
//
// `Source`/`Receiver` are the solver-neutral point types shared with
// `synthetic_gravity` (see ../../common/source_types.h) -- Direct Newton does
// not own them, it just consumes them for its own algorithm below.
#ifndef STEP01_DIRECT_NEWTON_CONTINUOUS_GRAVITY_H
#define STEP01_DIRECT_NEWTON_CONTINUOUS_GRAVITY_H

#include "../../common/source_types.h"
#include <vector>

enum class DirectNewtonExecutionMode {
    Reference = 3,
    Tiled = 0,
    SIMDTiled = 1,
    SIMDTiledThreading = 2,
};

// Compute vertical gravity component at one receiver
double compute_gz(const Receiver& receiver, const std::vector<Source>& sources);

// Compute gravity for multiple receivers
std::vector<double> forward_gravity(
    const std::vector<Receiver>& receivers,
    const std::vector<Source>& sources
);

// Compute gravity for multiple receivers with explicit execution mode.
std::vector<double> forward_gravity_with_mode(
    const std::vector<Receiver>& receivers,
    const std::vector<Source>& sources,
    DirectNewtonExecutionMode mode,
    int num_threads_requested,
    int receiver_block_size = 0,
    int source_block_size = 0
);

// Convert m/s^2 to mGal
double to_mGal(double g_si);

#endif // STEP01_DIRECT_NEWTON_CONTINUOUS_GRAVITY_H


// gravity_sources.h: synthetic gravity — discrete sources for forward models.
#ifndef GRAVITY_SOURCES_H
#define GRAVITY_SOURCES_H

// ============================================================================
// Main header file for gravity source generation
// This file includes both hexahedral and tetrahedral source generation headers
// for backward compatibility. Individual headers can also be included directly.
// ============================================================================

#include "gravity_sources_structured_hexahedral.h"
#include "gravity_sources_structured_tetrahedral.h"
#include "gravity_sources_polyhedral.h"
#include "gravity_sources_unstructured_tetrahedral.h"
#include "gravity_sources_unstructured_polyhedral.h"

#endif // GRAVITY_SOURCES_H


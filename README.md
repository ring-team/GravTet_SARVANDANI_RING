# GravTet

**GravTet: High-Performance Computing Software for Gravity Forward Modeling on Unstructured Tetrahedral Meshes Using Second-Order Quadrature**

GravTet is high-performance computing software for computing the vertical gravity component **g_z** from three-dimensional density models discretized on unstructured tetrahedral meshes. It employs a second-order symmetric quadrature formulation implemented in a modular C++ computational core that leverages cache blocking, SIMD vectorization (NEON/AVX), and multithreading to achieve substantial speedups on modern shared-memory CPUs. A Python/Flask server layer and a web-based interface support model setup, execution, and visualization. All optimized execution modes evaluate the **same discrete forward model**, so performance improvements do not change the underlying physics.

The distribution includes two convenient entry points:
- `software_GravTet_complete/` — full editable source code (C++, Python, TypeScript/React).
- `software_GravTet_execution/` — ready-to-execute bundle with pre-compiled libraries and static UI.

---

## Code metadata

| Item | Description |
|------|-------------|
| **Current code version** | Development repository (see release tags when available) |
| **Permanent link to repository** | https://github.com/ring-team/GravTet_SARVANDANI_RING |
| **Legal license** | [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) |
| **Code versioning system** | Git |
| **Software language** | C++17 (kernel), Python 3.8+ (server), TypeScript/React (web UI) |
| **Compilation requirements** | CMake ≥ 3.15; C++17 compiler (GCC, Clang, or MSVC) |
| **Required runtime / build tools** | Python 3.8+, Flask, flask-cors, NumPy, Gmsh; Node.js ≥ 18, npm |
| **Supported platforms** | Linux and macOS on x86_64 and ARM64 (AVX2 or ARM NEON for SIMD paths); Windows via WSL2 |
| **Developers** | M. Sarvandani and collaborators |
| **Contact** | Via the repository issue tracker |

---

## Software description

### Purpose

GravTet is open-source software for forward modeling of **g_z** on unstructured tetrahedral meshes. It targets large-scale problems with millions of mesh cells and observation points on shared-memory CPU systems.

**Primary users:**

- Exploration geophysicists (interpretation, survey design, inversion workflows)
- Method developers (validated reference implementation for discretization and numerical tests)
- HPC and software engineers (benchmarking and integration of geophysical kernels)

### Functionalities

- **Second-order quadrature forward modeling** of g_z on tetrahedral meshes
- **Four execution modes** (same discrete formulation in all modes):

  | Mode | API / wire name | Optimization |
  |------|-----------------|--------------|
  | Reference | `reference` | Baseline nested-loop implementation |
  | Tiled | `tiled` | Cache blocking |
  | SIMDTiled | `simd_tiled` | Cache blocking + SIMD vectorization |
  | SIMDTiledThreading | `simd_tiled_threading` | Cache blocking + SIMD + receiver-level multithreading (default) |

- **Analytical closed-form reference** for homogeneous **cube / rectangular prism** models (Okabe / Nagy prism formula), independent of the quadrature discretization
- **Cross-method validation**: ℓ₂-normalized relative-error map comparing quadrature against the closed-form reference on the same observation grid
- **Illustrative geological example**: valley–mountain composite model on an unstructured tetrahedral mesh in a half-space setting
- **Web interface** for tetrahedral model setup, mesh inspection, execution-mode selection, gravity-map visualization, and export
- **REST API** for programmatic forward modeling and automated testing

### Design principles

1. **Numerical consistency** — all execution paths evaluate the same discrete quadrature model
2. **Reproducibility** — identical inputs yield identical results within floating-point tolerance
3. **Modularity** — separation of C++ kernel, Flask server, and web interface

### Scope

The published formulation and validation focus on:

- **Observable:** vertical gravity component g_z only
- **Discretization:** unstructured tetrahedral meshes
- **Integration:** second-order symmetric quadrature (four Hammer points per tetrahedron)
- **Validation benchmark:** homogeneous buried cube against analytical rectangular-prism solution
- **Application example:** valley–mountain topography-bearing composite model

Near-field regularization uses a fixed squared-distance threshold **ε = 1×10⁻¹⁰ m²** (contributions closer than √ε are skipped).

---

## Architecture

```
Web UI (React/Vite)  ──HTTP──>  Flask server  ──ctypes──>  C++ core (.dylib / .so)
```

| Layer | Role |
|-------|------|
| **C++ computational core** | Second-order quadrature kernel; optional closed-form prism evaluator |
| **Python / Flask server** | REST endpoints, mesh preparation, `ctypes` orchestration |
| **Web interface** | TypeScript/React (Vite), Three.js for 3D visualization |

### Repository layout

```
GravTet_SARVANDANI_RING/
├── software_GravTet_complete/  # Full editable source (for developers)
│   ├── backend/                # C++ sources + Python API + build_system
│   │   ├── gravity/            # quadrature kernels and helpers
│   │   └── api/                # Flask routes and server
│   └── frontend/               # React + TypeScript sources (src/, public/)
│
└── software_GravTet_execution/ # Ready-to-execute bundle (easiest for end users)
    ├── setup.sh / setup.ps1
    ├── backend/                # sources + pre-built libs (build/lib/)
    ├── ui/                     # pre-built static frontend
    ├── shared/                 # common launcher logic
    └── macos/ linux/ windows/  # platform-specific launchers
```

**Backend computation** lives under `backend/gravity/` (or the equivalent in the execution bundle):
- `quadrature_second_order_gravity/` — C++ quadrature kernels (Reference, Tiled, SIMDTiled, SIMDTiledThreading)
- `analytical_closedform/` — Python closed-form rectangular-prism reference
- `mesh/` — Gmsh / tetrahedral mesh helpers

**Build artifacts** are placed under `backend/build/lib/` (`.dylib` on macOS, `.so` on Linux).

---

## Performance (benchmark summary)

On an Apple M4 (ARM64/NEON) platform, relative to the reference implementation:

| Optimization layer | Approximate speedup |
|--------------------|-------------------|
| Cache blocking (Tiled) | ~8× |
| + SIMD (SIMDTiled) | ~14× |
| + multithreading (SIMDTiledThreading) | up to ~90× |

Reported speedups are **NEON measurements**. AVX2 behavior on x86_64 follows the same discrete formulation.

Benchmarks use the **median of three repetitions** with identical inputs.

---

## Installation

### Prerequisites

| Tool | Version |
|------|---------|
| C++ compiler | C++17 (Clang, GCC, or MSVC) |
| CMake | ≥ 3.15 |
| Python | ≥ 3.8 |
| Node.js + npm | Node ≥ 18 (for development version) |

Python packages (runtime): `flask`, `flask-cors`, `numpy`, `gmsh`, `waitress`.

### Ready-to-execute bundle (recommended for most users)

The `software_GravTet_execution/` directory is self-contained and does not require Node.js or a full source checkout.

```bash
cd GravTet_SARVANDANI_RING/software_GravTet_execution
bash setup.sh          # one-time: creates venv and ensures libraries
```

Then launch:

- **macOS**: `bash macos/Launcher_GravTet.command` (or `python3 macos/launcher.py`)
- **Linux**: `bash linux/Launch_GravTet.sh`
- **Windows**: double-click `windows\Launch_GravTet.bat` (or run the `.py` via PowerShell)

The application opens in your default web browser. Press `Ctrl+C` in the terminal to stop.

**Prerequisites for the execution bundle**
- Python 3.8+ (with venv support)
- CMake and a C++ compiler
- On macOS: `xcode-select --install`
- On Linux: `python3-venv`, `cmake`, `g++` (or equivalent)

### Complete source version (full editable)

```bash
cd GravTet_SARVANDANI_RING/software_GravTet_complete

# Build C++ core
cd backend && bash build_system/build.sh

# Python environment
python3 -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r backend/requirements.txt

# Frontend (TypeScript/React)
cd ../frontend
npm install
npm run dev
```

To build the ready-to-execute bundle (for `software_GravTet_execution/`):

```bash
cd frontend
VITE_EXECUTION_BUNDLE=1 npm run build
# then copy dist/ contents into the execution/ui/ folder
```

The backend server (Flask) and frontend (Vite) can be started independently if desired.

---

## How to run

### Ready-to-execute (easiest)

After `setup.sh`, launch as described above. The interface runs entirely from the execution bundle.

### Complete source

Typical commands (from the `software_GravTet_complete/` directory):

```bash
# Backend (in one terminal)
cd backend
source .venv/bin/activate
python -m api.api_server   # or use the run script if present

# Frontend (in another terminal)
cd frontend
npm run dev
```

Open the frontend URL (usually http://localhost:5174) in your browser.

After any C++ rebuild, restart the backend process (ctypes does not reload native libraries at runtime).

---

## User workflow

1. Define or generate a **tetrahedral mesh** and density model.
2. Define **receiver locations** on a surface grid.
3. Select an **execution mode** (Reference / Tiled / SIMDTiled / SIMDTiledThreading).
4. Run forward modeling to compute **g_z**.
5. Visualize results and compare against the **analytical closed-form** reference (available for cube / rectangular-prism models).

The same workflow is available through the REST API.

---

## Tests and reproducibility

```bash
cd software_GravTet_complete/backend
source .venv/bin/activate
python -m pytest
```

The suite includes mesh validation and end-to-end comparisons of quadrature output against the analytical closed-form reference.

---

## Citation

If you use GravTet in academic work, please cite the associated software paper (to be published in SoftwareX):

> M. Sarvandani et al., *GravTet: A high-performance computing software for gravity forward modeling on unstructured tetrahedral meshes*, SoftwareX (2026).

---

## License

Distributed under the **Apache License 2.0**.  
See [LICENSE](https://www.apache.org/licenses/LICENSE-2.0) for details.

---

## Troubleshooting

| Problem | Action |
|---------|--------|
| Library not loaded | Run the build command in the chosen version (`backend/build_system/build.sh` or `software_GravTet_execution/setup.sh`) and confirm libraries exist in `build/lib/` |
| Changes have no effect | Restart the backend (ctypes caches the loaded library) |
| Port conflict | Default ports are 5002 (backend) and 5174 (frontend) |
| Missing Python packages | `pip install -r backend/requirements.txt` inside the virtual environment |
| macOS quarantine | Run `xattr -dr com.apple.quarantine .` or execute via `bash` |

For additional help, open an issue on the repository.
"""
KAVACH Wildlife Early Warning & Alert Network Backend Entrypoint.
Provides the primary application object and runner.

Can be run via:
    python backend/app.py
    python -m uvicorn app:app --app-dir backend --host 0.0.0.0 --port 8000
    uvicorn predict:app --host 0.0.0.0 --port 8000
"""
import os
import sys

# Prevent OpenBLAS / OMP memory allocation exhaustion on Windows multi-core CPUs
os.environ["OPENBLAS_NUM_THREADS"] = "4"
os.environ["OMP_NUM_THREADS"] = "4"
os.environ["MKL_NUM_THREADS"] = "4"

from pathlib import Path

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import uvicorn
from predict import app

# Export app for ASGI servers like uvicorn app:app
__all__ = ["app"]

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    print(f"\n[KAVACH] Starting backend server on http://{host}:{port} ...", flush=True)
    uvicorn.run("predict:app", host=host, port=port, reload=False)

#!/usr/bin/env python3
"""
Pulse — Benchmark Script (delegating wrapper)

The real benchmark harness is implemented in TypeScript (scripts/bench.ts) so it
measures the ACTUAL deterministic safety engine the app ships (drug-interaction
matching, 40-pattern red-flag scan, combined safety pass) — no placeholder
timings. This wrapper simply forwards to it so `python3 scripts/bench.py` and
`make bench` keep working.

Usage:
    python3 scripts/bench.py [--assert]
"""

import os
import shutil
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def main() -> int:
    npx = shutil.which("npx")
    if npx is None:
        print("[bench] npx not found — install Node.js to run the benchmark harness.")
        return 1

    cmd = [npx, "tsx", "scripts/bench.ts", *sys.argv[1:]]
    return subprocess.call(cmd, cwd=ROOT)


if __name__ == "__main__":
    sys.exit(main())

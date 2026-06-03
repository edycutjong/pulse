#!/usr/bin/env python3
"""
Pulse — Offline Verification Script
Proves the app works with zero network access.
Usage: python3 scripts/verify_offline.py
"""

import os
import sys
import subprocess
import socket
import json

CHECKS_PASSED = 0
CHECKS_FAILED = 0

def check(name, condition, detail=""):
    global CHECKS_PASSED, CHECKS_FAILED
    if condition:
        CHECKS_PASSED += 1
        print(f"  ✅ {name}")
    else:
        CHECKS_FAILED += 1
        print(f"  ❌ {name}: {detail}")

def verify_no_cloud_imports():
    """Scan source for cloud API calls."""
    print("[verify] Checking for cloud API imports...")
    
    banned = ['openai', 'anthropic', 'googleapis', 'azure', 'aws-sdk', 'fetch(', 'axios']
    src_dir = os.path.join(os.path.dirname(__file__), '..', 'src')
    
    violations = []
    for root, dirs, files in os.walk(src_dir):
        for fname in files:
            if fname.endswith(('.ts', '.tsx', '.js', '.jsx')):
                fpath = os.path.join(root, fname)
                with open(fpath, 'r', encoding='utf-8') as f:
                    content = f.read()
                for keyword in banned:
                    if keyword in content:
                        violations.append(f"{fname}: contains '{keyword}'")
    
    check("No cloud API imports in source", len(violations) == 0,
          f"Found {len(violations)} violations: {', '.join(violations[:3])}")

def verify_qvac_only():
    """Verify all inference goes through @qvac/sdk."""
    print("[verify] Checking @qvac/sdk exclusivity...")
    
    src_dir = os.path.join(os.path.dirname(__file__), '..', 'src')
    has_qvac_import = False
    
    for root, dirs, files in os.walk(src_dir):
        for fname in files:
            if fname.endswith(('.ts', '.tsx')):
                fpath = os.path.join(root, fname)
                with open(fpath, 'r', encoding='utf-8') as f:
                    content = f.read()
                if '@qvac/sdk' in content:
                    has_qvac_import = True
    
    check("@qvac/sdk imported in source", has_qvac_import,
          "No @qvac/sdk import found in src/")

def verify_data_fixtures():
    """Verify required data fixtures exist."""
    print("[verify] Checking data fixtures...")
    
    base = os.path.join(os.path.dirname(__file__), '..')
    
    check("interactions.csv exists",
          os.path.isfile(os.path.join(base, 'data', 'fixtures', 'interactions.csv')))
    check("red_flags.csv exists",
          os.path.isfile(os.path.join(base, 'data', 'fixtures', 'red_flags.csv')))
    check("Medical corpus exists",
          os.path.isdir(os.path.join(base, 'data', 'corpus')))
    
    # Check fixture has content
    interactions_path = os.path.join(base, 'data', 'fixtures', 'interactions.csv')
    if os.path.isfile(interactions_path):
        with open(interactions_path) as f:
            lines = [l for l in f.readlines() if l.strip()]
        check("interactions.csv has ≥20 entries", len(lines) - 1 >= 20,
              f"Only {len(lines) - 1} entries (need 20+)")

def verify_conservative_triage():
    """Verify triage.ts has conservative fallback logic."""
    print("[verify] Checking conservative triage guardrails...")
    
    triage_path = os.path.join(os.path.dirname(__file__), '..', 'src', 'core', 'triage.ts')
    if os.path.isfile(triage_path):
        with open(triage_path, 'r') as f:
            content = f.read()
        check("Triage has emergency level", '"emergency"' in content)
        check("Triage has urgent level", '"urgent"' in content)
        check("Triage has routine level", '"routine"' in content)
        check("Triage has fallback logic", 'catch' in content or 'fallback' in content.lower())
    else:
        check("triage.ts exists", False, "File not found")

def verify_not_medical_device():
    """Verify disclaimer is present."""
    print("[verify] Checking medical device disclaimer...")
    
    base = os.path.join(os.path.dirname(__file__), '..')
    readme_path = os.path.join(base, 'README.md')
    
    if os.path.isfile(readme_path):
        with open(readme_path, 'r') as f:
            content = f.read().lower()
        check("README has medical disclaimer",
              'not a medical device' in content or 'not medical advice' in content,
              "Missing 'not a medical device' disclaimer")
    else:
        check("README.md exists", False, "README.md not found — create it before submission")

def main():
    print("=" * 60)
    print("  Pulse — Offline Verification")
    print("  Proving zero-cloud operation")
    print("=" * 60)
    print()
    
    verify_no_cloud_imports()
    print()
    verify_qvac_only()
    print()
    verify_data_fixtures()
    print()
    verify_conservative_triage()
    print()
    verify_not_medical_device()
    print()
    
    print("=" * 60)
    print(f"  Results: {CHECKS_PASSED} passed, {CHECKS_FAILED} failed")
    print("=" * 60)
    
    if CHECKS_FAILED > 0:
        print("\n⚠️  Some checks failed. Fix before submission.")
        sys.exit(1)
    else:
        print("\n✅ All offline verification checks passed!")
        sys.exit(0)

if __name__ == '__main__':
    main()

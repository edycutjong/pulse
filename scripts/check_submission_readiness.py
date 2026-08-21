#!/usr/bin/env python3
"""
Pulse — Submission Readiness Checker
Validates all required files and content exist before submission.
Usage: python3 scripts/check_submission_readiness.py
"""

import os
import sys
import json

CHECKS_PASSED = 0
CHECKS_FAILED = 0
WARNINGS = 0

def check(name, condition, detail="", is_warning=False):
    global CHECKS_PASSED, CHECKS_FAILED, WARNINGS
    if condition:
        CHECKS_PASSED += 1
        print(f"  ✅ {name}")
    elif is_warning:
        WARNINGS += 1
        print(f"  ⚠️  {name}: {detail}")
    else:
        CHECKS_FAILED += 1
        print(f"  ❌ {name}: {detail}")

def main():
    base = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    
    print("=" * 60)
    print("  Pulse — Submission Readiness Check")
    print(f"  Project root: {base}")
    print("=" * 60)
    print()
    
    # 1. Required files
    print("[check] Required files...")
    required_files = [
        'README.md',
        'LICENSE',
        'package.json',
        'App.tsx',
        'tsconfig.json',
        'src/core/qvac.ts',
        'src/core/rag.ts',
        'src/core/triage.ts',
        'src/core/voice.ts',
        'data/fixtures/interactions.csv',
        'data/fixtures/red_flags.csv',
        'data/corpus/who_essential_medicines.txt',
        'data/corpus/first_aid_protocols.txt',
        'scripts/seed.py',
        'scripts/bench.py',
        'scripts/verify_offline.py',
    ]
    for f in required_files:
        check(f, os.path.isfile(os.path.join(base, f)), "File not found")
    print()
    
    # 2. Package.json checks
    print("[check] package.json...")
    pkg_path = os.path.join(base, 'package.json')
    if os.path.isfile(pkg_path):
        with open(pkg_path) as f:
            pkg = json.load(f)
        deps = pkg.get('dependencies', {})
        check("@qvac/sdk in dependencies", '@qvac/sdk' in deps, "Missing @qvac/sdk dependency")
        check("expo in dependencies", 'expo' in deps, "Missing expo dependency")
    print()
    
    # 3. README content
    print("[check] README.md content...")
    readme_path = os.path.join(base, 'README.md')
    if os.path.isfile(readme_path):
        with open(readme_path, 'r') as f:
            readme = f.read().lower()
        check("Has project description", len(readme) > 200, "README too short (<200 chars)")
        check("Mentions QVAC", 'qvac' in readme, "No mention of QVAC SDK")
        check("Has 'Why ONLY QVAC' section", 'only qvac' in readme or 'why qvac' in readme,
              "Missing sponsor defense section", is_warning=True)
        check("Has medical disclaimer", 'not a medical device' in readme or 'not medical advice' in readme,
              "Missing medical disclaimer")
        check("Has test count", 'test' in readme and any(c.isdigit() for c in readme),
              "Missing test count", is_warning=True)
        check("Has honest limitations", 'limitation' in readme,
              "Missing limitations section", is_warning=True)
    else:
        check("README.md exists", False, "File not found")
    print()
    
    # 4. Source code checks
    print("[check] Source code quality...")
    src_files = []
    src_dir = os.path.join(base, 'src')
    if os.path.isdir(src_dir):
        for root, dirs, files in os.walk(src_dir):
            for fname in files:
                if fname.endswith(('.ts', '.tsx')):
                    src_files.append(os.path.join(root, fname))
    
    check("Has TypeScript source files", len(src_files) >= 4,
          f"Only {len(src_files)} .ts/.tsx files found")
    
    # Check for placeholder text
    placeholder_count = 0
    for fpath in src_files:
        with open(fpath, 'r') as f:
            content = f.read()
        if 'TODO' in content or 'FIXME' in content or 'PLACEHOLDER' in content:
            placeholder_count += 1
    check("No TODO/FIXME/PLACEHOLDER in source", placeholder_count == 0,
          f"{placeholder_count} files contain placeholders", is_warning=True)
    print()
    
    # 5. Data quality
    print("[check] Data quality...")
    interactions_path = os.path.join(base, 'data', 'fixtures', 'interactions.csv')
    if os.path.isfile(interactions_path):
        with open(interactions_path) as f:
            lines = [l for l in f.readlines() if l.strip()]
        check("interactions.csv has ≥20 entries", len(lines) - 1 >= 20,
              f"Only {len(lines) - 1} entries")
    
    red_flags_path = os.path.join(base, 'data', 'fixtures', 'red_flags.csv')
    if os.path.isfile(red_flags_path):
        with open(red_flags_path) as f:
            lines = [l for l in f.readlines() if l.strip()]
        check("red_flags.csv has ≥25 entries", len(lines) - 1 >= 25,
              f"Only {len(lines) - 1} entries")
    print()
    
    # Summary
    total = CHECKS_PASSED + CHECKS_FAILED
    print("=" * 60)
    print(f"  Results: {CHECKS_PASSED}/{total} passed, {CHECKS_FAILED} failed, {WARNINGS} warnings")
    print("=" * 60)
    
    if CHECKS_FAILED == 0:
        print("\n🎉 SUBMISSION READY!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {CHECKS_FAILED} blocking issues. Fix before submission.")
        sys.exit(1)

if __name__ == '__main__':
    main()

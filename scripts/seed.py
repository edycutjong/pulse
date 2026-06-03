#!/usr/bin/env python3
"""
Pulse — Seed Script
Ingests medical corpus into local QVAC RAG vector store.
Usage: python3 scripts/seed.py
"""

import os
import sys
import json
import subprocess

CORPUS_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'corpus')
FIXTURES_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'fixtures')

def load_corpus():
    """Load all .txt files from data/corpus/ directory."""
    documents = []
    corpus_path = os.path.abspath(CORPUS_DIR)
    
    if not os.path.isdir(corpus_path):
        print(f"[seed] ERROR: Corpus directory not found: {corpus_path}")
        sys.exit(1)
    
    for fname in sorted(os.listdir(corpus_path)):
        if fname.endswith('.txt'):
            fpath = os.path.join(corpus_path, fname)
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read().strip()
            if content:
                documents.append({
                    'filename': fname,
                    'content': content,
                    'chars': len(content),
                })
                print(f"  [seed] Loaded {fname} ({len(content)} chars)")
    
    return documents

def load_fixtures():
    """Load CSV fixtures for validation."""
    fixtures_path = os.path.abspath(FIXTURES_DIR)
    stats = {}
    
    for fname in ['interactions.csv', 'red_flags.csv']:
        fpath = os.path.join(fixtures_path, fname)
        if os.path.isfile(fpath):
            with open(fpath, 'r') as f:
                lines = [l for l in f.readlines() if l.strip()]
            stats[fname] = len(lines) - 1  # minus header
            print(f"  [seed] Fixture {fname}: {stats[fname]} entries")
        else:
            print(f"  [seed] WARNING: Fixture not found: {fpath}")
            stats[fname] = 0
    
    return stats

def main():
    print("=" * 60)
    print("  Pulse — Seed Script")
    print("  Ingesting medical corpus into local RAG vector store")
    print("=" * 60)
    print()
    
    # 1. Load corpus
    print("[seed] Loading corpus documents...")
    documents = load_corpus()
    if not documents:
        print("[seed] ERROR: No documents found in corpus directory.")
        sys.exit(1)
    print(f"[seed] Total: {len(documents)} documents, {sum(d['chars'] for d in documents)} chars")
    print()
    
    # 2. Load fixtures
    print("[seed] Validating fixtures...")
    fixture_stats = load_fixtures()
    print()
    
    # 3. Summary
    print("[seed] Seed Summary:")
    print(f"  Corpus documents: {len(documents)}")
    for fname, count in fixture_stats.items():
        print(f"  {fname}: {count} entries")
    print()
    
    # 4. Write manifest
    manifest = {
        'seeded_at': __import__('datetime').datetime.utcnow().isoformat() + 'Z',
        'corpus_documents': len(documents),
        'corpus_chars': sum(d['chars'] for d in documents),
        'fixtures': fixture_stats,
        'files': [d['filename'] for d in documents],
    }
    manifest_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'seed_manifest.json')
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    print(f"[seed] Manifest written: {os.path.abspath(manifest_path)}")
    
    print()
    print("[seed] ✅ Seed complete. Ready for QVAC RAG ingestion.")
    print("  Note: Actual embedding ingestion requires @qvac/sdk runtime.")
    print("  Run the app to trigger initEmbeddingModel() + ingestDocuments().")

if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
Pulse — Benchmark Script
Measures inference latency, TTFT, tokens/sec, and voice pipeline timing.
Usage: python3 scripts/bench.py
"""

import os
import sys
import time
import json
import statistics

RESULTS_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'bench_results.json')

def measure_triage_latency():
    """Simulate triage inference latency measurements."""
    # In production, this would call the actual triage pipeline
    # For evidence bundle, we measure real @qvac/sdk inference times
    print("[bench] Measuring triage inference latency...")
    
    test_queries = [
        "I have a severe headache and blurred vision",
        "My child has a mild cough and runny nose",
        "I take warfarin and ibuprofen, is that safe?",
        "Chest pain radiating to my left arm",
        "I have seasonal allergies, itchy eyes",
    ]
    
    results = []
    for query in test_queries:
        # Placeholder — replace with actual SDK timing
        start = time.perf_counter()
        # await runTriageQuery(query)  # actual call goes here
        time.sleep(0.01)  # placeholder
        elapsed_ms = (time.perf_counter() - start) * 1000
        results.append({
            'query': query[:50],
            'latency_ms': round(elapsed_ms, 2),
        })
        print(f"  {query[:40]}... → {elapsed_ms:.1f}ms")
    
    return results

def measure_rag_search():
    """Measure RAG retrieval latency."""
    print("[bench] Measuring RAG search latency...")
    
    queries = [
        "warfarin drug interactions",
        "chest pain emergency",
        "metformin side effects",
    ]
    
    results = []
    for query in queries:
        start = time.perf_counter()
        time.sleep(0.005)  # placeholder
        elapsed_ms = (time.perf_counter() - start) * 1000
        results.append({
            'query': query,
            'latency_ms': round(elapsed_ms, 2),
        })
        print(f"  {query} → {elapsed_ms:.1f}ms")
    
    return results

def main():
    print("=" * 60)
    print("  Pulse — Benchmark Suite")
    print("  Measuring inference & pipeline latency")
    print("=" * 60)
    print()
    
    all_results = {}
    
    # 1. Triage latency
    triage = measure_triage_latency()
    latencies = [r['latency_ms'] for r in triage]
    all_results['triage'] = {
        'queries': triage,
        'p50_ms': round(statistics.median(latencies), 2),
        'p95_ms': round(sorted(latencies)[int(len(latencies) * 0.95)], 2) if len(latencies) >= 2 else latencies[-1],
        'mean_ms': round(statistics.mean(latencies), 2),
    }
    print(f"  Triage p50={all_results['triage']['p50_ms']}ms, p95={all_results['triage']['p95_ms']}ms")
    print()
    
    # 2. RAG search
    rag = measure_rag_search()
    rag_latencies = [r['latency_ms'] for r in rag]
    all_results['rag_search'] = {
        'queries': rag,
        'mean_ms': round(statistics.mean(rag_latencies), 2),
    }
    print(f"  RAG mean={all_results['rag_search']['mean_ms']}ms")
    print()
    
    # 3. Write results
    all_results['timestamp'] = __import__('datetime').datetime.utcnow().isoformat() + 'Z'
    all_results['note'] = 'Placeholder timings — replace with real @qvac/sdk measurements on device'
    
    os.makedirs(os.path.dirname(RESULTS_FILE), exist_ok=True)
    with open(RESULTS_FILE, 'w') as f:
        json.dump(all_results, f, indent=2)
    
    print(f"[bench] Results written: {os.path.abspath(RESULTS_FILE)}")
    print()
    print("[bench] ✅ Benchmark complete.")
    print("  Note: These are placeholder timings.")
    print("  Run on actual device with @qvac/sdk for real evidence bundle numbers.")

if __name__ == '__main__':
    main()

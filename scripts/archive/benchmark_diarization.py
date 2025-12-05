#!/usr/bin/env python3
"""
Benchmark script to compare CPU vs GPU diarization performance.

Usage:
    python3 scripts/benchmark_diarization.py <audio_file_path>

This script runs diarization twice:
1. CPU-only mode
2. GPU mode (Metal/CUDA if available)

And reports the time difference and speedup factor.
"""

import sys
import time
import os
from pathlib import Path

# Add parent directory to path to import diarize_audio module
sys.path.insert(0, str(Path(__file__).parent))

from diarize_audio import diarize_audio, get_device
import torch


def benchmark_diarization(audio_path: str, hf_token: str):
    """
    Benchmark diarization with CPU vs GPU.

    Args:
        audio_path: Path to audio file
        hf_token: Hugging Face token
    """
    print("=" * 60)
    print("DIARIZATION PERFORMANCE BENCHMARK")
    print("=" * 60)
    print(f"Audio file: {audio_path}")

    # Get audio duration
    try:
        import subprocess
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'default=noprint_wrappers=1:nokey=1', audio_path],
            capture_output=True,
            text=True
        )
        duration = float(result.stdout.strip())
        print(f"Audio duration: {duration:.2f} seconds ({duration/60:.2f} minutes)")
    except:
        print("Audio duration: Unknown (ffprobe not available)")
        duration = None

    print("=" * 60)

    # Check available devices
    devices_available = []
    if torch.backends.mps.is_available():
        devices_available.append("Metal GPU (MPS)")
    if torch.cuda.is_available():
        devices_available.append(f"CUDA GPU ({torch.cuda.get_device_name(0)})")
    devices_available.append("CPU")

    print(f"Available devices: {', '.join(devices_available)}")
    print("=" * 60)

    results = {}

    # Test 1: CPU-only
    print("\n[TEST 1] CPU-only diarization")
    print("-" * 60)
    start_time = time.time()
    try:
        result_cpu = diarize_audio(audio_path, hf_token, use_gpu=False)
        cpu_time = time.time() - start_time
        results['cpu'] = {
            'time': cpu_time,
            'segments': len(result_cpu['segments']),
            'success': True
        }
        print(f"✅ CPU Time: {cpu_time:.2f} seconds")
        print(f"   Segments found: {results['cpu']['segments']}")
        if duration:
            print(f"   Processing ratio: {cpu_time/duration:.2f}x realtime")
    except Exception as e:
        print(f"❌ CPU test failed: {e}")
        results['cpu'] = {'success': False, 'error': str(e)}

    # Test 2: GPU (if available)
    print("\n[TEST 2] GPU diarization")
    print("-" * 60)

    device = get_device(use_gpu=True)
    if device.type == "cpu":
        print("⚠️  No GPU available, skipping GPU test")
        results['gpu'] = {'success': False, 'reason': 'No GPU available'}
    else:
        device_name = "Metal GPU" if device.type == "mps" else f"CUDA GPU"
        print(f"Using device: {device_name}")

        start_time = time.time()
        try:
            result_gpu = diarize_audio(audio_path, hf_token, use_gpu=True)
            gpu_time = time.time() - start_time
            results['gpu'] = {
                'time': gpu_time,
                'segments': len(result_gpu['segments']),
                'success': True,
                'device': device_name
            }
            print(f"✅ GPU Time: {gpu_time:.2f} seconds")
            print(f"   Segments found: {results['gpu']['segments']}")
            if duration:
                print(f"   Processing ratio: {gpu_time/duration:.2f}x realtime")
        except Exception as e:
            print(f"❌ GPU test failed: {e}")
            results['gpu'] = {'success': False, 'error': str(e)}

    # Summary
    print("\n" + "=" * 60)
    print("BENCHMARK RESULTS")
    print("=" * 60)

    if results['cpu']['success'] and results.get('gpu', {}).get('success'):
        cpu_time = results['cpu']['time']
        gpu_time = results['gpu']['time']
        speedup = cpu_time / gpu_time
        time_saved = cpu_time - gpu_time

        print(f"CPU Time:     {cpu_time:.2f}s")
        print(f"GPU Time:     {gpu_time:.2f}s ({results['gpu']['device']})")
        print(f"Time Saved:   {time_saved:.2f}s ({time_saved/60:.2f} minutes)")
        print(f"Speedup:      {speedup:.2f}x faster")
        print()

        if duration:
            print(f"Audio Duration:     {duration:.2f}s ({duration/60:.2f} min)")
            print(f"CPU Ratio:          {cpu_time/duration:.2f}x realtime")
            print(f"GPU Ratio:          {gpu_time/duration:.2f}x realtime")
            print()

        # Interpretation
        print("Interpretation:")
        if speedup >= 5:
            print(f"  🚀 Excellent! GPU is {speedup:.1f}x faster than CPU")
        elif speedup >= 3:
            print(f"  ✅ Good speedup! GPU is {speedup:.1f}x faster than CPU")
        elif speedup >= 1.5:
            print(f"  👍 Moderate speedup. GPU is {speedup:.1f}x faster than CPU")
        else:
            print(f"  ⚠️  Minimal speedup ({speedup:.1f}x). GPU overhead may be dominating.")

        print()

        # Practical impact
        if duration and duration >= 300:  # 5+ minutes
            projected_savings = (cpu_time - gpu_time) * 1  # Per recording
            print(f"Practical Impact (for {duration/60:.1f}-minute recording):")
            print(f"  - Save {time_saved:.0f} seconds per recording")
            print(f"  - For 20 meetings/month: Save {(time_saved * 20)/60:.1f} minutes")

    elif results['cpu']['success']:
        print(f"CPU Time: {results['cpu']['time']:.2f}s")
        print("GPU: Not tested (not available or failed)")
    else:
        print("❌ Benchmark failed - check errors above")

    print("=" * 60)


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Error: Missing audio file path", file=sys.stderr)
        print(f"Usage: {sys.argv[0]} <audio_file_path>", file=sys.stderr)
        print("\nExample:", file=sys.stderr)
        print(f"  {sys.argv[0]} ~/path/to/recording.wav", file=sys.stderr)
        sys.exit(1)

    audio_path = sys.argv[1]

    # Check if audio file exists
    if not os.path.exists(audio_path):
        print(f"Error: Audio file not found: {audio_path}", file=sys.stderr)
        sys.exit(1)

    # Get HF token from environment
    hf_token = os.environ.get("HUGGINGFACE_TOKEN")
    if not hf_token:
        print("Error: HUGGINGFACE_TOKEN environment variable not set", file=sys.stderr)
        print("Set it with: export HUGGINGFACE_TOKEN=hf_xxx", file=sys.stderr)
        sys.exit(1)

    try:
        benchmark_diarization(audio_path, hf_token)
    except KeyboardInterrupt:
        print("\n\nBenchmark interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nError during benchmark: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Speaker diarization script using pyannote.audio.

This script takes an audio file and outputs speaker segments with timestamps in JSON format.
It uses the pyannote-speaker-diarization-3.1 model which requires a Hugging Face token.

Usage:
    python3 scripts/diarize_audio.py <audio_file_path> [--token <hf_token>]

Output format:
    {
        "segments": [
            {"start": 0.5, "end": 3.2, "speaker": "SPEAKER_00"},
            {"start": 3.5, "end": 7.1, "speaker": "SPEAKER_01"},
            ...
        ]
    }
"""

import sys
import json
import os
from typing import List, Dict
from pyannote.audio import Pipeline


def diarize_audio(audio_path: str, hf_token: str) -> Dict[str, List[Dict]]:
    """
    Run speaker diarization on an audio file.

    Args:
        audio_path: Path to the audio file (WAV format recommended)
        hf_token: Hugging Face authentication token

    Returns:
        Dictionary with 'segments' key containing list of speaker segments
    """
    # Load the diarization pipeline
    print("[PROGRESS] Loading pyannote.audio models...", file=sys.stderr, flush=True)
    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        token=hf_token
    )

    # Run diarization
    print("[PROGRESS] Analyzing audio for speaker changes...", file=sys.stderr, flush=True)
    output = pipeline(audio_path)

    print("[PROGRESS] Generating speaker segments...", file=sys.stderr, flush=True)

    # In pyannote.audio 4.x, the output is a DiarizeOutput object
    # Use speaker_diarization (or exclusive_speaker_diarization for better timestamp reconciliation)
    diarization = output.speaker_diarization

    # Convert to JSON-serializable format
    segments = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        segments.append({
            "start": float(turn.start),
            "end": float(turn.end),
            "speaker": speaker
        })

    return {"segments": segments}


def main():
    """Main entry point for the script."""
    if len(sys.argv) < 2:
        print("Error: Missing audio file path", file=sys.stderr)
        print(f"Usage: {sys.argv[0]} <audio_file_path> [--token <hf_token>]", file=sys.stderr)
        sys.exit(1)

    audio_path = sys.argv[1]

    # Check if audio file exists
    if not os.path.exists(audio_path):
        print(f"Error: Audio file not found: {audio_path}", file=sys.stderr)
        sys.exit(1)

    # Get HF token from arguments or environment
    hf_token = None
    if "--token" in sys.argv:
        token_index = sys.argv.index("--token") + 1
        if token_index < len(sys.argv):
            hf_token = sys.argv[token_index]

    if not hf_token:
        hf_token = os.environ.get("HUGGINGFACE_TOKEN")

    if not hf_token:
        print("Error: Hugging Face token not provided", file=sys.stderr)
        print("Either set HUGGINGFACE_TOKEN environment variable or use --token flag", file=sys.stderr)
        sys.exit(1)

    try:
        # Run diarization
        result = diarize_audio(audio_path, hf_token)

        # Output JSON to stdout
        print(json.dumps(result, indent=2))

    except Exception as e:
        print(f"Error during diarization: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

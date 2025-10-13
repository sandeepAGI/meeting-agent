#!/bin/bash

# Download Whisper model for transcription
# Models available: tiny, base, small, medium, large
# Recommendation: base (good balance of speed/accuracy, ~142MB)

MODEL_NAME="${1:-base}"
MODELS_DIR="./models"

echo "Downloading Whisper model: $MODEL_NAME"
echo "This may take a few minutes depending on your internet connection..."

# Create models directory if it doesn't exist
mkdir -p "$MODELS_DIR"

# Download model from Hugging Face (official whisper.cpp models)
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${MODEL_NAME}.bin"
MODEL_FILE="$MODELS_DIR/ggml-${MODEL_NAME}.bin"

# Check if model already exists
if [ -f "$MODEL_FILE" ]; then
  echo "Model already exists: $MODEL_FILE"
  echo "Skipping download. Delete the file to re-download."
  exit 0
fi

# Download using curl
echo "Downloading from: $MODEL_URL"
curl -L -o "$MODEL_FILE" "$MODEL_URL"

if [ $? -eq 0 ]; then
  echo "✅ Model downloaded successfully: $MODEL_FILE"
  echo "File size: $(du -h "$MODEL_FILE" | cut -f1)"
else
  echo "❌ Failed to download model"
  exit 1
fi

echo ""
echo "Available models:"
echo "  tiny   - Fastest, least accurate (~75MB)"
echo "  base   - Good balance (default, ~142MB) ✅"
echo "  small  - Better accuracy (~466MB)"
echo "  medium - High accuracy (~1.5GB)"
echo "  large  - Best accuracy (~2.9GB)"
echo ""
echo "To download a different model: npm run download-model -- small"

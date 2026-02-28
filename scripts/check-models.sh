#!/bin/bash

echo "🔍 Checking for STT Model Files..."
echo ""

MODELS_DIR="android/app/src/main/assets/models"

# Check if directory exists
if [ ! -d "$MODELS_DIR" ]; then
    echo "❌ Models directory does not exist: $MODELS_DIR"
    echo ""
    echo "Creating directory..."
    mkdir -p "$MODELS_DIR"
    echo "✅ Directory created: $MODELS_DIR"
    echo ""
    echo "📥 Next steps:"
    echo "   1. Download a Whisper model (whisper-tiny recommended)"
    echo "   2. Place it in: $MODELS_DIR"
    echo "   3. Update the model name in src/services/SpeechService.ts if needed"
    echo "   4. Run: npm run rebuild-android"
    exit 1
fi

echo "✅ Models directory exists: $MODELS_DIR"
echo ""

# Check for model files
MODEL_FILES=$(find "$MODELS_DIR" -type f \( -name "*.gguf" -o -name "*.onnx" -o -name "*whisper*" \) 2>/dev/null)

if [ -z "$MODEL_FILES" ]; then
    echo "❌ No model files found in $MODELS_DIR"
    echo ""
    echo "📥 Next steps:"
    echo "   1. Download a Whisper model"
    echo "   2. Place it in: $MODELS_DIR"
    echo "   3. See MODEL_SETUP.md for detailed instructions"
    exit 1
fi

echo "✅ Found model files:"
echo ""
echo "$MODEL_FILES" | while read file; do
    size=$(du -h "$file" | cut -f1)
    echo "   📦 $(basename "$file") - $size"
done

echo ""
echo "🎉 Model setup looks good!"
echo ""
echo "📝 Notes:"
echo "   - Model will load on app startup"
echo "   - Check logs for: [SpeechService] STT model loaded"
echo "   - If issues persist, try Debug Mode in Settings"

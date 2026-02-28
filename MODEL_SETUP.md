# STT Model Setup Guide

## Overview

This app uses RunAnywhere SDK with Sherpa-ONNX Whisper for speech-to-text transcription.

## Automatic Model Download

**The app will automatically download the STT model on first use!**

- Model: `sherpa-onnx-whisper-base.en`
- Size: ~150MB
- Download happens automatically when you first start a live session
- Model is cached locally after download

## What Happens on First Launch

1. App initializes RunAnywhere SDK
2. Registers default models (including STT)
3. When you start a live session:
   - Checks if STT model is downloaded
   - If not: Downloads it automatically with progress
   - Loads model into memory
   - Starts transcription

## Manual Model Management

You can also pre-download models using the ModelService:

```typescript
import { useModelService } from './services/ModelService';

const { downloadAndLoadSTT, isSTTLoaded } = useModelService();

// Download and load STT model
await downloadAndLoadSTT();
```

## Model Information

### Sherpa-ONNX Whisper Base

- **Model ID**: `sherpa-onnx-whisper-base.en`
- **Size**: ~150MB
- **Format**: ONNX (tar.gz archive)
- **Language**: English only
- **Speed**: Very fast
- **Accuracy**: Good for most use cases
- **Source**: https://github.com/RunanywhereAI/sherpa-onnx

## Troubleshooting

### Error: "Failed to load STT model"

**Possible causes:**

1. No internet connection (model needs to download)
2. Insufficient storage space
3. Download was interrupted

**Solutions:**

1. Check your internet connection
2. Ensure you have at least 200MB free space
3. Restart the app to retry download
4. Enable Debug Mode to test without the model (see below)

### Error: "Model download failed"

**Solution:**

1. Check internet connection
2. Try again later (GitHub releases might be temporarily down)
3. Use Debug Mode to test the app without audio

### Download taking too long?

The model is ~150MB. Download time depends on your connection:

- WiFi: 30 seconds - 2 minutes
- 4G: 1-3 minutes
- 3G: 3-5 minutes

You'll see download progress in the logs:

```
[SpeechService] 📥 Download progress: 10%
[SpeechService] 📥 Download progress: 20%
...
[SpeechService] ✅ Model downloaded
```

## Debug Mode (No Model Required)

For testing without a model or internet:

1. Go to **Settings**
2. Scroll to "**Debug & Testing**"
3. Toggle "**Debug Mode**" ON
4. Start a new session

Debug mode injects hardcoded test transcripts every 7 seconds to test the pattern detection pipeline without needing real audio or the STT model.

## Architecture

### Model Loading Flow

```
App Launch
    ↓
App.tsx: Initialize SDK & Register backends
    ↓
App.tsx: Call registerDefaultModels()
    ├─ Registers LLM model
    ├─ Registers STT model (sherpa-onnx-whisper-base.en)
    └─ Registers TTS model
    ↓
App.tsx: Call loadSTTModel()
    ├─ Checks if model downloaded
    ├─ Downloads if needed (with progress)
    └─ Loads model using RunAnywhere.loadSTTModel()
    ↓
User starts live session
    ↓
LiveSessionScreen checks model status
    ├─ If loaded: Start immediately
    ├─ If loading: Wait for it
    └─ If failed: Offer debug mode
    ↓
Audio captured
    ↓
RunAnywhere.transcribe(audioPath)
    ↓
Transcript returned
```

### Key Files

- `src/services/SpeechService.ts` - STT model loading & transcription
- `src/services/ModelService.tsx` - Model registry & download management
- `src/App.tsx` - App initialization & model preloading
- `src/screens/LiveSessionScreen.tsx` - Model status checks & error handling

## Logs to Check

**Successful model load:**

```
[App] 🚀 Starting initialization...
[App] 🔧 Initializing RunAnywhere SDK...
[App] ✅ RunAnywhere SDK initialized
[App] 📦 Registering backends...
[App] ✅ Backends registered
[App] 🤖 Registering default models...
[App] ✅ Default models registered
[App] 🎤 Loading STT model...
[SpeechService] 🎯 loadSTTModel() called
[SpeechService] 🤖 Starting STT model load...
[SpeechService] 🔍 Checking if model is downloaded...
[SpeechService] ✅ Model already downloaded
[SpeechService] 🔄 Loading STT model from: /data/.../sherpa-onnx-whisper-base.en
[SpeechService] ✅ STT model loaded successfully in XXXms
[App] ✅ STT model ready
```

**First-time download:**

```
[SpeechService] 📥 Model not downloaded, downloading...
[SpeechService] 📥 Download progress: 10%
[SpeechService] 📥 Download progress: 20%
...
[SpeechService] 📥 Download progress: 100%
[SpeechService] ✅ Model downloaded
[SpeechService] 🔄 Loading STT model from: /data/.../sherpa-onnx-whisper-tiny.en
[SpeechService] ✅ STT model loaded successfully
```

## Viewing Logs

### Android

```bash
adb logcat | grep -E "\[App\]|\[SpeechService\]"
```

### React Native Debugger

Open the app and check the console for emoji-tagged logs.

## Privacy & Offline Usage

- ✅ Model downloads once and is cached locally
- ✅ All transcription happens on-device
- ✅ No external API calls during transcription
- ✅ After first download, works in **airplane mode**
- ✅ No audio data ever leaves your device

## Alternative Models

You can modify `ModelService.tsx` to use different models:

```typescript
// In registerDefaultModels()
await ONNX.addModel({
  id: 'sherpa-onnx-whisper-base.en', // Larger, more accurate
  name: 'Sherpa Whisper Base (ONNX)',
  url: 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/...',
  modality: ModelCategory.SpeechRecognition,
  artifactType: ModelArtifactType.TarGzArchive,
  memoryRequirement: 150_000_000,
});
```

Then update `SpeechService.ts`:

```typescript
const STT_MODEL_ID = 'sherpa-onnx-whisper-base.en';
```

## Support

If issues persist:

1. Enable Debug Mode to verify the rest of the app works
2. Check RunAnywhere SDK docs: https://docs.runanywhere.ai
3. Verify @runanywhere packages in package.json:
   - @runanywhere/core: ^0.18.1
   - @runanywhere/llamacpp: ^0.18.1
   - @runanywhere/onnx: ^0.18.1
4. Check logs for specific error messages
5. Try uninstalling and reinstalling the app

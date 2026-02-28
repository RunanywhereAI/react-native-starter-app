# Multi-Language STT/TTS Feature

This document describes the multi-language Speech-to-Text (STT) and Text-to-Speech (TTS) feature added to the RunAnywhere React Native Starter App.

## Overview

The app now supports multiple languages for both speech recognition and voice synthesis, allowing users to:

- Select their preferred language for speech-to-text transcription
- Choose from available TTS voices in different languages
- Switch languages dynamically without reloading the app

## Features Implemented

### 1. Language Configuration System (`src/config/languages.ts`)

A centralized configuration file that defines:

- **Supported languages**: English, Spanish, French, German, Chinese, Japanese
- **Language metadata**: Name, native name, flag emoji, language code
- **Model mappings**: STT and TTS model IDs for each language
- **Helper functions**: `getLanguageByCode()`, `hasSTTSupport()`, `hasTTSSupport()`

```typescript
export interface LanguageConfig {
  code: string; // ISO language code (e.g., 'en', 'es')
  name: string; // English name
  nativeName: string; // Native language name
  flag: string; // Flag emoji
  sttModelId?: string; // STT model identifier
  ttsModelId?: string; // TTS model identifier
  sttModelUrl?: string; // Model download URL
  ttsModelUrl?: string; // Model download URL
}
```

### 2. LanguageSelector Component (`src/components/LanguageSelector.tsx`)

A beautiful modal component for language selection featuring:

- **Filterable list**: Can filter by STT/TTS support
- **Visual indicators**: Shows which languages support STT and TTS
- **Clean UI**: Modal with gradient header and smooth animations
- **Accessibility**: Touch-friendly, large tap targets

**Usage:**

```tsx
<LanguageSelector
  visible={showLanguageSelector}
  selectedLanguage={selectedLanguage.code}
  onSelect={setSelectedLanguage}
  onClose={() => setShowLanguageSelector(false)}
  filterSTT={true} // Only show languages with STT support
/>
```

### 3. VoiceSelector Component (`src/components/VoiceSelector.tsx`)

A modal for selecting TTS voices with:

- **Voice metadata display**: Name, language, quality, gender
- **Type indicators**: Neural vs System voices
- **Download status**: Shows if voice requires download
- **Language filtering**: Can filter voices by language code
- **Fallback handling**: Shows mock voices if SDK API unavailable

**Usage:**

```tsx
<VoiceSelector
  visible={showVoiceSelector}
  selectedVoiceId={selectedVoice?.id}
  onSelect={setSelectedVoice}
  onClose={() => setShowVoiceSelector(false)}
  languageFilter={selectedLanguage.code}
/>
```

### 4. Enhanced SpeechToTextScreen

**New features:**

- Language selection button at the top
- Displays selected language with flag emoji
- Passes language code to `RunAnywhere.transcribe()` API
- Filters language selector to only show languages with STT support

**Code changes:**

```typescript
// Language selector UI
<TouchableOpacity
  style={styles.languageButton}
  onPress={() => setShowLanguageSelector(true)}
>
  <Text style={styles.languageFlag}>{selectedLanguage.flag}</Text>
  <View style={styles.languageInfo}>
    <Text style={styles.languageLabel}>Language</Text>
    <Text style={styles.languageName}>{selectedLanguage.name}</Text>
  </View>
</TouchableOpacity>

// Transcribe with selected language
const result = await RunAnywhere.transcribe(audioBase64, {
  sampleRate: 16000,
  language: selectedLanguage.code,
});
```

### 5. Enhanced TextToSpeechScreen

**New features:**

- Dual selection buttons: Language and Voice
- Language selection changes available voices
- Voice selection filtered by selected language
- Selected voice ID passed to synthesis API

**Code changes:**

```typescript
// Language & Voice selectors
<View style={styles.selectionRow}>
  <TouchableOpacity onPress={() => setShowLanguageSelector(true)}>
    {/* Language button */}
  </TouchableOpacity>
  <TouchableOpacity onPress={() => setShowVoiceSelector(true)}>
    {/* Voice button */}
  </TouchableOpacity>
</View>

// Synthesize with selected voice
const result = await RunAnywhere.synthesize(text, {
  voice: selectedVoice?.id || 'default',
  rate: speechRate,
  pitch: 1.0,
  volume: 1.0,
});
```

## Supported Languages

| Language     | Code | STT Support     | TTS Support     |
| ------------ | ---- | --------------- | --------------- |
| English (US) | `en` | ✅ Yes          | ✅ Yes          |
| Spanish      | `es` | ⚠️ Model needed | ⚠️ Model needed |
| French       | `fr` | ⚠️ Model needed | ⚠️ Model needed |
| German       | `de` | ⚠️ Model needed | ⚠️ Model needed |
| Chinese      | `zh` | ⚠️ Model needed | ❌ No           |
| Japanese     | `ja` | ⚠️ Model needed | ❌ No           |

**Note:** Currently only English models are downloaded by default. To add support for other languages, you need to:

1. Download the appropriate STT/TTS models for that language
2. Register them in `ModelService.tsx`
3. Update the model URLs in `src/config/languages.ts`

## How It Works

### Language Selection Flow

1. User taps language button
2. `LanguageSelector` modal opens
3. User selects a language
4. Selected language is saved to component state
5. Language code is passed to STT/TTS APIs
6. For TTS: Available voices are filtered by language

### Model Management

The app uses RunAnywhere SDK's model management system:

```typescript
// Per RunAnywhere docs: https://docs.runanywhere.ai/react-native/stt/options

// STT with language option
await RunAnywhere.transcribe(audioData, {
  language: 'es', // Spanish
  sampleRate: 16000,
});

// TTS with voice option
await RunAnywhere.synthesize(text, {
  voice: 'en_US-lessac-medium', // English voice
  rate: 1.0,
});
```

## Adding New Languages

To add support for a new language:

### 1. Add language to configuration

Edit `src/config/languages.ts`:

```typescript
{
  code: 'it',
  name: 'Italian',
  nativeName: 'Italiano',
  flag: '🇮🇹',
  sttModelId: 'sherpa-onnx-whisper-tiny-it',
  ttsModelId: 'vits-piper-it_IT-medium',
  sttModelUrl: 'https://github.com/.../whisper-tiny-it.tar.gz',
  ttsModelUrl: 'https://github.com/.../piper-it-IT.tar.gz',
}
```

### 2. Register models in ModelService

Edit `src/services/ModelService.tsx`:

```typescript
// Add model registration
await ONNX.addModel({
  id: 'sherpa-onnx-whisper-tiny-it',
  name: 'Sherpa Whisper Tiny (Italian)',
  url: 'https://github.com/.../whisper-tiny-it.tar.gz',
  modality: ModelCategory.SpeechRecognition,
  artifactType: ModelArtifactType.TarGzArchive,
  memoryRequirement: 75_000_000,
});
```

### 3. Download and load the models

Models can be downloaded:

- **Automatically**: When user first accesses STT/TTS screens
- **Manually**: Via model management in your app settings
- **Programmatically**: Using `RunAnywhere.downloadModel()`

## Architecture

```
src/
├── config/
│   ├── languages.ts          # Language definitions & helpers
│   └── index.ts             # Config exports
├── components/
│   ├── LanguageSelector.tsx  # Language picker modal
│   ├── VoiceSelector.tsx     # Voice picker modal
│   └── index.ts             # Component exports
└── screens/
    ├── SpeechToTextScreen.tsx   # STT with language selection
    └── TextToSpeechScreen.tsx   # TTS with voice selection
```

## Performance Considerations

- **Model size**: Each language model is 50-100MB
- **Memory usage**: Only one model loaded at a time
- **Switching languages**: Requires model unload/reload
- **Download time**: 30-60 seconds per model on average connection

## Future Enhancements

Potential improvements for the multi-language feature:

1. **Model pre-loading**: Download popular language models during onboarding
2. **Language detection**: Auto-detect spoken language in STT
3. **Voice preview**: Let users hear voice samples before selection
4. **Model caching**: Keep recently used models in memory
5. **Compression**: Use smaller quantized models for faster downloads
6. **Language packs**: Bundle STT+TTS models together
7. **Offline indicator**: Show which languages work offline
8. **Translation**: Add real-time translation between languages

## API Reference

### LanguageConfig

```typescript
interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  sttModelId?: string;
  ttsModelId?: string;
  sttModelUrl?: string;
  ttsModelUrl?: string;
}
```

### TTSVoiceInfo

```typescript
interface TTSVoiceInfo {
  id: string;
  name: string;
  language: string;
  type: 'neural' | 'system';
  quality: 'low' | 'medium' | 'high';
  gender?: 'male' | 'female' | 'neutral';
  requiresDownload: boolean;
  isAvailable: boolean;
}
```

## Testing

To test the multi-language feature:

1. **Language Selection**:
   - Open STT or TTS screen
   - Tap language selector button
   - Verify languages show with correct flags and names
   - Select a language and verify it's displayed

2. **Voice Selection** (TTS screen):
   - Select a language first
   - Tap voice selector button
   - Verify only voices for selected language are shown
   - Select a voice and verify synthesis uses it

3. **Speech Recognition**:
   - Select a non-English language
   - Record audio in that language
   - Verify transcription accuracy

4. **Voice Synthesis**:
   - Select a non-English voice
   - Enter text in that language
   - Verify audio is generated in correct language/voice

## Troubleshooting

### "No voices available for language"

- The selected language may not have TTS models downloaded
- Check model availability in `src/config/languages.ts`
- Download required TTS model for that language

### STT not recognizing speech

- Ensure correct language is selected
- Verify STT model for that language is downloaded and loaded
- Check microphone permissions

### Wrong voice used for synthesis

- Verify voice is selected before synthesis
- Check that selected voice matches language
- Fallback to 'default' voice if none selected

## Resources

- [RunAnywhere STT Options Docs](https://docs.runanywhere.ai/react-native/stt/options)
- [RunAnywhere TTS Voices Docs](https://docs.runanywhere.ai/react-native/tts/voices)
- [Whisper Model Languages](https://github.com/openai/whisper#available-models-and-languages)
- [Piper TTS Voices](https://github.com/rhasspy/piper/blob/master/VOICES.md)

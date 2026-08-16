# RunAnywhere React Native starter app

A React Native app that exercises the RunAnywhere on-device AI SDK: chat, vision, tool
calling, speech to text, text to speech, and a voice agent. Inference runs locally through
the SDK's C++ core, so apart from downloading model files there is no server involved.

The app pins every `@runanywhere/*` package to 0.20.19.

## What it demonstrates

Six feature screens, each one wired to a single SDK entry point.

| Screen | What it does | SDK call |
|--------|--------------|----------|
| Chat | Streams a completion token by token, reports tokens/second, cancels mid-stream | `RunAnywhere.llm.generateStream` |
| Vision | Describes an image picked from samples, a URL, or a local file path | `RunAnywhere.vlm.generateStream` |
| Tool calling | Runs a prompt against three demo tools (weather, clock, calculator) and logs every call and result | `generateWithTools`, `RunAnywhere.llm.tools.register` |
| Speech to text | Records 16 kHz mono WAV and transcribes it | `RunAnywhere.stt.transcribe` |
| Text to speech | Synthesizes and plays text at an adjustable speech rate | `RunAnywhere.tts.speak` |
| Voice pipeline | Listen, think, speak loop driven by the session event stream | `RunAnywhere.voice.createSession` |

The home screen is navigation plus a summary of the configured models.

Two things do reach the network at runtime: the weather tool calls wttr.in, and the vision
screen downloads an image if you give it a URL. Everything else works with the network off
once the models are on disk.

## Requirements

- Node 18 or newer.
- Yarn 3.6.1. `packageManager` is set in `package.json`, so Corepack picks the right version.
  `yarn.lock` is the lockfile of record; running `npm install` rewrites it into the
  incompatible Yarn Classic format.
- iOS: macOS, a recent Xcode, CocoaPods. The deployment target is 17.5.
- Android: Android Studio, JDK 17, compile and target SDK 36, build tools 36.0.0,
  NDK 28.0.13004108. Minimum supported device is API 24.
- A physical device. Models are slow on simulators, and the MLX and Hexagon NPU backends
  only exist on real hardware.

## Setup

```bash
git clone https://github.com/RunanywhereAI/react-native-starter-app.git
cd react-native-starter-app
yarn install
```

Pods are not installed automatically (see platform notes), so install them yourself:

```bash
cd ios && pod install && cd ..
```

Then start Metro in one terminal:

```bash
yarn start
```

and build in another:

```bash
yarn ios
# or
yarn android
```

The first Android build compiles native code and takes several minutes. Later builds are
much faster.

On a physical Android device, Metro is reached over USB:

```bash
adb reverse tcp:8081 tcp:8081
```

Run that again after every replug, or the app reports "Could not connect to development
server".

Type checking is the verification gate:

```bash
yarn typecheck
yarn lint
```

## Project layout

```
src/
  App.tsx                       SDK init, backend registration, navigation stack
  screens/                      one file per feature screen, plus HomeScreen
  services/
    ModelService.tsx            model catalog, download and load state, React context
    VLMService.ts               vision model wrapper used by VisionScreen
  components/                   FeatureCard, ModelLoaderWidget, ChatMessageBubble, AudioVisualizer
  utils/
    chatSampleTools.ts          the three demo tool definitions and their executors
    mathParser.ts               expression evaluator behind the calculator tool
  theme/colors.ts               dark palette (AppColors)
  navigation/types.ts           stack param list
  react-native-screens-mock.js  iOS shim, see platform notes

ios/RunAnywhereStarter/NativeAudioModule.{swift,m}
android/app/src/main/java/ai/runanywhere/starter/NativeAudioModule.kt
                                WAV recorder used by the speech to text screen
```

## How the SDK is wired up

`App.tsx` initializes the SDK once, then registers backends:

```ts
await RunAnywhere.initialize({
  environment: SDKEnvironment.SDK_ENVIRONMENT_DEVELOPMENT,
});

const { LlamaCPP } = await import('@runanywhere/llamacpp');
const { ONNX } = await import('@runanywhere/onnx');
LlamaCPP.register();
ONNX.register();
```

MLX (Apple, physical iOS devices only) and QHexRT (Qualcomm Hexagon NPU) are registered the
same way but tolerate failure: `register()` resolves to `false` where the backend cannot
run, so the calls are safe on every platform.

`registerDefaultModels()` in `src/services/ModelService.tsx` then puts the catalog entries
into the SDK registry. Registration records metadata only. Downloading and loading happen
when a screen asks for a model, through `RunAnywhere.models.download` and
`RunAnywhere.models.load`.

### Streaming: manual iteration, not `for await`

Hermes does not support `for await...of` over the SDK's NitroModules async iterables. Every
stream in this app is drained with an explicit iterator loop instead:

```ts
const iterator = RunAnywhere.llm
  .generateStream(text, { maxOutputTokens: 256, temperature: 0.8 })
  [Symbol.asyncIterator]();

for (;;) {
  const step = await iterator.next();
  if (step.done) break;
  const event = step.value;
  if (event.type === 'token') {
    // append event.text
  }
}
```

Calling `iterator.return()` cancels the native generation. That is what the stop buttons do
in the chat and vision screens.

## Models

`registerDefaultModels()` registers the entries below. The size column is the declared
memory requirement, not the exact download size.

| Id | Kind | Backend | Size |
|----|------|---------|------|
| `lfm2-350m-q8_0` | LLM, the default | llama.cpp | 400 MB |
| `smollm2-360m-q8_0` | LLM, alternative | llama.cpp | 500 MB |
| `smolvlm-500m-instruct-q8_0` | VLM, the default | llama.cpp | 600 MB |
| `lfm2.5-vl-3b-q4_k_m` | VLM | llama.cpp | 2.3 GB |
| `mlx-lfm2.5-vl-3b-4bit` | VLM, registered on iOS only | MLX | 2.6 GB |
| `sherpa-onnx-whisper-tiny.en` | STT | Sherpa | 75 MB |
| `vits-piper-en_US-lessac-medium` | TTS | Sherpa | 65 MB |
| `silero-vad` | VAD, used by the voice pipeline | ONNX | 2 MB |

`MODEL_IDS` at the top of `ModelService.tsx` decides which of these the screens actually
use.

To add your own model, copy one of the existing `RunAnywhere.models.register` calls:

```ts
import { InferenceFramework } from '@runanywhere/proto-ts/model_types';

await RunAnywhere.models.register({
  id: 'my-model-q4_k_m',
  name: 'My Model Q4_K_M',
  url: 'https://huggingface.co/<repo>/resolve/main/<file>.gguf',
  framework: InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP,
  memoryRequirementBytes: 1_500_000_000,
});
```

Use `archiveUrl` instead of `url` for a `.tar.gz` bundle, or `files: [...]` for a multi-file
model such as a GGUF paired with its mmproj vision projector. Non-LLM models also need a
`category`, for example `ModelCategory.MODEL_CATEGORY_SPEECH_RECOGNITION`.

## SDK packages

| Package | Role |
|---------|------|
| `@runanywhere/core` | SDK lifecycle and every capability API |
| `@runanywhere/proto-ts` | generated protobuf types (`ModelCategory`, `InferenceFramework`, `ToolDefinition`) |
| `@runanywhere/llamacpp` | GGUF LLM and VLM inference |
| `@runanywhere/onnx` | Sherpa ONNX speech: STT, TTS, VAD |
| `@runanywhere/mlx` | Apple MLX, physical iOS devices |
| `@runanywhere/qhexrt` | Qualcomm Hexagon NPU, Android arm64 only |

All six are pinned to the same version. The SDK bridges to its C++ core through
NitroModules, a JSI HybridObject, so `react-native-nitro-modules` is a required peer
dependency.

## Platform notes

### iOS builds against the old architecture

`ios/Podfile` passes `new_arch_enabled => false` and its post-install hook strips
`RCT_NEW_ARCH_ENABLED` from the pod targets. Android runs the opposite way, with
`newArchEnabled=true` in `android/gradle.properties`. The asymmetry is deliberate:
`react-native-screens` crashes under the new architecture on RN 0.83's iOS side.

Three consequences worth knowing before you edit navigation code:

- `metro.config.js` redirects every `react-native-screens` import on iOS to
  `src/react-native-screens-mock.js`, which swaps the native screen components for plain
  views.
- `App.tsx` uses `@react-navigation/stack` with JS animations rather than native-stack.
- `react-native.config.js` also disables `react-native-sound` on iOS.

### Pods must be installed by hand

`react-native.config.js` sets `automaticPodsInstallation: false`, so `yarn ios` will build
whatever pods are already installed rather than refreshing them. Run `pod install` yourself
after `yarn install` and after any dependency change, or the build links against a stale
Pods tree.

### Audio capture is owned by the app, not the SDK

For the speech to text screen the app records its own audio: `NativeAudioModule` (Swift on
iOS, Kotlin on Android) writes 16 kHz mono WAV and hands the bytes to
`RunAnywhere.stt.transcribe`. The voice pipeline screen works differently.
`RunAnywhere.voice.createSession` opens the microphone, segments utterances and plays the
replies itself, and the screen only renders the event stream.

### Permissions

iOS declares `NSMicrophoneUsageDescription` and `NSSpeechRecognitionUsageDescription` in
`ios/RunAnywhereStarter/Info.plist`. Android declares `INTERNET` and `RECORD_AUDIO` in
`android/app/src/main/AndroidManifest.xml`, and the speech to text screen requests
`RECORD_AUDIO` at runtime.

## Troubleshooting

A model will not download. Check connectivity and free space. The 3B vision models are over
two gigabytes each. Progress comes straight from the SDK, so a frozen bar usually means a
stalled request rather than a stuck UI.

The microphone does nothing. Grant the permission and restart the app. On iOS the decision
is cached per install.

Generation is slow. Pick the smallest model that does the job, close other apps, and run on
a physical device rather than a simulator.

Android SDK location not found. Create `android/local.properties` containing
`sdk.dir=/path/to/Android/sdk`. Android Studio writes it on first open.

NDK not found. `ls $ANDROID_HOME/ndk/` should list `28.0.13004108`. Install it from Android
Studio's SDK Manager under SDK Tools, or with `sdkmanager "ndk;28.0.13004108"`.

Clean rebuild. `rm -rf node_modules && yarn install`, then `cd android && ./gradlew clean`
or `cd ios && rm -rf Pods Podfile.lock && pod install`.

## Support

- Issues: https://github.com/RunanywhereAI/runanywhere-sdks/issues
- Documentation: https://docs.runanywhere.ai
- Email: san@runanywhere.ai

## License

The starter app is MIT licensed. The RunAnywhere SDK is licensed separately, see
https://runanywhere.ai/license. For commercial licensing, contact san@runanywhere.ai.

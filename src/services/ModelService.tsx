import React, { createContext, useContext, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { RunAnywhere } from '@runanywhere/core';
import {
  ModelCategory,
  InferenceFramework,
  ModelRegistryStatus,
  type ModelInfo,
} from '@runanywhere/proto-ts/model_types';

// Model IDs - matching sample app model registry
// See: runanywhere-sdks/examples/react-native/RunAnywhereAI/src/services/ModelCatalogBootstrap.ts
export const MODEL_IDS = {
  llm: 'lfm2-350m-q8_0', // LiquidAI LFM2 - fast and efficient
  vlm: 'smolvlm-500m-instruct-q8_0', // SmolVLM - ultra-light vision model
  stt: 'sherpa-onnx-whisper-tiny.en',
  tts: 'vits-piper-en_US-lessac-medium',
} as const;

/**
 * `ModelInfo.isDownloaded` was deleted from the IDL; `registryStatus` is the
 * single downloaded-ness signal now.
 */
const isDownloaded = (model: ModelInfo): boolean =>
  model.registryStatus === ModelRegistryStatus.MODEL_REGISTRY_STATUS_DOWNLOADED ||
  model.registryStatus === ModelRegistryStatus.MODEL_REGISTRY_STATUS_LOADED;

interface ModelServiceState {
  // Download state
  isLLMDownloading: boolean;
  isVLMDownloading: boolean;
  isSTTDownloading: boolean;
  isTTSDownloading: boolean;

  llmDownloadProgress: number;
  vlmDownloadProgress: number;
  sttDownloadProgress: number;
  ttsDownloadProgress: number;

  // Load state
  isLLMLoading: boolean;
  isVLMLoading: boolean;
  isSTTLoading: boolean;
  isTTSLoading: boolean;

  // Loaded state
  isLLMLoaded: boolean;
  isVLMLoaded: boolean;
  isSTTLoaded: boolean;
  isTTSLoaded: boolean;

  isVoiceAgentReady: boolean;

  // Actions
  downloadAndLoadLLM: () => Promise<void>;
  downloadAndLoadVLM: () => Promise<void>;
  downloadAndLoadSTT: () => Promise<void>;
  downloadAndLoadTTS: () => Promise<void>;
  downloadAndLoadAllModels: () => Promise<void>;
  unloadAllModels: () => Promise<void>;
}

/**
 * Drive `RunAnywhere.models.download` to completion, forwarding the
 * commons-owned percent to the UI.
 *
 * Manual iteration — Hermes does not support `for await...of` over
 * NitroModules async iterables.
 */
const downloadWithProgress = async (
  modelId: string,
  onPercent: (percent: number) => void
): Promise<void> => {
  const iterator = RunAnywhere.models.download(modelId)[Symbol.asyncIterator]();
  try {
    for (;;) {
      const step = await iterator.next();
      if (step.done) break;
      const event = step.value;
      if (event.type === 'failed') {
        throw event.error;
      }
      if (event.type === 'progress' && event.percent !== undefined) {
        onPercent(event.percent);
      }
    }
  } finally {
    await iterator.return?.();
  }
};

const ModelServiceContext = createContext<ModelServiceState | null>(null);

export const useModelService = () => {
  const context = useContext(ModelServiceContext);
  if (!context) {
    throw new Error('useModelService must be used within ModelServiceProvider');
  }
  return context;
};

interface ModelServiceProviderProps {
  children: React.ReactNode;
}

export const ModelServiceProvider: React.FC<ModelServiceProviderProps> = ({ children }) => {
  // Download state
  const [isLLMDownloading, setIsLLMDownloading] = useState(false);
  const [isVLMDownloading, setIsVLMDownloading] = useState(false);
  const [isSTTDownloading, setIsSTTDownloading] = useState(false);
  const [isTTSDownloading, setIsTTSDownloading] = useState(false);

  const [llmDownloadProgress, setLLMDownloadProgress] = useState(0);
  const [vlmDownloadProgress, setVLMDownloadProgress] = useState(0);
  const [sttDownloadProgress, setSTTDownloadProgress] = useState(0);
  const [ttsDownloadProgress, setTTSDownloadProgress] = useState(0);

  // Load state
  const [isLLMLoading, setIsLLMLoading] = useState(false);
  const [isVLMLoading, setIsVLMLoading] = useState(false);
  const [isSTTLoading, setIsSTTLoading] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);

  // Loaded state
  const [isLLMLoaded, setIsLLMLoaded] = useState(false);
  const [isVLMLoaded, setIsVLMLoaded] = useState(false);
  const [isSTTLoaded, setIsSTTLoaded] = useState(false);
  const [isTTSLoaded, setIsTTSLoaded] = useState(false);

  const isVoiceAgentReady = isLLMLoaded && isSTTLoaded && isTTSLoaded;

  // Look up a registered model by id. Registration happens once at SDK
  // bootstrap (registerDefaultModels below) so this should always resolve
  // to a catalog entry once the SDK has initialized.
  const getRegisteredModel = useCallback(
    (modelId: string): Promise<ModelInfo | null> => RunAnywhere.models.get(modelId),
    []
  );

  // Download and load LLM
  const downloadAndLoadLLM = useCallback(async () => {
    if (isLLMDownloading || isLLMLoading) return;

    try {
      const model = await getRegisteredModel(MODEL_IDS.llm);
      if (!model) {
        console.error('LLM model not registered:', MODEL_IDS.llm);
        return;
      }

      if (!isDownloaded(model)) {
        setIsLLMDownloading(true);
        setLLMDownloadProgress(0);

        await downloadWithProgress(MODEL_IDS.llm, setLLMDownloadProgress);

        setIsLLMDownloading(false);
      }

      // Load the model (canonical id-based lifecycle — the native registry
      // resolves the on-disk artifact path internally, and throws on failure).
      setIsLLMLoading(true);
      await RunAnywhere.models.load(MODEL_IDS.llm);
      setIsLLMLoaded(true);
      setIsLLMLoading(false);
    } catch (error) {
      console.error('LLM download/load error:', error);
      setIsLLMDownloading(false);
      setIsLLMLoading(false);
    }
  }, [isLLMDownloading, isLLMLoading, getRegisteredModel]);

  // Download and load VLM (vision-language model, MULTIMODAL category)
  const downloadAndLoadVLM = useCallback(async () => {
    if (isVLMDownloading || isVLMLoading) return;

    try {
      const model = await getRegisteredModel(MODEL_IDS.vlm);
      if (!model) {
        console.error('VLM model not registered:', MODEL_IDS.vlm);
        return;
      }

      if (!isDownloaded(model)) {
        setIsVLMDownloading(true);
        setVLMDownloadProgress(0);

        await downloadWithProgress(MODEL_IDS.vlm, setVLMDownloadProgress);

        setIsVLMDownloading(false);
      }

      setIsVLMLoading(true);
      await RunAnywhere.models.load(MODEL_IDS.vlm);
      setIsVLMLoaded(true);
      setIsVLMLoading(false);
    } catch (error) {
      console.error('VLM download/load error:', error);
      setIsVLMDownloading(false);
      setIsVLMLoading(false);
    }
  }, [isVLMDownloading, isVLMLoading, getRegisteredModel]);

  // Download and load STT
  const downloadAndLoadSTT = useCallback(async () => {
    if (isSTTDownloading || isSTTLoading) return;

    try {
      const model = await getRegisteredModel(MODEL_IDS.stt);
      if (!model) {
        console.error('STT model not registered:', MODEL_IDS.stt);
        return;
      }

      if (!isDownloaded(model)) {
        setIsSTTDownloading(true);
        setSTTDownloadProgress(0);

        await downloadWithProgress(MODEL_IDS.stt, setSTTDownloadProgress);

        setIsSTTDownloading(false);
      }

      setIsSTTLoading(true);
      await RunAnywhere.models.load(MODEL_IDS.stt);
      setIsSTTLoaded(true);
      setIsSTTLoading(false);
    } catch (error) {
      console.error('STT download/load error:', error);
      setIsSTTDownloading(false);
      setIsSTTLoading(false);
    }
  }, [isSTTDownloading, isSTTLoading, getRegisteredModel]);

  // Download and load TTS
  const downloadAndLoadTTS = useCallback(async () => {
    if (isTTSDownloading || isTTSLoading) return;

    try {
      const model = await getRegisteredModel(MODEL_IDS.tts);
      if (!model) {
        console.error('TTS model not registered:', MODEL_IDS.tts);
        return;
      }

      if (!isDownloaded(model)) {
        setIsTTSDownloading(true);
        setTTSDownloadProgress(0);

        await downloadWithProgress(MODEL_IDS.tts, setTTSDownloadProgress);

        setIsTTSDownloading(false);
      }

      setIsTTSLoading(true);
      await RunAnywhere.models.load(MODEL_IDS.tts);
      setIsTTSLoaded(true);
      setIsTTSLoading(false);
    } catch (error) {
      console.error('TTS download/load error:', error);
      setIsTTSDownloading(false);
      setIsTTSLoading(false);
    }
  }, [isTTSDownloading, isTTSLoading, getRegisteredModel]);

  // Download and load all models
  const downloadAndLoadAllModels = useCallback(async () => {
    await Promise.all([
      downloadAndLoadLLM(),
      downloadAndLoadSTT(),
      downloadAndLoadTTS(),
    ]);
  }, [downloadAndLoadLLM, downloadAndLoadSTT, downloadAndLoadTTS]);

  // Unload all models.
  // Each category is unloaded independently: a single failing category used to
  // abort the whole sequence and skip every `setIsXLoaded(false)`, leaving the
  // UI claiming models were still loaded when most had already been unloaded.
  const unloadAllModels = useCallback(async () => {
    const targets: Array<[ModelCategory, (loaded: boolean) => void]> = [
      [ModelCategory.MODEL_CATEGORY_LANGUAGE, setIsLLMLoaded],
      [ModelCategory.MODEL_CATEGORY_MULTIMODAL, setIsVLMLoaded],
      [ModelCategory.MODEL_CATEGORY_SPEECH_RECOGNITION, setIsSTTLoaded],
      [ModelCategory.MODEL_CATEGORY_SPEECH_SYNTHESIS, setIsTTSLoaded],
    ];
    await Promise.all(
      targets.map(async ([category, setLoaded]) => {
        try {
          await RunAnywhere.models.unloadAll(category);
          setLoaded(false);
        } catch (error) {
          console.error('Error unloading models:', category, error);
        }
      })
    );
  }, []);

  const value: ModelServiceState = {
    isLLMDownloading,
    isVLMDownloading,
    isSTTDownloading,
    isTTSDownloading,
    llmDownloadProgress,
    vlmDownloadProgress,
    sttDownloadProgress,
    ttsDownloadProgress,
    isLLMLoading,
    isVLMLoading,
    isSTTLoading,
    isTTSLoading,
    isLLMLoaded,
    isVLMLoaded,
    isSTTLoaded,
    isTTSLoaded,
    isVoiceAgentReady,
    downloadAndLoadLLM,
    downloadAndLoadVLM,
    downloadAndLoadSTT,
    downloadAndLoadTTS,
    downloadAndLoadAllModels,
    unloadAllModels,
  };

  return (
    <ModelServiceContext.Provider value={value}>
      {children}
    </ModelServiceContext.Provider>
  );
};

/**
 * Register default models with the SDK.
 * Models + frameworks match the sample app's curated catalog:
 * runanywhere-sdks/examples/react-native/RunAnywhereAI/src/services/ModelCatalogBootstrap.ts
 */
export const registerDefaultModels = async () => {
  // LLM Model - LiquidAI LFM2 350M (fast, efficient, great for mobile)
  await RunAnywhere.models.register({
    id: MODEL_IDS.llm,
    name: 'LiquidAI LFM2 350M Q8_0',
    url: 'https://huggingface.co/LiquidAI/LFM2-350M-GGUF/resolve/main/LFM2-350M-Q8_0.gguf',
    framework: InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP,
    memoryRequirementBytes: 400_000_000,
  });

  // Also add SmolLM2 as alternative smaller model
  await RunAnywhere.models.register({
    id: 'smollm2-360m-q8_0',
    name: 'SmolLM2 360M Q8_0',
    url: 'https://huggingface.co/prithivMLmods/SmolLM2-360M-GGUF/resolve/main/SmolLM2-360M.Q8_0.gguf',
    framework: InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP,
    memoryRequirementBytes: 500_000_000,
  });

  // VLM Model - SmolVLM 500M (ultra-lightweight vision-language model, ~600MB)
  // Single tar.gz bundle (weights + mmproj) served by the RunAnywhere release
  // mirror. Runs on the LlamaCPP backend under the MULTIMODAL category.
  // `archiveUrl` replaces the removed `artifactType` knob — the SDK infers the
  // archive type from the url.
  await RunAnywhere.models.register({
    id: MODEL_IDS.vlm,
    name: 'SmolVLM 500M Instruct',
    archiveUrl:
      'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-vlm-models-v1/smolvlm-500m-instruct-q8_0.tar.gz',
    framework: InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP,
    category: ModelCategory.MODEL_CATEGORY_MULTIMODAL,
    memoryRequirementBytes: 600_000_000,
  });

  // VLM Model - LiquidAI LFM2.5-VL 3B Q4_K_M (~2.3GB total, iOS + Android)
  // Multi-file download: main Q4_K_M weights + Q8_0 mmproj vision projector.
  // Same gguf+mmproj pairing the SmolVLM bundle above ships pre-archived, just
  // fetched straight from the upstream repo instead of a tar.gz mirror.
  await RunAnywhere.models.register({
    id: 'lfm2.5-vl-3b-q4_k_m',
    name: 'LFM2.5-VL 3B Q4_K_M',
    files: [
      {
        url: 'https://huggingface.co/LiquidAI/LFM2.5-VL-3B-GGUF/resolve/main/LFM2.5-VL-3B-Q4_K_M.gguf',
        filename: 'LFM2.5-VL-3B-Q4_K_M.gguf',
        required: true,
      },
      {
        url: 'https://huggingface.co/LiquidAI/LFM2.5-VL-3B-GGUF/resolve/main/mmproj-LFM2.5-VL-3B-Q8_0.gguf',
        filename: 'mmproj-LFM2.5-VL-3B-Q8_0.gguf',
        required: true,
      },
    ],
    framework: InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP,
    category: ModelCategory.MODEL_CATEGORY_MULTIMODAL,
    // Sum of file Content-Lengths: main (1,674,454,240 B) + mmproj (583,109,120 B).
    memoryRequirementBytes: 2_257_563_360,
  });

  // VLM Model - LiquidAI LFM2.5-VL 3B MLX 4-bit (~2.4GB repo, Apple only).
  // MLX is an iOS-only, physical-device-only backend (see App.tsx), so the entry
  // is registered only where it can actually load rather than sitting unloadable
  // in the Android catalog.
  // A PLAIN repo ref, not a `/4bit` subfolder ref like `hf.co/LiquidAI/...MLX/4bit`
  // — LiquidAI publishes one precision per repo here, so the 4-bit safetensors sit
  // at the repo ROOT alongside config.json.
  if (Platform.OS === 'ios') {
    await RunAnywhere.models.register({
      id: 'mlx-lfm2.5-vl-3b-4bit',
      name: 'MLX LFM2.5-VL 3B 4bit',
      url: 'https://huggingface.co/LiquidAI/LFM2.5-VL-3B-MLX-4bit',
      framework: InferenceFramework.INFERENCE_FRAMEWORK_MLX,
      category: ModelCategory.MODEL_CATEGORY_MULTIMODAL,
      // 2,388,273,220 B for the whole repo (2.37 GB of that is
      // model.safetensors) plus KV cache and Metal runtime overhead.
      memoryRequirementBytes: 2_600_000_000,
    });
  }

  // STT Model - Sherpa Whisper Tiny English
  // tar.gz served by the Sherpa engine plugin (ONNX.register() installs it).
  await RunAnywhere.models.register({
    id: MODEL_IDS.stt,
    name: 'Sherpa Whisper Tiny (ONNX)',
    archiveUrl:
      'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/sherpa-onnx-whisper-tiny.en.tar.gz',
    framework: InferenceFramework.INFERENCE_FRAMEWORK_SHERPA,
    category: ModelCategory.MODEL_CATEGORY_SPEECH_RECOGNITION,
    memoryRequirementBytes: 75_000_000,
  });

  // TTS Model - Piper TTS (US English - Medium quality)
  await RunAnywhere.models.register({
    id: MODEL_IDS.tts,
    name: 'Piper TTS (US English - Medium)',
    archiveUrl:
      'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-en_US-lessac-medium.tar.gz',
    framework: InferenceFramework.INFERENCE_FRAMEWORK_SHERPA,
    category: ModelCategory.MODEL_CATEGORY_SPEECH_SYNTHESIS,
    memoryRequirementBytes: 65_000_000,
  });

  // VAD Model - Silero VAD (voice activity detection for the voice pipeline).
  // Small .onnx served directly from the upstream repo; runs on the ONNX backend.
  await RunAnywhere.models.register({
    id: 'silero-vad',
    name: 'Silero VAD',
    url: 'https://github.com/snakers4/silero-vad/raw/master/src/silero_vad/data/silero_vad.onnx',
    framework: InferenceFramework.INFERENCE_FRAMEWORK_ONNX,
    category: ModelCategory.MODEL_CATEGORY_VOICE_ACTIVITY_DETECTION,
    memoryRequirementBytes: 2_327_524,
  });
};

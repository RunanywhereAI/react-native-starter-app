import React, { createContext, useContext, useState, useCallback } from 'react';
import { RunAnywhere } from '@runanywhere/core';
import {
  ModelCategory,
  InferenceFramework,
  ModelArtifactType,
  ModelLoadRequest,
  ModelUnloadRequest,
  type ModelInfo,
} from '@runanywhere/proto-ts/model_types';

// Model IDs - matching sample app model registry
// See: runanywhere-sdks/examples/react-native/RunAnywhereAI/src/services/ModelCatalogBootstrap.ts
const MODEL_IDS = {
  llm: 'lfm2-350m-q8_0', // LiquidAI LFM2 - fast and efficient
  vlm: 'smolvlm-500m-instruct-q8_0', // SmolVLM - ultra-light vision model
  stt: 'sherpa-onnx-whisper-tiny.en',
  tts: 'vits-piper-en_US-lessac-medium',
} as const;

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
    async (modelId: string): Promise<ModelInfo | null> => {
      const result = await RunAnywhere.getModel({ modelId });
      return result.found ? (result.model ?? null) : null;
    },
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

      if (!model.isDownloaded) {
        setIsLLMDownloading(true);
        setLLMDownloadProgress(0);

        await RunAnywhere.downloadModel(model, (progress) => {
          setLLMDownloadProgress(progress.overallProgress * 100);
        });

        setIsLLMDownloading(false);
      }

      // Load the model (canonical id-based lifecycle — the native registry
      // resolves the on-disk artifact path internally).
      setIsLLMLoading(true);
      const result = await RunAnywhere.loadModel(
        ModelLoadRequest.fromPartial({
          modelId: MODEL_IDS.llm,
          category: ModelCategory.MODEL_CATEGORY_LANGUAGE,
        })
      );
      setIsLLMLoaded(result.success);
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

      if (!model.isDownloaded) {
        setIsVLMDownloading(true);
        setVLMDownloadProgress(0);

        await RunAnywhere.downloadModel(model, (progress) => {
          setVLMDownloadProgress(progress.overallProgress * 100);
        });

        setIsVLMDownloading(false);
      }

      setIsVLMLoading(true);
      const result = await RunAnywhere.loadModel(
        ModelLoadRequest.fromPartial({
          modelId: MODEL_IDS.vlm,
          category: ModelCategory.MODEL_CATEGORY_MULTIMODAL,
        })
      );
      setIsVLMLoaded(result.success);
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

      if (!model.isDownloaded) {
        setIsSTTDownloading(true);
        setSTTDownloadProgress(0);

        await RunAnywhere.downloadModel(model, (progress) => {
          setSTTDownloadProgress(progress.overallProgress * 100);
        });

        setIsSTTDownloading(false);
      }

      setIsSTTLoading(true);
      const result = await RunAnywhere.loadModel(
        ModelLoadRequest.fromPartial({
          modelId: MODEL_IDS.stt,
          category: ModelCategory.MODEL_CATEGORY_SPEECH_RECOGNITION,
        })
      );
      setIsSTTLoaded(result.success);
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

      if (!model.isDownloaded) {
        setIsTTSDownloading(true);
        setTTSDownloadProgress(0);

        await RunAnywhere.downloadModel(model, (progress) => {
          setTTSDownloadProgress(progress.overallProgress * 100);
        });

        setIsTTSDownloading(false);
      }

      setIsTTSLoading(true);
      const result = await RunAnywhere.loadModel(
        ModelLoadRequest.fromPartial({
          modelId: MODEL_IDS.tts,
          category: ModelCategory.MODEL_CATEGORY_SPEECH_SYNTHESIS,
        })
      );
      setIsTTSLoaded(result.success);
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

  // Unload all models
  const unloadAllModels = useCallback(async () => {
    try {
      await RunAnywhere.unloadModel(
        ModelUnloadRequest.fromPartial({
          category: ModelCategory.MODEL_CATEGORY_LANGUAGE,
          unloadAll: true,
        })
      );
      await RunAnywhere.unloadModel(
        ModelUnloadRequest.fromPartial({
          category: ModelCategory.MODEL_CATEGORY_MULTIMODAL,
          unloadAll: true,
        })
      );
      await RunAnywhere.unloadModel(
        ModelUnloadRequest.fromPartial({
          category: ModelCategory.MODEL_CATEGORY_SPEECH_RECOGNITION,
          unloadAll: true,
        })
      );
      await RunAnywhere.unloadModel(
        ModelUnloadRequest.fromPartial({
          category: ModelCategory.MODEL_CATEGORY_SPEECH_SYNTHESIS,
          unloadAll: true,
        })
      );
      setIsLLMLoaded(false);
      setIsVLMLoaded(false);
      setIsSTTLoaded(false);
      setIsTTSLoaded(false);
    } catch (error) {
      console.error('Error unloading models:', error);
    }
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
  await RunAnywhere.registerModel({
    id: MODEL_IDS.llm,
    name: 'LiquidAI LFM2 350M Q8_0',
    url: 'https://huggingface.co/LiquidAI/LFM2-350M-GGUF/resolve/main/LFM2-350M-Q8_0.gguf',
    framework: InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP,
    memoryRequirement: 400_000_000,
  });

  // Also add SmolLM2 as alternative smaller model
  await RunAnywhere.registerModel({
    id: 'smollm2-360m-q8_0',
    name: 'SmolLM2 360M Q8_0',
    url: 'https://huggingface.co/prithivMLmods/SmolLM2-360M-GGUF/resolve/main/SmolLM2-360M.Q8_0.gguf',
    framework: InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP,
    memoryRequirement: 500_000_000,
  });

  // VLM Model - SmolVLM 500M (ultra-lightweight vision-language model, ~600MB)
  // Single tar.gz bundle (weights + mmproj) served by the RunAnywhere release
  // mirror. Runs on the LlamaCPP backend under the MULTIMODAL category.
  await RunAnywhere.registerModel({
    id: MODEL_IDS.vlm,
    name: 'SmolVLM 500M Instruct',
    url: 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-vlm-models-v1/smolvlm-500m-instruct-q8_0.tar.gz',
    framework: InferenceFramework.INFERENCE_FRAMEWORK_LLAMA_CPP,
    modality: ModelCategory.MODEL_CATEGORY_MULTIMODAL,
    artifactType: ModelArtifactType.MODEL_ARTIFACT_TYPE_TAR_GZ_ARCHIVE,
    memoryRequirement: 600_000_000,
  });

  // STT Model - Sherpa Whisper Tiny English
  // tar.gz served by the Sherpa engine plugin (ONNX.register() installs it).
  await RunAnywhere.registerModel({
    id: MODEL_IDS.stt,
    name: 'Sherpa Whisper Tiny (ONNX)',
    url: 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/sherpa-onnx-whisper-tiny.en.tar.gz',
    framework: InferenceFramework.INFERENCE_FRAMEWORK_SHERPA,
    modality: ModelCategory.MODEL_CATEGORY_SPEECH_RECOGNITION,
    artifactType: ModelArtifactType.MODEL_ARTIFACT_TYPE_TAR_GZ_ARCHIVE,
    memoryRequirement: 75_000_000,
  });

  // TTS Model - Piper TTS (US English - Medium quality)
  await RunAnywhere.registerModel({
    id: MODEL_IDS.tts,
    name: 'Piper TTS (US English - Medium)',
    url: 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-en_US-lessac-medium.tar.gz',
    framework: InferenceFramework.INFERENCE_FRAMEWORK_SHERPA,
    modality: ModelCategory.MODEL_CATEGORY_SPEECH_SYNTHESIS,
    artifactType: ModelArtifactType.MODEL_ARTIFACT_TYPE_TAR_GZ_ARCHIVE,
    memoryRequirement: 65_000_000,
  });

  // VAD Model - Silero VAD (voice activity detection for the voice pipeline).
  // Small .onnx served directly from the upstream repo; runs on the ONNX backend.
  await RunAnywhere.registerModel({
    id: 'silero-vad',
    name: 'Silero VAD',
    url: 'https://github.com/snakers4/silero-vad/raw/master/src/silero_vad/data/silero_vad.onnx',
    framework: InferenceFramework.INFERENCE_FRAMEWORK_ONNX,
    modality: ModelCategory.MODEL_CATEGORY_VOICE_ACTIVITY_DETECTION,
    memoryRequirement: 2_327_524,
  });
};

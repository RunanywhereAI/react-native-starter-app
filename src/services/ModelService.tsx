import React, { createContext, useContext, useState, useCallback } from 'react';
import { RunAnywhere, ModelCategory } from '@runanywhere/core';
import { LlamaCPP } from '@runanywhere/llamacpp';
import { ONNX } from '@runanywhere/onnx';

// Model IDs - matching Flutter starter app model registry
// Using officially supported models from RunanywhereAI/sherpa-onnx for compatibility
const MODEL_IDS = {
  llm: 'smollm2-360m-instruct-q8_0', // SmolLM2 360M Instruct - small, fast, good for demos
  stt: 'sherpa-onnx-whisper-tiny.en',
  tts: 'vits-piper-en_US-lessac-medium',
} as const;

interface ModelServiceState {
  // Download state
  isLLMDownloading: boolean;
  isSTTDownloading: boolean;
  isTTSDownloading: boolean;
  
  llmDownloadProgress: number;
  sttDownloadProgress: number;
  ttsDownloadProgress: number;
  
  // Load state
  isLLMLoading: boolean;
  isSTTLoading: boolean;
  isTTSLoading: boolean;
  
  // Loaded state
  isLLMLoaded: boolean;
  isSTTLoaded: boolean;
  isTTSLoaded: boolean;
  
  isVoiceAgentReady: boolean;
  
  // Actions
  downloadAndLoadLLM: () => Promise<void>;
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
  const [isSTTDownloading, setIsSTTDownloading] = useState(false);
  const [isTTSDownloading, setIsTTSDownloading] = useState(false);
  
  const [llmDownloadProgress, setLLMDownloadProgress] = useState(0);
  const [sttDownloadProgress, setSTTDownloadProgress] = useState(0);
  const [ttsDownloadProgress, setTTSDownloadProgress] = useState(0);
  
  // Load state
  const [isLLMLoading, setIsLLMLoading] = useState(false);
  const [isSTTLoading, setIsSTTLoading] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  
  // Loaded state
  const [isLLMLoaded, setIsLLMLoaded] = useState(false);
  const [isSTTLoaded, setIsSTTLoaded] = useState(false);
  const [isTTSLoaded, setIsTTSLoaded] = useState(false);
  
  const isVoiceAgentReady = isLLMLoaded && isSTTLoaded && isTTSLoaded;
  
  // Check if model is downloaded (per docs: use getModelInfo and check localPath)
  const checkModelDownloaded = useCallback(async (modelId: string): Promise<boolean> => {
    try {
      const modelInfo = await RunAnywhere.getModelInfo(modelId);
      return !!modelInfo?.localPath;
    } catch {
      return false;
    }
  }, []);
  
  // Download and load LLM
  const downloadAndLoadLLM = useCallback(async () => {
    if (isLLMDownloading || isLLMLoading) return;
    
    try {
      const isDownloaded = await checkModelDownloaded(MODEL_IDS.llm);
      
      if (!isDownloaded) {
        setIsLLMDownloading(true);
        setLLMDownloadProgress(0);
        
        // Download with progress (per docs: progress.progress is 0-1)
        await RunAnywhere.downloadModel(MODEL_IDS.llm, (progress) => {
          setLLMDownloadProgress(progress.progress * 100);
        });
        
        setIsLLMDownloading(false);
      }
      
      // Load the model (per docs: get localPath first, then load)
      setIsLLMLoading(true);
      const modelInfo = await RunAnywhere.getModelInfo(MODEL_IDS.llm);
      if (modelInfo?.localPath) {
        await RunAnywhere.loadModel(modelInfo.localPath);
        setIsLLMLoaded(true);
      }
      setIsLLMLoading(false);
    } catch (error) {
      console.error('LLM download/load error:', error);
      setIsLLMDownloading(false);
      setIsLLMLoading(false);
    }
  }, [isLLMDownloading, isLLMLoading, checkModelDownloaded]);
  
  // Download and load STT
  const downloadAndLoadSTT = useCallback(async () => {
    if (isSTTDownloading || isSTTLoading) return;
    
    try {
      const isDownloaded = await checkModelDownloaded(MODEL_IDS.stt);
      
      if (!isDownloaded) {
        setIsSTTDownloading(true);
        setSTTDownloadProgress(0);
        
        await RunAnywhere.downloadModel(MODEL_IDS.stt, (progress) => {
          setSTTDownloadProgress(progress.progress * 100);
        });
        
        setIsSTTDownloading(false);
      }
      
      // Load the STT model (per docs: loadSTTModel(localPath, 'whisper'))
      setIsSTTLoading(true);
      const modelInfo = await RunAnywhere.getModelInfo(MODEL_IDS.stt);
      if (modelInfo?.localPath) {
        await RunAnywhere.loadSTTModel(modelInfo.localPath, 'whisper');
        setIsSTTLoaded(true);
      }
      setIsSTTLoading(false);
    } catch (error) {
      console.error('STT download/load error:', error);
      setIsSTTDownloading(false);
      setIsSTTLoading(false);
    }
  }, [isSTTDownloading, isSTTLoading, checkModelDownloaded]);
  
  // Download and load TTS
  const downloadAndLoadTTS = useCallback(async () => {
    if (isTTSDownloading || isTTSLoading) return;
    
    try {
      const isDownloaded = await checkModelDownloaded(MODEL_IDS.tts);
      
      if (!isDownloaded) {
        setIsTTSDownloading(true);
        setTTSDownloadProgress(0);
        
        await RunAnywhere.downloadModel(MODEL_IDS.tts, (progress) => {
          setTTSDownloadProgress(progress.progress * 100);
        });
        
        setIsTTSDownloading(false);
      }
      
      // Load the TTS model (per docs: loadTTSModel(localPath, 'piper'))
      setIsTTSLoading(true);
      const modelInfo = await RunAnywhere.getModelInfo(MODEL_IDS.tts);
      if (modelInfo?.localPath) {
        await RunAnywhere.loadTTSModel(modelInfo.localPath, 'piper');
        setIsTTSLoaded(true);
      }
      setIsTTSLoading(false);
    } catch (error) {
      console.error('TTS download/load error:', error);
      setIsTTSDownloading(false);
      setIsTTSLoading(false);
    }
  }, [isTTSDownloading, isTTSLoading, checkModelDownloaded]);
  
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
      await RunAnywhere.unloadModel();
      await RunAnywhere.unloadSTTModel();
      await RunAnywhere.unloadTTSModel();
      setIsLLMLoaded(false);
      setIsSTTLoaded(false);
      setIsTTSLoaded(false);
    } catch (error) {
      console.error('Error unloading models:', error);
    }
  }, []);
  
  const value: ModelServiceState = {
    isLLMDownloading,
    isSTTDownloading,
    isTTSDownloading,
    llmDownloadProgress,
    sttDownloadProgress,
    ttsDownloadProgress,
    isLLMLoading,
    isSTTLoading,
    isTTSLoading,
    isLLMLoaded,
    isSTTLoaded,
    isTTSLoaded,
    isVoiceAgentReady,
    downloadAndLoadLLM,
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
 * Register default models with the SDK
 * Models match the Flutter starter app exactly for compatibility
 * Using officially supported models from RunanywhereAI/sherpa-onnx
 */
export const registerDefaultModels = async () => {
  try {
    // LLM Model - SmolLM2 360M Instruct (small, fast, good for demos)
    // Matching Flutter starter: https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF
    await LlamaCPP.addModel({
      id: MODEL_IDS.llm,
      name: 'SmolLM2 360M Instruct Q8_0',
      url: 'https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct-GGUF/resolve/main/smollm2-360m-instruct-q8_0.gguf',
      memoryRequirement: 400_000_000, // ~400MB
    });
    console.log('[ModelService] LLM model registered:', MODEL_IDS.llm);
  } catch (e: any) {
    console.warn('[ModelService] Failed to register LLM model:', e.message);
  }

  try {
    // STT Model - Whisper Tiny English (fast transcription)
    // Using tar.gz format from RunanywhereAI for fast native extraction
    await ONNX.addModel({
      id: MODEL_IDS.stt,
      name: 'Sherpa Whisper Tiny (ONNX)',
      url: 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/sherpa-onnx-whisper-tiny.en.tar.gz',
      modality: ModelCategory.SpeechRecognition,
    });
    console.log('[ModelService] STT model registered:', MODEL_IDS.stt);
  } catch (e: any) {
    console.warn('[ModelService] Failed to register STT model:', e.message);
  }

  try {
    // TTS Model - Piper TTS (US English - Medium quality)
    // Using officially supported Piper model for reliable TTS
    await ONNX.addModel({
      id: MODEL_IDS.tts,
      name: 'Piper TTS (US English - Medium)',
      url: 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-en_US-lessac-medium.tar.gz',
      modality: ModelCategory.SpeechSynthesis,
    });
    console.log('[ModelService] TTS model registered:', MODEL_IDS.tts);
  } catch (e: any) {
    console.warn('[ModelService] Failed to register TTS model:', e.message);
  }
};

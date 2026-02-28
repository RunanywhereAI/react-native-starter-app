import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { RunAnywhere, ModelCategory, SDKEnvironment } from '@runanywhere/core';
import { LlamaCPP } from '@runanywhere/llamacpp';
import { ONNX, ModelArtifactType } from '@runanywhere/onnx';

// Model IDs - matching sample app model registry
// See: /Users/shubhammalhotra/Desktop/test-fresh/runanywhere-sdks/examples/react-native/RunAnywhereAI/App.tsx
const MODEL_IDS = {
  llm: 'lfm2-350m-q8_0', // LiquidAI LFM2 - fast and efficient
  stt: 'sherpa-onnx-whisper-tiny.en',
  tts: 'vits-piper-en_US-lessac-medium',
} as const;

interface ModelServiceState {
  // SDK readiness
  isSDKReady: boolean;
  sdkError: string | null;
  
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
  // SDK readiness
  const [isSDKReady, setIsSDKReady] = useState(false);
  const [sdkError, setSDKError] = useState<string | null>(null);
  
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

  // Initialize SDK on mount
  useEffect(() => {
    const initializeSDK = async () => {
      try {
        console.log('[ModelService] 🚀 Initializing RunAnywhere SDK...');
        
        // Initialize SDK
        await RunAnywhere.initialize({
          environment: SDKEnvironment.Development,
        });
        console.log('[ModelService] ✅ SDK initialized');

        // Register backends
        console.log('[ModelService] 📦 Registering backends...');
        await LlamaCPP.register();
        await ONNX.register();
        console.log('[ModelService] ✅ Backends registered');

        // Register default models
        console.log('[ModelService] 🤖 Registering default models...');
        await registerDefaultModels();
        console.log('[ModelService] ✅ Default models registered');

        setIsSDKReady(true);
        console.log('[ModelService] ✅ SDK fully ready');
      } catch (error) {
        console.error('[ModelService] ❌ SDK initialization failed:', error);
        setSDKError(error instanceof Error ? error.message : 'SDK initialization failed');
      }
    };

    initializeSDK();
  }, []);
  
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
    if (isSTTDownloading || isSTTLoading) {
      console.log('[ModelService] ⏭️ STT download/load already in progress, skipping');
      return;
    }

    if (!isSDKReady) {
      console.log('[ModelService] ⏳ SDK not ready yet, waiting...');
      return;
    }
    
    try {
      console.log('[ModelService] 🎤 Starting STT download and load...');
      
      // Step 1: Check if model files already exist on disk (e.g., pre-pushed via adb)
      let modelLocalPath: string | null = null;
      
      try {
        // Check if the SDK already knows about the model
        const isDownloaded = await checkModelDownloaded(MODEL_IDS.stt);
        console.log('[ModelService] 📦 SDK reports model downloaded:', isDownloaded);
        
        if (isDownloaded) {
          const info = await RunAnywhere.getModelInfo(MODEL_IDS.stt);
          if (info?.localPath) {
            modelLocalPath = info.localPath;
            console.log('[ModelService] ✅ Model found via SDK at:', modelLocalPath);
          }
        }
      } catch (checkErr) {
        console.log('[ModelService] ⚠️ SDK check failed, trying filesystem:', checkErr);
      }
      
      // If SDK doesn't know about it, check the filesystem directly
      if (!modelLocalPath) {
        try {
          const RNFS = require('react-native-fs');
          const documentsDir = RNFS.DocumentDirectoryPath;
          const possiblePaths = [
            `${documentsDir}/RunAnywhere/Models/ONNX/${MODEL_IDS.stt}/${MODEL_IDS.stt}`,
            `${documentsDir}/RunAnywhere/Models/ONNX/${MODEL_IDS.stt}`,
          ];
          
          for (const path of possiblePaths) {
            const exists = await RNFS.exists(path);
            if (exists) {
              // Verify it has model files
              try {
                const contents = await RNFS.readDir(path);
                const hasOnnx = contents.some((f: any) => f.name.endsWith('.onnx'));
                if (hasOnnx) {
                  modelLocalPath = path;
                  console.log('[ModelService] ✅ Model found on disk at:', path);
                  console.log('[ModelService] 📁 Contents:', contents.map((f: any) => f.name).join(', '));
                  break;
                }
              } catch {
                // Not a directory, might be a file
              }
            }
          }
        } catch (fsErr) {
          console.log('[ModelService] ⚠️ Filesystem check failed:', fsErr);
        }
      }
      
      // Step 2: Download if not found on disk
      if (!modelLocalPath) {
        setIsSTTDownloading(true);
        setSTTDownloadProgress(0);
        
        console.log('[ModelService] 📥 Model not found on disk, downloading...');
        try {
          await RunAnywhere.downloadModel(MODEL_IDS.stt, (progress) => {
            const pct = progress.progress * 100;
            setSTTDownloadProgress(pct);
          });
          console.log('[ModelService] ✅ STT model download completed');
        } catch (downloadError: any) {
          setIsSTTDownloading(false);
          const errMsg = downloadError?.message || String(downloadError);
          console.error('[ModelService] ❌ STT download failed:', errMsg);
          const { Alert } = require('react-native');
          Alert.alert('Download Error', `STT model download failed:\n\n${errMsg}`);
          throw downloadError;
        }
        
        setIsSTTDownloading(false);
        
        // Get the path from SDK after download
        try {
          const modelInfo = await RunAnywhere.getModelInfo(MODEL_IDS.stt);
          modelLocalPath = modelInfo?.localPath || null;
        } catch (e) {
          console.error('[ModelService] ❌ Failed to get model path after download:', e);
        }
      }
      
      if (!modelLocalPath) {
        const errMsg = 'Could not find model files on disk after download';
        console.error('[ModelService] ❌', errMsg);
        const { Alert } = require('react-native');
        Alert.alert('Model Error', errMsg);
        throw new Error(errMsg);
      }
      
      // Step 3: Load the STT model
      setIsSTTLoading(true);
      console.log('[ModelService] 🔄 Loading STT model from:', modelLocalPath);
      try {
        await RunAnywhere.loadSTTModel(modelLocalPath, 'whisper');
        console.log('[ModelService] ✅ STT model loaded successfully');
        setIsSTTLoaded(true);
      } catch (loadError: any) {
        const errMsg = loadError?.message || String(loadError);
        console.error('[ModelService] ❌ STT model load failed:', errMsg);
        const { Alert } = require('react-native');
        Alert.alert('Model Load Error', `Path: ${modelLocalPath}\nError: ${errMsg}`);
        throw loadError;
      }
      
      setIsSTTLoading(false);
    } catch (error: any) {
      console.error('[ModelService] ❌ STT pipeline error:', error?.message || error);
      setIsSTTDownloading(false);
      setIsSTTLoading(false);
    }
  }, [isSTTDownloading, isSTTLoading, checkModelDownloaded, isSDKReady]);
  
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
    isSDKReady,
    sdkError,
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
 * Models match the sample app: /Users/shubhammalhotra/Desktop/test-fresh/runanywhere-sdks/examples/react-native/RunAnywhereAI/App.tsx
 */
export const registerDefaultModels = async () => {
  // LLM Model - LiquidAI LFM2 350M (fast, efficient, great for mobile)
  await LlamaCPP.addModel({
    id: MODEL_IDS.llm,
    name: 'LiquidAI LFM2 350M Q8_0',
    url: 'https://huggingface.co/LiquidAI/LFM2-350M-GGUF/resolve/main/LFM2-350M-Q8_0.gguf',
    memoryRequirement: 400_000_000,
  });
  
  // Also add SmolLM2 as alternative smaller model
  await LlamaCPP.addModel({
    id: 'smollm2-360m-q8_0',
    name: 'SmolLM2 360M Q8_0',
    url: 'https://huggingface.co/prithivMLmods/SmolLM2-360M-GGUF/resolve/main/SmolLM2-360M.Q8_0.gguf',
    memoryRequirement: 500_000_000,
  });
  
  // STT Model - Sherpa Whisper Tiny English
  // Using tar.gz wrapper from RunAnywhere models
  // Fallback: wrapping github download in ghproxy CDN to prevent DNS resolution errors
  // Update: Switching to Hugging Face directly since ISP blocks ghproxy and github.com
  await ONNX.addModel({
    id: MODEL_IDS.stt,
    name: 'Sherpa Whisper Tiny (ONNX)',
    url: 'https://huggingface.co/runanywhere/sherpa-onnx-whisper-tiny.en/resolve/main/sherpa-onnx-whisper-tiny.en.tar.gz',
    modality: ModelCategory.SpeechRecognition,
    artifactType: ModelArtifactType.TarGzArchive,
    memoryRequirement: 100_000_000,
  });
  
  // TTS Model - Piper TTS (US English - Medium quality)
  await ONNX.addModel({
    id: MODEL_IDS.tts,
    name: 'Piper TTS (US English - Medium)',
    url: 'https://huggingface.co/runanywhere/vits-piper-en_US-lessac-medium/resolve/main/vits-piper-en_US-lessac-medium.tar.gz',
    modality: ModelCategory.SpeechSynthesis,
    artifactType: ModelArtifactType.TarGzArchive,
    memoryRequirement: 65_000_000,
  });
};

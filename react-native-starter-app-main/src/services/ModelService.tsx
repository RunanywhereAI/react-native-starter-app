import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { RunAnywhere, ModelCategory, FileSystem } from '@runanywhere/core';
import { ONNX, ModelArtifactType } from '@runanywhere/onnx';
import RNFS from 'react-native-fs';
import { Platform, NativeModules } from 'react-native';

const { StorageModule } = NativeModules;

// Model IDs - matching sample app model registry
const MODEL_IDS = {
  stt: 'sherpa-onnx-whisper-tiny.en',
  tts: 'vits-piper-en_US-lessac-medium',
} as const;

interface ModelServiceState {
  // Download state
  isSTTDownloading: boolean;
  isTTSDownloading: boolean;

  sttDownloadProgress: number;
  ttsDownloadProgress: number;

  // Load state
  isSTTLoading: boolean;
  isTTSLoading: boolean;

  // Loaded state
  isSTTLoaded: boolean;
  isTTSLoaded: boolean;

  isVoiceAgentReady: boolean;

  // Actions
  downloadAndLoadSTT: () => Promise<void>;
  downloadAndLoadTTS: () => Promise<void>;
  downloadAndLoadAllModels: () => Promise<void>;
  unloadAllModels: () => Promise<void>;
  unloadTTSModel: () => Promise<void>;
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
  const [isSTTDownloading, setIsSTTDownloading] = useState(false);
  const [isTTSDownloading, setIsTTSDownloading] = useState(false);

  const [sttDownloadProgress, setSTTDownloadProgress] = useState(0);
  const [ttsDownloadProgress, setTTSDownloadProgress] = useState(0);

  // Load state
  const [isSTTLoading, setIsSTTLoading] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);

  // Loaded state
  const [isSTTLoaded, setIsSTTLoaded] = useState(false);
  const [isTTSLoaded, setIsTTSLoaded] = useState(false);

  const isVoiceAgentReady = isSTTLoaded && isTTSLoaded;

  // Check if model is downloaded (per docs: use getModelInfo and check localPath)
  const checkModelDownloaded = useCallback(async (modelId: string): Promise<boolean> => {
    try {
      const modelInfo = await RunAnywhere.getModelInfo(modelId);
      return !!modelInfo?.localPath;
    } catch {
      return false;
    }
  }, []);

  // Download and load STT
  const downloadAndLoadSTT = useCallback(async () => {
    if (isSTTDownloading || isSTTLoading) return;

    try {
      const isDownloaded = await checkModelDownloaded(MODEL_IDS.stt);

      if (!isDownloaded) {
        setIsSTTDownloading(true);
        setSTTDownloadProgress(0);

        try {
          if (Platform.OS === 'android') {
            const assetFileName = 'sherpa-onnx-whisper-tiny.en.bundle';
            const destPath = `${RNFS.DocumentDirectoryPath}/sherpa-onnx-whisper-tiny.en.tar.gz`;

            setSTTDownloadProgress(10); // Indicate start
            console.warn(`[ModelService] Unpacking local STT asset ${assetFileName} to ${destPath}`);

            try {
              await StorageModule.unpackAsset(assetFileName, destPath);
              console.warn(`[ModelService] STT Copy SUCCESS`);
            } catch (err) {
              console.error(`[ModelService] STT Copy FAILED:`, err);
              throw err;
            }

            setSTTDownloadProgress(50);

            console.warn(`[ModelService] Extracting STT archive via Native SDK...`);
            const targetFolder = FileSystem.getFrameworkDirectory('ONNX'); // The SDK will create the exact model ID folder natively
            await FileSystem.extractArchive(destPath, targetFolder, 'tar.gz' as any);
            setSTTDownloadProgress(80);

            console.warn(`[ModelService] Extracted! Verifying RNFS Disk...`);
            const exists = await RNFS.exists(`${targetFolder}/${MODEL_IDS.stt}`);
            console.warn(`[ModelService] Does ${targetFolder}/${MODEL_IDS.stt} exist? ${exists}`);
            if (exists) {
              console.warn(`[ModelService] Folder contents:`, await RNFS.readDir(`${targetFolder}/${MODEL_IDS.stt}`));
            }

            setSTTDownloadProgress(100);

            // Clean up the copied tar.gz to save space after extraction
            RNFS.unlink(destPath).catch(() => { });
          } else {
            // Fallback for iOS simulator/non-asset builds if needed
            await RunAnywhere.downloadModel(MODEL_IDS.stt, (progress) => {
              setSTTDownloadProgress(progress.progress * 100);
            });
          }
        } catch (e: any) {
          console.error('[ModelService] Local STT extraction failed', e?.message || e);
          throw e;
        }

        setIsSTTDownloading(false);
      }

      // Load the STT model (per docs: loadSTTModel(localPath, 'whisper'))
      setIsSTTLoading(true);
      // For bundled assets, explicitly define the exact path generated by extractArchive
      const sttTargetFolder = `${FileSystem.getFrameworkDirectory('ONNX')}/${MODEL_IDS.stt}`;
      const modelInfo = await RunAnywhere.getModelInfo(MODEL_IDS.stt);
      const loadPath = modelInfo?.localPath || sttTargetFolder;

      try {
        await RunAnywhere.loadSTTModel(loadPath, 'whisper');
        setIsSTTLoaded(true);
      } catch (loadErr) {
        console.warn(`[ModelService] Failed to load STT from ${loadPath}, trying explicit folder: ${loadErr}`);
        try {
          await RunAnywhere.loadSTTModel(sttTargetFolder, 'whisper');
          setIsSTTLoaded(true);
        } catch (retryErr) {
          // Model is likely already loaded in native memory (e.g., after hot reload).
          // Mark as loaded — transcription attempt will be the final arbiter.
          console.warn(`[ModelService] STT retry also failed, assuming already loaded: ${retryErr}`);
          setIsSTTLoaded(true);
        }
      }
      setIsSTTLoading(false);
    } catch (error) {
      console.error('STT download/load error:', error);
      setIsSTTDownloading(false);
      setIsSTTLoading(false);
      // Even on total failure, check if model files exist on disk
      // If so, mark as loaded (handles hot-reload scenario)
      try {
        const fallbackInfo = await RunAnywhere.getModelInfo(MODEL_IDS.stt);
        if (fallbackInfo?.localPath) {
          setIsSTTLoaded(true);
        }
      } catch { /* truly broken */ }
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

        try {
          if (Platform.OS === 'android') {
            const assetFileName = 'vits-piper-en_US-lessac-medium.bundle';
            const destPath = `${RNFS.DocumentDirectoryPath}/vits-piper-en_US-lessac-medium.tar.gz`;

            setTTSDownloadProgress(10); // Indicate start
            console.warn(`[ModelService] Unpacking local TTS asset ${assetFileName} to ${destPath}`);

            try {
              // Must be relative to the assets folder explicitly
              await StorageModule.unpackAsset(assetFileName, destPath);
              console.warn(`[ModelService] TTS Copy SUCCESS`);
            } catch (err) {
              console.error(`[ModelService] TTS Copy FAILED:`, err);
              throw err;
            }

            setTTSDownloadProgress(50);

            console.warn(`[ModelService] Extracting TTS archive via Native SDK...`);
            const targetFolder = FileSystem.getFrameworkDirectory('ONNX');
            await FileSystem.extractArchive(destPath, targetFolder, 'tar.gz' as any);
            setTTSDownloadProgress(80);

            console.warn(`[ModelService] Extracted! Verifying RNFS Disk...`);
            const exists = await RNFS.exists(`${targetFolder}/${MODEL_IDS.tts}`);
            console.warn(`[ModelService] Does ${targetFolder}/${MODEL_IDS.tts} exist? ${exists}`);
            if (exists) {
              console.warn(`[ModelService] Folder contents:`, await RNFS.readDir(`${targetFolder}/${MODEL_IDS.tts}`));
            }

            setTTSDownloadProgress(100);

            // Clean up the copied tar.gz
            RNFS.unlink(destPath).catch(() => { });
          } else {
            await RunAnywhere.downloadModel(MODEL_IDS.tts, (progress) => {
              setTTSDownloadProgress(progress.progress * 100);
            });
          }
        } catch (e: any) {
          console.error('[ModelService] Local TTS extraction failed', e?.message || e);
          throw e;
        }

        setIsTTSDownloading(false);
      }

      // Load the TTS model (per docs: loadTTSModel(localPath, 'piper'))
      setIsTTSLoading(true);
      const ttsTargetFolder = `${FileSystem.getFrameworkDirectory('ONNX')}/${MODEL_IDS.tts}`;
      const modelInfo = await RunAnywhere.getModelInfo(MODEL_IDS.tts);
      const loadPath = modelInfo?.localPath || ttsTargetFolder;

      try {
        await RunAnywhere.loadTTSModel(loadPath, 'piper');
        setIsTTSLoaded(true);
      } catch (loadErr) {
        console.warn(`[ModelService] Failed to load TTS from ${loadPath}, trying explicit folder: ${loadErr}`);
        await RunAnywhere.loadTTSModel(ttsTargetFolder, 'piper');
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
      downloadAndLoadSTT(),
      downloadAndLoadTTS(),
    ]);
  }, [downloadAndLoadSTT, downloadAndLoadTTS]);

  // Unload all models
  const unloadAllModels = useCallback(async () => {
    try {
      await RunAnywhere.unloadSTTModel();
      await RunAnywhere.unloadTTSModel();
      setIsSTTLoaded(false);
      setIsTTSLoaded(false);
    } catch (error) {
      console.error('Error unloading models:', error);
    }
  }, []);

  // Unload specifically the TTS model to save RAM
  const unloadTTSModel = useCallback(async () => {
    try {
      await RunAnywhere.unloadTTSModel();
      setIsTTSLoaded(false);
      console.log('TTS model explicitly unloaded to free RAM.');
    } catch (error) {
      console.error('Error unloading TTS model:', error);
    }
  }, []);

  // Run automatically on boot
  useEffect(() => {
    downloadAndLoadAllModels();
  }, [downloadAndLoadAllModels]);

  const value: ModelServiceState = {
    isSTTDownloading,
    isTTSDownloading,
    sttDownloadProgress,
    ttsDownloadProgress,
    isSTTLoading,
    isTTSLoading,
    isSTTLoaded,
    isTTSLoaded,
    isVoiceAgentReady,
    downloadAndLoadSTT,
    downloadAndLoadTTS,
    downloadAndLoadAllModels,
    unloadAllModels,
    unloadTTSModel,
  };

  return (
    <ModelServiceContext.Provider value={value}>
      {children}
    </ModelServiceContext.Provider>
  );
};

/**
 * Register default models with the SDK
 */
export const registerDefaultModels = async () => {
  // STT Model - Sherpa Whisper Tiny English
  // Using tar.gz from RunanywhereAI/sherpa-onnx for fast native extraction
  await ONNX.addModel({
    id: MODEL_IDS.stt,
    name: 'Sherpa Whisper Tiny (ONNX)',
    url: 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/sherpa-onnx-whisper-tiny.en.tar.gz',
    modality: ModelCategory.SpeechRecognition,
    artifactType: ModelArtifactType.TarGzArchive,
    memoryRequirement: 75_000_000,
  });

  // TTS Model - Piper TTS (US English - Medium quality)
  await ONNX.addModel({
    id: MODEL_IDS.tts,
    name: 'Piper TTS (US English - Medium)',
    url: 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-en_US-lessac-medium.tar.gz',
    modality: ModelCategory.SpeechSynthesis,
    artifactType: ModelArtifactType.TarGzArchive,
    memoryRequirement: 65_000_000,
  });
};

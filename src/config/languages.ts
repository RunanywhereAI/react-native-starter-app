/**
 * Language configuration for multi-language STT/TTS support
 * Per RunAnywhere docs: https://docs.runanywhere.ai/react-native/stt/options
 */

export interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  sttModelId?: string;
  ttsModelId?: string;
  sttModelUrl?: string;
  ttsModelUrl?: string;
}

/**
 * Supported languages with their model configurations
 * Models from: https://github.com/RunanywhereAI/sherpa-onnx/releases
 */
export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    sttModelId: 'sherpa-onnx-whisper-base.en',
    ttsModelId: 'vits-piper-en_US-lessac-medium',
    sttModelUrl:
      'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/sherpa-onnx-whisper-base.en.tar.gz',
    ttsModelUrl:
      'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-en_US-lessac-medium.tar.gz',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    sttModelId: 'sherpa-onnx-whisper-tiny-es',
    ttsModelId: 'vits-piper-es_ES-sharvard-medium',
    // Note: These are example URLs - actual multilingual models would need to be hosted
    sttModelUrl:
      'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/sherpa-onnx-whisper-tiny.tar.gz',
    ttsModelUrl:
      'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-es_ES-sharvard-medium.tar.gz',
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    sttModelId: 'sherpa-onnx-whisper-tiny-fr',
    ttsModelId: 'vits-piper-fr_FR-upmc-medium',
    sttModelUrl:
      'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/sherpa-onnx-whisper-tiny.tar.gz',
    ttsModelUrl:
      'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-fr_FR-upmc-medium.tar.gz',
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    sttModelId: 'sherpa-onnx-whisper-tiny-de',
    ttsModelId: 'vits-piper-de_DE-thorsten-medium',
    sttModelUrl:
      'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/sherpa-onnx-whisper-tiny.tar.gz',
    ttsModelUrl:
      'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-de_DE-thorsten-medium.tar.gz',
  },
  {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    flag: '🇨🇳',
    sttModelId: 'sherpa-onnx-whisper-tiny-zh',
    ttsModelId: 'vits-piper-zh_CN-huayan-medium',
    sttModelUrl:
      'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/sherpa-onnx-whisper-tiny.tar.gz',
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    sttModelId: 'sherpa-onnx-whisper-tiny-ja',
    ttsModelId: 'vits-piper-ja_JP-medium',
    sttModelUrl:
      'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/sherpa-onnx-whisper-tiny.tar.gz',
  },
];

/**
 * Get language configuration by code
 */
export const getLanguageByCode = (code: string): LanguageConfig | undefined => {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
};

/**
 * Get default language (English)
 */
export const getDefaultLanguage = (): LanguageConfig => {
  return SUPPORTED_LANGUAGES[0];
};

/**
 * Check if language has STT support
 */
export const hasSTTSupport = (code: string): boolean => {
  const lang = getLanguageByCode(code);
  return !!(lang?.sttModelId && lang?.sttModelUrl);
};

/**
 * Check if language has TTS support
 */
export const hasTTSSupport = (code: string): boolean => {
  const lang = getLanguageByCode(code);
  return !!(lang?.ttsModelId && lang?.ttsModelUrl);
};

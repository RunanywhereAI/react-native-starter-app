/**
 * 🔒 PRIVACY NOTICE
 * All speech processing runs locally on device using RunAnywhere SDK.
 * Audio is processed in memory and transcribed locally.
 * No audio data is sent to external servers.
 */

import { NativeModules, Platform, PermissionsAndroid } from 'react-native';
import { RunAnywhere } from '@runanywhere/core';

const { NativeAudioModule } = NativeModules;

// ============================================================================
// STT MODEL STATUS HELPERS
// NOTE: Model loading is handled by ModelService.downloadAndLoadSTT() in App.tsx
// ============================================================================

/**
 * Check if STT model is ready (async check with RunAnywhere SDK)
 */
export const checkSTTModelReady = async (): Promise<boolean> => {
  try {
    // First check if a model is actually loaded in the ONNX backend
    const isLoaded = await RunAnywhere.isSTTModelLoaded();
    if (isLoaded) {
      console.log('[SpeechService] ✅ STT model is loaded (isSTTModelLoaded=true)');
      return true;
    }

    // Fallback: check if model has a local path (downloaded but maybe not loaded)
    const modelInfo = await RunAnywhere.getModelInfo('sherpa-onnx-whisper-tiny.en');
    const hasLocalPath = !!modelInfo?.localPath;
    console.log('[SpeechService] STT model check: isLoaded=false, hasLocalPath=', hasLocalPath);
    
    if (hasLocalPath) {
      // Model is downloaded but not loaded - try to load it
      console.log('[SpeechService] 🔄 Model downloaded but not loaded, attempting to load...');
      try {
        await RunAnywhere.loadSTTModel(modelInfo!.localPath!, 'whisper');
        console.log('[SpeechService] ✅ STT model loaded successfully');
        return true;
      } catch (loadError) {
        console.error('[SpeechService] ❌ Failed to load STT model:', loadError);
        return false;
      }
    }

    return false;
  } catch (error) {
    console.log('[SpeechService] STT model check failed:', error);
    return false;
  }
};

export interface TranscriptionCallback {
  (text: string, timestamp: number): void;
}

export interface AudioLevelCallback {
  (level: number): void;
}

/**
 * SpeechService - Handles audio recording and speech-to-text
 */
export class SpeechService {
  private isRecording: boolean = false;
  private recordingPath: string | null = null;
  private recordingStartTime: number = 0;
  private audioLevelInterval: NodeJS.Timeout | null = null;
  private transcriptionInterval: NodeJS.Timeout | null = null;
  private transcriptionCallback: TranscriptionCallback | null = null;
  private audioLevelCallback: AudioLevelCallback | null = null;
  private lastTranscriptionTime: number = 0;

  /**
   * Request microphone permission (Android only)
   */
  async requestPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.log('[SpeechService] ✅ Platform is iOS, permission auto-granted');
      return true;
    }

    try {
      console.log('[SpeechService] 🎤 Requesting RECORD_AUDIO permission...');

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission',
          message: 'Latent needs access to your microphone to transcribe speech.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
      console.log(`[SpeechService] ${isGranted ? '✅' : '❌'} Permission ${granted}`);

      return isGranted;
    } catch (error) {
      console.error('[SpeechService] ❌ Permission error:', error);
      return false;
    }
  }

  /**
   * Start recording audio
   */
  async startRecording(
    onTranscription: TranscriptionCallback,
    onAudioLevel?: AudioLevelCallback
  ): Promise<boolean> {
    try {
      console.log('[SpeechService] 🎙️ startRecording() called');

      // Check native module
      if (!NativeAudioModule) {
        console.error('[SpeechService] ❌ NativeAudioModule not available');
        return false;
      }
      console.log('[SpeechService] ✅ NativeAudioModule available');

      // Request permission
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.error('[SpeechService] ❌ Microphone permission denied');
        return false;
      }
      console.log('[SpeechService] ✅ Microphone permission granted');

      // Start native recording
      console.log('[SpeechService] 📼 Starting native recording...');
      const result = await NativeAudioModule.startRecording();

      this.isRecording = true;
      this.recordingPath = result.path;
      this.recordingStartTime = Date.now();
      this.transcriptionCallback = onTranscription;
      this.audioLevelCallback = onAudioLevel || null;

      console.log('[SpeechService] ✅ Recording started');
      console.log('[SpeechService] 📁 Recording path:', result.path);
      console.log('[SpeechService] ⏰ Recording start time:', this.recordingStartTime);

      // Start audio level polling
      if (onAudioLevel) {
        this.startAudioLevelPolling();
        console.log('[SpeechService] 🎚️ Audio level polling started');
      }

      // Start continuous transcription (every 5 seconds)
      this.startContinuousTranscription();
      console.log('[SpeechService] 🔄 Continuous transcription started');

      return true;
    } catch (error) {
      console.error('[SpeechService] ❌ Error starting recording:', error);
      this.isRecording = false;
      return false;
    }
  }

  /**
   * Stop recording and transcribe
   */
  async stopRecording(): Promise<string | null> {
    try {
      if (!this.isRecording || !NativeAudioModule) {
        return null;
      }

      // Stop audio level polling
      this.stopAudioLevelPolling();

      // Stop continuous transcription
      this.stopContinuousTranscription();

      // Stop native recording
      console.log('[SpeechService] Stopping recording...');
      const result = await NativeAudioModule.stopRecording();

      this.isRecording = false;
      const audioPath = result.path || this.recordingPath;

      if (!audioPath) {
        console.error('[SpeechService] No audio path available');
        return null;
      }

      // Transcribe the audio
      console.log('[SpeechService] Transcribing audio...');
      const transcription = await this.transcribeAudio(audioPath);

      // Clean up
      this.recordingPath = null;
      this.transcriptionCallback = null;
      this.audioLevelCallback = null;

      return transcription;
    } catch (error) {
      console.error('[SpeechService] Error stopping recording:', error);
      this.isRecording = false;
      return null;
    }
  }

  /**
   * Cancel recording without transcribing
   */
  async cancelRecording(): Promise<void> {
    try {
      if (!this.isRecording || !NativeAudioModule) {
        return;
      }

      // Stop audio level polling
      this.stopAudioLevelPolling();

      // Stop continuous transcription
      this.stopContinuousTranscription();

      // Cancel native recording
      await NativeAudioModule.cancelRecording();

      this.isRecording = false;
      this.recordingPath = null;
      this.transcriptionCallback = null;
      this.audioLevelCallback = null;

      console.log('[SpeechService] Recording cancelled');
    } catch (error) {
      console.error('[SpeechService] Error cancelling recording:', error);
      this.isRecording = false;
    }
  }

  /**
   * Transcribe audio file using RunAnywhere STT
   */
  private async transcribeAudio(audioPath: string): Promise<string | null> {
    try {
      console.log('[SpeechService] 🎯 transcribeAudio() called');
      console.log('[SpeechService] 📁 Audio path:', audioPath);

      // Check if STT model is ready
      const modelReady = await checkSTTModelReady();
      if (!modelReady) {
        console.error('[SpeechService] ❌ STT model not ready');
        throw new Error('STT model not loaded. Please ensure the model is downloaded.');
      }

      console.log('[SpeechService] ✅ STT model ready');

      // Use RunAnywhere.transcribeFile() API for file-based transcription
      console.log('[SpeechService] 🤖 Running STT inference on file...');
      const result = await RunAnywhere.transcribeFile(audioPath);

      const transcription = result.text || '';
      console.log('[SpeechService] ✅ Transcription complete');
      console.log('[SpeechService] 📝 Text length:', transcription.length, 'chars');
      console.log('[SpeechService] 📝 Text:', transcription);

      // Call callback with transcription
      if (this.transcriptionCallback) {
        console.log('[SpeechService] 📤 Calling transcription callback');
        this.transcriptionCallback(transcription, Date.now());
      } else {
        console.log('[SpeechService] ⚠️ No transcription callback registered');
      }

      return transcription;
    } catch (error) {
      console.error('[SpeechService] ❌ Transcription error:', error);
      return null;
    }
  }

  /**
   * Start continuous transcription (every 5 seconds)
   * Uses NativeAudioModule.getRecordingSnapshot() to get a WAV file
   * of the accumulated audio, then transcribes it and sends only new text.
   */
  private startContinuousTranscription(): void {
    this.lastTranscriptionTime = Date.now();
    let lastTranscribedText = '';

    this.transcriptionInterval = setInterval(async () => {
      try {
        if (!this.isRecording) {
          return;
        }

        const currentTime = Date.now();

        // Only transcribe if 5 seconds have passed since last transcription
        if (currentTime - this.lastTranscriptionTime >= 5000) {
          console.log('[SpeechService] 🔄 Performing continuous transcription...');

          // Check if STT model is ready
          const modelReady = await checkSTTModelReady();
          if (!modelReady) {
            console.warn('[SpeechService] ⚠️ STT model not ready, skipping transcription');
            return;
          }

          // Get a snapshot of the current recording as a WAV file
          if (!NativeAudioModule) {
            console.warn('[SpeechService] ⚠️ NativeAudioModule not available');
            return;
          }

          try {
            const snapshot = await NativeAudioModule.getRecordingSnapshot();
            const snapshotPath = snapshot.path;

            if (!snapshotPath || snapshot.fileSize === 0) {
              console.log('[SpeechService] ⚠️ No audio data in snapshot yet');
              return;
            }

            console.log(
              '[SpeechService] 📸 Got recording snapshot:',
              snapshotPath,
              'size:',
              snapshot.fileSize
            );

            // Transcribe the snapshot file
            const result = await RunAnywhere.transcribeFile(snapshotPath);
            const fullText = (result.text || '').trim();

            console.log('[SpeechService] 📝 Full transcription length:', fullText.length, 'chars');

            if (fullText && fullText.length > 0) {
              // Calculate delta: only send the NEW text since last transcription
              let newText = fullText;

              if (lastTranscribedText && fullText.startsWith(lastTranscribedText)) {
                // The new transcription includes the old text, extract only the new part
                newText = fullText.substring(lastTranscribedText.length).trim();
              } else if (lastTranscribedText && fullText.length > lastTranscribedText.length) {
                // Texts diverged, send the full new text
                newText = fullText;
              }

              if (newText && newText.length > 0 && this.transcriptionCallback) {
                console.log('[SpeechService] ✅ New transcription text:', newText);
                this.transcriptionCallback(newText, currentTime);
                this.lastTranscriptionTime = currentTime;
              } else {
                console.log('[SpeechService] ⚠️ No new text since last transcription');
              }

              lastTranscribedText = fullText;
            } else {
              console.log('[SpeechService] ⚠️ Empty transcription result');
            }
          } catch (transcribeError) {
            console.log('[SpeechService] ⚠️ Continuous transcription skipped:', transcribeError);
          }
        }
      } catch (error) {
        console.error('[SpeechService] ❌ Continuous transcription error:', error);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop continuous transcription
   */
  private stopContinuousTranscription(): void {
    if (this.transcriptionInterval) {
      clearInterval(this.transcriptionInterval);
      this.transcriptionInterval = null;
    }
  }

  /**
   * Start polling audio levels
   */
  private startAudioLevelPolling(): void {
    let sampleCount = 0;

    this.audioLevelInterval = setInterval(async () => {
      try {
        if (!NativeAudioModule || !this.isRecording) {
          return;
        }

        const levelResult = await NativeAudioModule.getAudioLevel();
        const level = levelResult.level || 0;

        // Log first 3 samples for debugging
        if (sampleCount < 3) {
          console.log(`[SpeechService] 🎚️ Audio level sample ${sampleCount + 1}:`, level);
          sampleCount++;
        } else if (sampleCount === 3) {
          console.log('[SpeechService] 🎚️ Audio level polling working (further logs suppressed)');
          sampleCount++;
        }

        if (this.audioLevelCallback) {
          this.audioLevelCallback(level);
        }
      } catch (error) {
        // Ignore polling errors
      }
    }, 100); // Poll every 100ms
  }

  /**
   * Stop polling audio levels
   */
  private stopAudioLevelPolling(): void {
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }
  }

  /**
   * Get recording status
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get recording duration in milliseconds
   */
  getRecordingDuration(): number {
    if (!this.isRecording) {
      return 0;
    }
    return Date.now() - this.recordingStartTime;
  }

  /**
   * Cleanup on service destruction
   */
  cleanup(): void {
    this.stopAudioLevelPolling();
    this.stopContinuousTranscription();
    if (this.isRecording) {
      this.cancelRecording();
    }
  }
}

// Export singleton instance
export const speechService = new SpeechService();

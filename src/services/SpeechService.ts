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
    const modelInfo = await RunAnywhere.getModelInfo('sherpa-onnx-whisper-base.en');
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

      // Use the provided exact domain prompt bias string
      const DOMAIN_PROMPT = "This conversation includes words like salary, fresher, offer, budget, negotiation, interview, compensation, package, client, proposal, anchor, objection, startup, candidate.";
      console.log("[STT] Using domain prompt bias.");

      // Use RunAnywhere.transcribeFile() API for file-based transcription
      console.log('[SpeechService] 🤖 Running STT inference on file...');
      const result = await RunAnywhere.transcribeFile(audioPath, {
        initialPrompt: DOMAIN_PROMPT
      } as any);

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

  private startContinuousTranscription(): void {
    this.lastTranscriptionTime = Date.now();

    // Check interval every 500ms, but only transcribe when 1.5 seconds have passed
    this.transcriptionInterval = setInterval(async () => {
      try {
        if (!this.isRecording) return;

        const currentTime = Date.now();
        const timeSinceLast = currentTime - this.lastTranscriptionTime;

        // Extract and transcribe every 5.0 seconds for maximum stability and sentence context
        if (timeSinceLast >= 5000) {
          console.log(`[SpeechService] 🔄 Processing ${timeSinceLast}ms chunk...`);

          if (!NativeAudioModule) {
            console.warn('[SpeechService] ⚠️ NativeAudioModule not available');
            return;
          }

          try {
            // Get EXACTLY the audio recorded since the last transcription. No padding, no overlap.
            // This guarantees that Whisper evaluates the new chunk as a completely unique, sequential audio segment.
            const snapshot = await NativeAudioModule.getRecentAudioSnapshot(timeSinceLast);
            const snapshotPath = snapshot.path;

            if (!snapshotPath || snapshot.fileSize === 0) {
              console.log('[SpeechService] ⚠️ No audio data in snapshot yet');
              return;
            }

            console.log(
              `[SpeechService] 📸 Got ${timeSinceLast}ms snapshot:`,
              snapshotPath,
              'size:',
              snapshot.fileSize
            );

            // Use the provided exact domain prompt bias string
            const DOMAIN_PROMPT = "This conversation includes words like salary, fresher, offer, budget, negotiation, interview, compensation, package, client, proposal, anchor, objection, startup, candidate.";
            console.log("[STT] Using domain prompt bias.");

            // Transcribe the small snapshot file (O(1) time)
            const result = await RunAnywhere.transcribeFile(snapshotPath, {
              initialPrompt: DOMAIN_PROMPT
            } as any);
            const newText = (result.text || '').trim();

            if (newText && newText.length > 0) {
              // Sanitize whisper STT tokens that appear during silence
              const sanitized = newText
                .replace(/\[BLANK_AUDIO\]/g, '')
                .replace(/\[ Pause \]/gi, '')
                .replace(/\(Pause\)/gi, '')
                .trim();
                
              if (sanitized.length > 0) {
                console.log('[SpeechService] ✅ New chunk transcription:', sanitized);
                if (this.transcriptionCallback) {
                  this.transcriptionCallback(sanitized, currentTime);
                }
              } else {
                console.log('[SpeechService] ⚠️ Chunk was only silence/pause tokens');
              }
            } else {
              console.log('[SpeechService] ⚠️ Empty transcription result for chunk');
            }

            // Important: Only update time if successful, so we don't drop audio if it failed
            this.lastTranscriptionTime = currentTime;

          } catch (transcribeError) {
            console.log('[SpeechService] ⚠️ Continuous transcription skipped:', transcribeError);
          }
        }
      } catch (error) {
        console.error('[SpeechService] ❌ Continuous transcription error:', error);
      }
    }, 1000); // Check interval
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

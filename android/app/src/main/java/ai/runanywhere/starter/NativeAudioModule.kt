package ai.runanywhere.starter

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.util.Base64
import android.util.Log
import androidx.core.app.ActivityCompat
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.concurrent.thread

class NativeAudioModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NativeAudioModule"

    private var audioRecord: AudioRecord? = null
    private var isRecording = false
    private var recordingThread: Thread? = null
    private var recordedData: ByteArrayOutputStream? = null
    private var recordingFilePath: String? = null
    private var snapshotCounter = 0

    private var audioTrack: AudioTrack? = null
    private var isPlaying = false

    companion object {
        const val TAG = "NativeAudioModule"
        const val SAMPLE_RATE = 16000
        const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
    }

    @ReactMethod
    fun startRecording(promise: Promise) {
        if (isRecording) {
            promise.reject("ALREADY_RECORDING", "Recording is already in progress")
            return
        }

        // Check permission
        if (ActivityCompat.checkSelfPermission(
                reactApplicationContext,
                Manifest.permission.RECORD_AUDIO
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            promise.reject("PERMISSION_DENIED", "Microphone permission not granted")
            return
        }

        try {
            val bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)
            
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                CHANNEL_CONFIG,
                AUDIO_FORMAT,
                bufferSize * 2
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                promise.reject("INIT_FAILED", "Failed to initialize AudioRecord")
                return
            }

            recordedData = ByteArrayOutputStream()
            snapshotCounter = 0
            isRecording = true

            // Create the recording WAV file path upfront
            val tempFile = File(reactApplicationContext.cacheDir, "recording_live.wav")
            recordingFilePath = tempFile.absolutePath
            Log.d(TAG, "Recording will be saved to: $recordingFilePath")

            audioRecord?.startRecording()

            // Start recording thread
            recordingThread = thread {
                val buffer = ByteArray(bufferSize)
                while (isRecording) {
                    val bytesRead = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                    if (bytesRead > 0) {
                        synchronized(recordedData!!) {
                            recordedData?.write(buffer, 0, bytesRead)
                        }
                    }
                }
            }

            val result = Arguments.createMap().apply {
                putString("status", "recording")
                putString("path", recordingFilePath)
            }
            Log.d(TAG, "Recording started, path: $recordingFilePath")
            promise.resolve(result)

        } catch (e: Exception) {
            promise.reject("RECORDING_ERROR", "Failed to start recording: ${e.message}", e)
        }
    }

    /**
     * Create a snapshot WAV file from the current recorded audio data.
     * This allows mid-recording transcription without stopping the recording.
     * Each call writes the accumulated audio so far to a new temp file.
     */
    @ReactMethod
    fun getRecordingSnapshot(promise: Promise) {
        if (!isRecording || recordedData == null) {
            promise.reject("NOT_RECORDING", "No recording in progress")
            return
        }

        try {
            val pcmData = synchronized(recordedData!!) {
                recordedData?.toByteArray() ?: ByteArray(0)
            }

            if (pcmData.isEmpty()) {
                Log.d(TAG, "Snapshot: No audio data yet")
                val result = Arguments.createMap().apply {
                    putString("path", "")
                    putInt("fileSize", 0)
                }
                promise.resolve(result)
                return
            }

            // Create WAV from accumulated PCM data
            val wavData = createWavFromPcm(pcmData, SAMPLE_RATE, 1, 16)

            // Write to a snapshot file (use counter to avoid file locking issues)
            snapshotCounter++
            val snapshotFile = File(reactApplicationContext.cacheDir, "recording_snapshot_${snapshotCounter % 2}.wav")
            FileOutputStream(snapshotFile).use { it.write(wavData) }

            Log.d(TAG, "Snapshot created: ${snapshotFile.absolutePath}, size: ${wavData.size} bytes, PCM: ${pcmData.size} bytes")

            val result = Arguments.createMap().apply {
                putString("path", snapshotFile.absolutePath)
                putInt("fileSize", wavData.size)
                putDouble("durationMs", (pcmData.size.toDouble() / (SAMPLE_RATE * 2)) * 1000)
            }
            promise.resolve(result)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to create snapshot: ${e.message}", e)
            promise.reject("SNAPSHOT_ERROR", "Failed to create recording snapshot: ${e.message}", e)
        }
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        if (!isRecording) {
            promise.reject("NOT_RECORDING", "No recording in progress")
            return
        }

        try {
            isRecording = false
            recordingThread?.join(1000)
            
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null

            val pcmData = synchronized(recordedData!!) {
                recordedData?.toByteArray() ?: ByteArray(0)
            }
            recordedData = null

            // Create WAV file
            val wavData = createWavFromPcm(pcmData, SAMPLE_RATE, 1, 16)
            val base64Audio = Base64.encodeToString(wavData, Base64.NO_WRAP)

            // Save to final file
            val tempFile = File(reactApplicationContext.cacheDir, "recording_${System.currentTimeMillis()}.wav")
            FileOutputStream(tempFile).use { it.write(wavData) }
            recordingFilePath = tempFile.absolutePath

            // Clean up snapshot files
            cleanupSnapshots()

            Log.d(TAG, "Recording stopped, saved to: $recordingFilePath, size: ${wavData.size} bytes")

            val result = Arguments.createMap().apply {
                putString("status", "stopped")
                putString("path", recordingFilePath)
                putInt("fileSize", wavData.size)
                putString("audioBase64", base64Audio)
            }
            promise.resolve(result)

        } catch (e: Exception) {
            promise.reject("STOP_ERROR", "Failed to stop recording: ${e.message}", e)
        }
    }

    @ReactMethod
    fun cancelRecording(promise: Promise) {
        try {
            isRecording = false
            recordingThread?.join(500)
            
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null
            recordedData = null
            recordingFilePath = null

            // Clean up snapshot files
            cleanupSnapshots()

            promise.resolve(true)
        } catch (e: Exception) {
            // Ignore errors during cancel
            promise.resolve(true)
        }
    }

    private fun cleanupSnapshots() {
        try {
            for (i in 0..1) {
                val snapshotFile = File(reactApplicationContext.cacheDir, "recording_snapshot_$i.wav")
                if (snapshotFile.exists()) {
                    snapshotFile.delete()
                }
            }
            val liveFile = File(reactApplicationContext.cacheDir, "recording_live.wav")
            if (liveFile.exists()) {
                liveFile.delete()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to cleanup snapshots: ${e.message}")
        }
    }

    @ReactMethod
    fun getAudioLevel(promise: Promise) {
        if (!isRecording || audioRecord == null) {
            val result = Arguments.createMap().apply {
                putDouble("level", 0.0)
            }
            promise.resolve(result)
            return
        }

        try {
            // Return a simulated audio level based on recent data
            val level = synchronized(recordedData!!) {
                val data = recordedData?.toByteArray() ?: return@synchronized 0.0
                if (data.size < 2) return@synchronized 0.0
                
                // Calculate RMS of last chunk
                val lastChunk = data.takeLast(minOf(1024, data.size))
                var sum = 0.0
                for (i in lastChunk.indices step 2) {
                    if (i + 1 < lastChunk.size) {
                        val sample = (lastChunk[i].toInt() and 0xFF) or (lastChunk[i + 1].toInt() shl 8)
                        sum += sample * sample
                    }
                }
                kotlin.math.sqrt(sum / (lastChunk.size / 2)) / 32768.0
            }
            val result = Arguments.createMap().apply {
                putDouble("level", level)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            val result = Arguments.createMap().apply {
                putDouble("level", 0.0)
            }
            promise.resolve(result)
        }
    }

    @ReactMethod
    fun playAudioBase64(base64String: String, sampleRate: Int, promise: Promise) {
        try {
            stopPlaybackInternal()

            val audioData = Base64.decode(base64String, Base64.DEFAULT)
            
            // Check if it's a WAV file and extract PCM data
            val pcmData = if (audioData.size > 44 && 
                audioData[0].toInt().toChar() == 'R' && 
                audioData[1].toInt().toChar() == 'I' &&
                audioData[2].toInt().toChar() == 'F' &&
                audioData[3].toInt().toChar() == 'F') {
                // It's a WAV file, extract PCM data (skip 44-byte header)
                audioData.copyOfRange(44, audioData.size)
            } else {
                audioData
            }

            val actualSampleRate = if (sampleRate > 0) sampleRate else SAMPLE_RATE
            val bufferSize = AudioTrack.getMinBufferSize(
                actualSampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            )

            audioTrack = AudioTrack.Builder()
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setSampleRate(actualSampleRate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .build()
                )
                .setBufferSizeInBytes(maxOf(bufferSize, pcmData.size))
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build()

            audioTrack?.write(pcmData, 0, pcmData.size)
            audioTrack?.play()
            isPlaying = true

            // Monitor playback completion
            thread {
                while (isPlaying && audioTrack?.playState == AudioTrack.PLAYSTATE_PLAYING) {
                    Thread.sleep(100)
                    if (audioTrack?.playbackHeadPosition ?: 0 >= pcmData.size / 2) {
                        break
                    }
                }
                stopPlaybackInternal()
            }

            promise.resolve(true)

        } catch (e: Exception) {
            promise.reject("PLAYBACK_ERROR", "Failed to play audio: ${e.message}", e)
        }
    }

    @ReactMethod
    fun playAudio(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "Audio file not found: $filePath")
                return
            }

            val audioData = file.readBytes()
            val base64 = Base64.encodeToString(audioData, Base64.NO_WRAP)
            playAudioBase64(base64, SAMPLE_RATE, promise)

        } catch (e: Exception) {
            promise.reject("PLAYBACK_ERROR", "Failed to play audio file: ${e.message}", e)
        }
    }

    @ReactMethod
    fun stopPlayback(promise: Promise) {
        stopPlaybackInternal()
        promise.resolve(true)
    }

    private fun stopPlaybackInternal() {
        isPlaying = false
        audioTrack?.stop()
        audioTrack?.release()
        audioTrack = null
    }

    @ReactMethod
    fun speak(text: String, promise: Promise) {
        // Simple TTS using Android's built-in TTS (fallback)
        promise.reject("NOT_IMPLEMENTED", "Use RunAnywhere.synthesize() instead")
    }

    @ReactMethod
    fun stopSpeaking(promise: Promise) {
        stopPlaybackInternal()
        promise.resolve(true)
    }

    private fun createWavFromPcm(pcmData: ByteArray, sampleRate: Int, channels: Int, bitsPerSample: Int): ByteArray {
        val byteRate = sampleRate * channels * bitsPerSample / 8
        val blockAlign = channels * bitsPerSample / 8
        val dataSize = pcmData.size
        val fileSize = 36 + dataSize

        val header = ByteBuffer.allocate(44).apply {
            order(ByteOrder.LITTLE_ENDIAN)
            // RIFF header
            put('R'.code.toByte())
            put('I'.code.toByte())
            put('F'.code.toByte())
            put('F'.code.toByte())
            putInt(fileSize)
            put('W'.code.toByte())
            put('A'.code.toByte())
            put('V'.code.toByte())
            put('E'.code.toByte())
            // fmt subchunk
            put('f'.code.toByte())
            put('m'.code.toByte())
            put('t'.code.toByte())
            put(' '.code.toByte())
            putInt(16) // Subchunk1Size for PCM
            putShort(1) // AudioFormat (1 = PCM)
            putShort(channels.toShort())
            putInt(sampleRate)
            putInt(byteRate)
            putShort(blockAlign.toShort())
            putShort(bitsPerSample.toShort())
            // data subchunk
            put('d'.code.toByte())
            put('a'.code.toByte())
            put('t'.code.toByte())
            put('a'.code.toByte())
            putInt(dataSize)
        }

        return header.array() + pcmData
    }
}

import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import * as RNFS from 'react-native-fs';
import { AppColors } from '../theme';
import { useModelService } from '../services/ModelService';
import { ModelLoaderWidget } from '../components';
import { VLMService } from '../services/VLMService';

// Small, describable sample photos. Selecting one downloads it to the app's
// cache directory and feeds the on-disk path to the VLM (which reads image
// files directly via VLM_IMAGE_FORMAT_FILE_PATH). Users can also paste a
// custom image URL or a local file path.
const SAMPLE_IMAGES: ReadonlyArray<{ id: string; label: string; url: string }> = [
  { id: 'dog', label: '🐶 Dog', url: 'https://picsum.photos/id/237/512/512' },
  { id: 'nature', label: '🏔 Nature', url: 'https://picsum.photos/id/1015/512/512' },
  { id: 'city', label: '🏙 City', url: 'https://picsum.photos/id/1067/512/512' },
];

const DEFAULT_PROMPT = 'Describe what you see in this image.';
const MAX_TOKENS = 200;

export const VisionScreen: React.FC = () => {
  const modelService = useModelService();
  const vlmService = useMemo(() => new VLMService(), []);

  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [customSource, setCustomSource] = useState('');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const descriptionRef = useRef('');

  /**
   * Resolve an image source (remote URL or local path) to a plain on-disk file
   * path the native VLM backend can read.
   */
  const resolveImageToLocalPath = async (source: string): Promise<string> => {
    const trimmed = source.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      const destination = `${RNFS.CachesDirectoryPath}/vlm_input_${Date.now()}.jpg`;
      if (await RNFS.exists(destination)) {
        await RNFS.unlink(destination).catch(() => {});
      }
      const { promise } = RNFS.downloadFile({
        fromUrl: trimmed,
        toFile: destination,
      });
      const result = await promise;
      if (result.statusCode && result.statusCode >= 400) {
        throw new Error(`Failed to download image (HTTP ${result.statusCode})`);
      }
      return destination;
    }
    // Local path — strip any file:// scheme prefix.
    return trimmed.replace('file://', '');
  };

  const describe = async (source: string) => {
    if (isProcessing || !source.trim()) return;

    setIsProcessing(true);
    setError(null);
    setDescription('');
    descriptionRef.current = '';

    try {
      const localPath = await resolveImageToLocalPath(source);
      setPreviewUri(`file://${localPath}`);

      await vlmService.processImage(
        localPath,
        prompt.trim() || DEFAULT_PROMPT,
        MAX_TOKENS,
        (token) => {
          descriptionRef.current += token;
          setDescription(descriptionRef.current);
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStop = () => {
    vlmService.cancel();
    setIsProcessing(false);
  };

  // Gate the screen on a loaded vision model, mirroring the other screens.
  if (!modelService.isVLMLoaded) {
    return (
      <ModelLoaderWidget
        title="Vision Model Required"
        subtitle="Download and load the vision-language model to describe images"
        icon="vision"
        accentColor={AppColors.accentOrange}
        isDownloading={modelService.isVLMDownloading}
        isLoading={modelService.isVLMLoading}
        progress={modelService.vlmDownloadProgress}
        onLoad={modelService.downloadAndLoadVLM}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Image Preview */}
        <View style={styles.previewCard}>
          {previewUri ? (
            <Image
              source={{ uri: previewUri }}
              style={styles.previewImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Text style={styles.previewIcon}>🖼</Text>
              <Text style={styles.previewHint}>
                Pick a sample image or paste an image URL below
              </Text>
            </View>
          )}
          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.processingText}>Analyzing...</Text>
            </View>
          )}
        </View>

        {/* Sample images */}
        <Text style={styles.sectionLabel}>Sample Images</Text>
        <View style={styles.sampleRow}>
          {SAMPLE_IMAGES.map((sample) => (
            <TouchableOpacity
              key={sample.id}
              style={styles.sampleChip}
              onPress={() => describe(sample.url)}
              disabled={isProcessing}
              activeOpacity={0.8}
            >
              <Text style={styles.sampleChipText}>{sample.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom source */}
        <Text style={styles.sectionLabel}>Custom Image URL or Path</Text>
        <TextInput
          style={styles.input}
          placeholder="https://... or /path/to/image.jpg"
          placeholderTextColor={AppColors.textMuted}
          value={customSource}
          onChangeText={setCustomSource}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isProcessing}
        />

        {/* Prompt */}
        <Text style={styles.sectionLabel}>Prompt</Text>
        <TextInput
          style={[styles.input, styles.promptInput]}
          value={prompt}
          onChangeText={setPrompt}
          multiline
          editable={!isProcessing}
        />

        {/* Description */}
        {(description || error) && (
          <View style={styles.descriptionCard}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {error ? 'ERROR' : 'DESCRIPTION'}
              </Text>
            </View>
            <Text style={[styles.descriptionText, error && styles.errorText]}>
              {error ?? description}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Action bar */}
      <View style={styles.actionBar}>
        {isProcessing ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.stopButton]}
            onPress={handleStop}
            activeOpacity={0.85}
          >
            <Text style={styles.actionButtonText}>⏹  Stop</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.actionButton,
              !customSource.trim() && styles.actionButtonDisabled,
            ]}
            onPress={() => describe(customSource)}
            disabled={!customSource.trim()}
            activeOpacity={0.85}
          >
            <Text style={styles.actionButtonText}>👁  Describe Image</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.primaryDark,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  previewCard: {
    height: 240,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: AppColors.surfaceCard,
    borderWidth: 1,
    borderColor: AppColors.accentOrange + '33',
    marginBottom: 20,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  previewIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  previewHint: {
    fontSize: 13,
    color: AppColors.textSecondary,
    textAlign: 'center',
  },
  processingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.textMuted,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sampleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  sampleChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: AppColors.surfaceCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppColors.accentOrange + '40',
  },
  sampleChipText: {
    fontSize: 14,
    color: AppColors.textPrimary,
    fontWeight: '500',
  },
  input: {
    backgroundColor: AppColors.surfaceCard,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: AppColors.textPrimary,
    borderWidth: 1,
    borderColor: AppColors.textMuted + '1A',
    marginBottom: 20,
  },
  promptInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  descriptionCard: {
    padding: 20,
    backgroundColor: AppColors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.accentOrange + '40',
    marginBottom: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: AppColors.accentOrange + '33',
    borderRadius: 8,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.accentOrange,
  },
  descriptionText: {
    fontSize: 15,
    color: AppColors.textPrimary,
    lineHeight: 22,
  },
  errorText: {
    color: AppColors.error,
  },
  actionBar: {
    padding: 20,
    backgroundColor: AppColors.surfaceCard + 'CC',
    borderTopWidth: 1,
    borderTopColor: AppColors.textMuted + '1A',
  },
  actionButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: AppColors.accentOrange,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  stopButton: {
    backgroundColor: AppColors.error,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

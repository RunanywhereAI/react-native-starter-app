/**
 * VLMService - thin wrapper around the RunAnywhere Vision-Language APIs.
 *
 * Mirrors the sample app's VLMService
 * (runanywhere-sdks/examples/react-native/RunAnywhereAI/src/services/VLMService.ts):
 * load a MULTIMODAL model, then stream a description of an image file with
 * `RunAnywhere.processImageStream`.
 *
 * Uses ONLY published `@runanywhere/core` public APIs.
 */

import { RunAnywhere } from '@runanywhere/core';
import {
  ModelCategory,
  CurrentModelRequest,
} from '@runanywhere/proto-ts/model_types';
import {
  VLMGenerationOptions,
  VLMImage,
  VLMImageFormat,
} from '@runanywhere/proto-ts/vlm_options';

export class VLMService {
  /**
   * Check whether a vision-language model is currently loaded, straight from
   * the SDK lifecycle state (MULTIMODAL category).
   */
  async isModelLoaded(): Promise<boolean> {
    try {
      const result = await RunAnywhere.currentModel(
        CurrentModelRequest.fromPartial({
          category: ModelCategory.MODEL_CATEGORY_MULTIMODAL,
          includeModelMetadata: false,
        })
      );
      return result?.found === true && result.modelId.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Process an image and stream description tokens back through `onToken`.
   *
   * `imagePath` must be a plain on-disk file path (no `file://` prefix); the
   * native VLM backend reads it directly via VLM_IMAGE_FORMAT_FILE_PATH.
   */
  async processImage(
    imagePath: string,
    prompt: string,
    maxTokens: number,
    onToken: (token: string) => void
  ): Promise<void> {
    if (!(await this.isModelLoaded())) {
      throw new Error('Model not loaded. Please load a vision model first.');
    }

    const image = VLMImage.fromPartial({
      format: VLMImageFormat.VLM_IMAGE_FORMAT_FILE_PATH,
      filePath: imagePath,
      width: 0,
      height: 0,
      sizeBytes: 0,
      metadata: {},
    });

    const stream = await RunAnywhere.processImageStream(
      image,
      VLMGenerationOptions.fromPartial({
        prompt,
        maxTokens,
        streamingEnabled: true,
      })
    );

    // Manual async iteration — Hermes does not support `for await...of` over
    // NitroModules async iterables.
    const iter = stream[Symbol.asyncIterator]();
    let result = await iter.next();
    while (!result.done) {
      const event = result.value;
      if (event.token) {
        onToken(event.token);
      }
      if (event.result) {
        break;
      }
      result = await iter.next();
    }
  }

  /** Cancel any in-flight VLM generation. */
  cancel(): void {
    RunAnywhere.cancelVLMGeneration().catch(() => {});
  }
}

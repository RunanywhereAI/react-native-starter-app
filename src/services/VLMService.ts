/**
 * VLMService - thin wrapper around the RunAnywhere Vision-Language APIs.
 *
 * Load a MULTIMODAL model, then stream a description of an image file with
 * `RunAnywhere.vlm.generateStream`.
 *
 * Uses ONLY published `@runanywhere/core` public APIs.
 */

import { RunAnywhere, ImageInputs } from '@runanywhere/core';
import type { GenerationEvent } from '@runanywhere/core';
import { ModelCategory } from '@runanywhere/proto-ts/model_types';

export class VLMService {
  /** The in-flight generation stream, so `cancel()` can close it. */
  private stream: AsyncIterator<GenerationEvent> | null = null;

  /**
   * Check whether a vision-language model is currently loaded, straight from
   * the SDK lifecycle state (MULTIMODAL category).
   */
  async isModelLoaded(): Promise<boolean> {
    try {
      const model = await RunAnywhere.models.loaded(
        ModelCategory.MODEL_CATEGORY_MULTIMODAL
      );
      return (model?.id.length ?? 0) > 0;
    } catch {
      return false;
    }
  }

  /**
   * Process an image and stream description tokens back through `onToken`.
   *
   * `imagePath` must be a plain on-disk file path (no `file://` prefix); the
   * native VLM backend reads it directly.
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

    // Manual async iteration — Hermes does not support `for await...of` over
    // NitroModules async iterables.
    const iterator = RunAnywhere.vlm
      .generateStream(ImageInputs.file(imagePath), prompt, {
        maxOutputTokens: maxTokens,
      })
      [Symbol.asyncIterator]();
    this.stream = iterator;

    try {
      for (;;) {
        const step = await iterator.next();
        if (step.done) break;
        const event = step.value;
        if (event.type === 'token') {
          onToken(event.text);
        } else if (event.type === 'failed') {
          throw event.error;
        } else if (event.type === 'completed') {
          break;
        }
      }
    } finally {
      this.stream = null;
    }
  }

  /** Cancel any in-flight VLM generation. */
  cancel(): void {
    // Closing the stream is what cancels the native generation now.
    void this.stream?.return?.(undefined);
    this.stream = null;
  }
}

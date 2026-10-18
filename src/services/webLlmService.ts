/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CreateMLCEngine, MLCEngine, InitProgressReport } from '@mlc-ai/web-llm';

export interface WebLLMModelOption {
  id: string;
  name: string;
  description: string;
  size: string;
  recommended?: boolean;
}

export const AVAILABLE_OPENSOURCE_MODELS: WebLLMModelOption[] = [
  {
    id: 'SmolLM2-135M-Instruct-q4f16_1-MLC',
    name: 'SmolLM2 135M Instruct',
    description: 'Ultra-lightweight open-source model (~135M params) by HuggingFaceTB. Fast downloads and quick inference on WebGPU.',
    size: '~120 MB',
    recommended: true,
  },
  {
    id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen2.5 0.5B Instruct',
    description: 'Open-source 500M instruction-tuned model by Qwen. Excellent for task extraction, reasoning, and document queries.',
    size: '~350 MB',
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 1B Instruct',
    description: 'Meta open-source 1B parameter model. High quality reasoning for desktop GPUs.',
    size: '~750 MB',
  },
];

class WebLLMService {
  private engine: MLCEngine | null = null;
  private currentModelId: string | null = null;
  private isInitializing = false;

  public checkWebGPUSupport(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator && !!navigator.gpu;
  }

  public async getEngine(
    modelId: string,
    onProgress?: (report: InitProgressReport) => void
  ): Promise<MLCEngine> {
    if (this.engine && this.currentModelId === modelId) {
      return this.engine;
    }

    if (this.isInitializing) {
      throw new Error('A model is currently loading. Please wait.');
    }

    if (!this.checkWebGPUSupport()) {
      throw new Error(
        'WebGPU is not enabled or available in this browser environment. WebGPU is required for in-browser open-source model weights execution.'
      );
    }

    this.isInitializing = true;
    try {
      this.engine = await CreateMLCEngine(modelId, {
        initProgressCallback: onProgress,
        logLevel: 'WARN',
      });
      this.currentModelId = modelId;
      return this.engine;
    } finally {
      this.isInitializing = false;
    }
  }

  public isLoaded(modelId?: string): boolean {
    if (!modelId) return !!this.engine;
    return !!this.engine && this.currentModelId === modelId;
  }

  public getLoadedModelId(): string | null {
    return this.currentModelId;
  }

  public async generateChatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    onStreamToken?: (token: string) => void
  ): Promise<string> {
    if (!this.engine) {
      throw new Error('WebLLM engine is not loaded.');
    }

    if (onStreamToken) {
      const asyncChunkGenerator = await this.engine.chat.completions.create({
        messages,
        temperature: 0.6,
        max_tokens: 512,
        stream: true,
      });

      let fullText = '';
      for await (const chunk of asyncChunkGenerator) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullText += delta;
          onStreamToken(delta);
        }
      }
      return fullText;
    } else {
      const completion = await this.engine.chat.completions.create({
        messages,
        temperature: 0.6,
        max_tokens: 512,
      });
      return completion.choices[0]?.message?.content || '';
    }
  }

  public async unload(): Promise<void> {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
      this.currentModelId = null;
    }
  }
}

export const webLLMService = new WebLLMService();

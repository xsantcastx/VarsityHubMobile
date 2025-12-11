import { captureException } from '@/utils/sentry';
import { InvokeLLM } from './integrations';

/**
 * Wrapper for OpenAI/ChatGPT Codex with timeout, retry, and error handling
 */

interface CodexRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

interface CodexResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Make a request to Codex with timeout and retry logic
 */
export async function invokeCodex(
  request: CodexRequest,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  retries: number = MAX_RETRIES
): Promise<CodexResponse> {
  try {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Codex request timeout after ${timeoutMs}ms - stream disconnected`
            )
          ),
        timeoutMs
      )
    );

    // Create request promise
    const requestPromise = (async () => {
      try {
        const response = await InvokeLLM({
          prompt: request.prompt,
          maxTokens: request.maxTokens || 500,
          temperature: request.temperature || 0.7,
        });

        if (!response || typeof response !== 'object') {
          throw new Error('Invalid response from Codex');
        }

        return {
          text:
            (response as any).text ||
            (response as any).content ||
            (response as any).message ||
            JSON.stringify(response),
          usage: (response as any).usage,
        } as CodexResponse;
      } catch (error: any) {
        console.error('[codex] Request error:', error?.message);
        throw error;
      }
    })();

    // Race between request and timeout
    return await Promise.race([requestPromise, timeoutPromise]);
  } catch (error: any) {
    console.error(
      '[codex] Attempt failed:',
      error?.message,
      `(${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`
    );

    // Handle stream disconnection or timeout errors
    if (
      (error.message?.includes('stream') ||
        error.message?.includes('timeout') ||
        error.message?.includes('disconnect')) &&
      retries > 0
    ) {
      console.log(
        `[codex] Retrying in ${RETRY_DELAY_MS}ms... (${retries} attempts left)`
      );
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return invokeCodex(request, timeoutMs, retries - 1);
    }

    // Final error handling
    const errorMessage = error?.message || 'Unknown error';
    captureException(error, {
      context: 'codex-invoke',
      prompt: request.prompt?.substring(0, 100),
      retriesRemaining: retries,
    });

    // Return fallback response instead of throwing
    console.warn('[codex] All retries exhausted, returning fallback response');
    return {
      text: `Unable to process your request at this time. ${errorMessage}. Please try again in a moment.`,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }
}

/**
 * Stream version for real-time responses
 */
export async function invokeCodexStream(
  request: CodexRequest,
  onChunk: (chunk: string) => void,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  retries: number = MAX_RETRIES
): Promise<void> {
  try {
    let completed = false;
    const timeoutId = setTimeout(() => {
      if (!completed) {
        throw new Error(
          `Stream timeout after ${timeoutMs}ms - stream disconnected`
        );
      }
    }, timeoutMs);

    try {
      const response = await InvokeLLM({
        prompt: request.prompt,
        maxTokens: request.maxTokens || 500,
        temperature: request.temperature || 0.7,
        stream: true, // Enable streaming if supported
      });

      // Handle chunked response
      if (response && typeof response === 'string') {
        onChunk(response);
      } else if (response && typeof response === 'object') {
        const text = (response as any).text ||
          (response as any).content ||
          (response as any).message || (response as any);
        onChunk(typeof text === 'string' ? text : JSON.stringify(text));
      }

      completed = true;
      clearTimeout(timeoutId);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error: any) {
    console.error('[codex-stream] Attempt failed:', error?.message);

    // Retry logic for streams
    if (
      (error.message?.includes('stream') ||
        error.message?.includes('timeout') ||
        error.message?.includes('disconnect')) &&
      retries > 0
    ) {
      console.log(`[codex-stream] Retrying... (${retries} attempts left)`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return invokeCodexStream(request, onChunk, timeoutMs, retries - 1);
    }

    // Fallback for stream failure
    captureException(error, {
      context: 'codex-stream',
      prompt: request.prompt?.substring(0, 100),
    });
    onChunk(
      `[Error: Unable to process stream. ${error?.message}. Please try again.]`
    );
  }
}

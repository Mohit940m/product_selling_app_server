import { ApiError } from '../client/apiClient.js';

/**
 * Shared helpers for MCP tool handlers: consistent JSON text output and
 * error-to-tool-result mapping so a failing API call never crashes the server.
 */

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

/** Wrap a JSON-serialisable value as a successful tool result. */
export function jsonResult(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/** Wrap a message as an error tool result. */
export function errorResult(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

/**
 * Run a tool handler and translate thrown errors (ApiError or otherwise) into
 * an error tool result rather than letting them propagate.
 */
export async function runTool(
  fn: () => Promise<ToolResult>,
): Promise<ToolResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return errorResult(`API error (${err.status}): ${err.message}`);
    }
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(`Unexpected error: ${message}`);
  }
}

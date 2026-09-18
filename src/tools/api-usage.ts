import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { Flightradar24ApiClient } from '../api-client.js';

// New tool: the real FR24 API is credit-metered (every call costs credits
// based on how many entities are returned), so exposing the usage/credits
// report is important for users to monitor spend. No legacy equivalent
// existed because the old, non-official endpoints were not credit-metered.
export const getApiUsageToolSchema = {
  name: 'get_api_usage',
  description:
    'Get a summary of FR24 API credit usage per endpoint. Note: FR24 rate-limits this endpoint to 1 call per minute.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  outputSchema: {
    type: 'object',
    properties: {
      usage: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            endpoint: { type: 'string' },
            request_count: { type: 'number' },
            credits: { type: 'number' },
          },
        },
      },
      timestamp: { type: 'string' },
    },
    required: ['usage', 'timestamp'],
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  },
};

export async function getApiUsageTool(apiClient: Flightradar24ApiClient) {
  try {
    const usage = await apiClient.getUsage();

    const result = {
      usage,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      structuredContent: result,
    };
  } catch (error) {
    if (error instanceof ProtocolError) {
      throw error;
    }

    throw new ProtocolError(
      ProtocolErrorCode.InternalError,
      `Error retrieving API usage: ${(error as Error).message}`
    );
  }
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiRequest } from '../client/apiClient.js';
import { USER_TOKEN } from '../config.js';
import { jsonResult, runTool } from './helpers.js';

/**
 * Authenticated buyer profile tool (requires MCP_API_TOKEN).
 *
 * - get_profile -> GET /api/v1/user/profile
 */
export function registerProfileTools(server: McpServer): void {
  server.registerTool(
    'get_profile',
    {
      title: 'Get profile',
      description:
        "Get the authenticated user's profile (name, contact, verification flags, default address).",
      inputSchema: {},
    },
    async () =>
      runTool(async () => {
        const data = await apiRequest({
          method: 'GET',
          path: '/api/v1/user/profile',
          token: USER_TOKEN,
        });
        return jsonResult(data);
      }),
  );
}

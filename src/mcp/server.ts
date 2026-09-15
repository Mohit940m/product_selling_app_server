import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './createServer.js';
import { API_BASE_URL, SELLER_TOKEN, USER_TOKEN } from './config.js';

/**
 * stdio entry point (npm run mcp). One process acts as the buyer and seller
 * identified by MCP_API_TOKEN / MCP_SELLER_API_TOKEN. For per-user access
 * over HTTP (the agent service), see http.ts.
 */
async function main(): Promise<void> {
  const server = createMcpServer({ userToken: USER_TOKEN, sellerToken: SELLER_TOKEN }, 'all');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is reserved for the MCP protocol; log to stderr.
  console.error(`MCP server connected (stdio). API base URL: ${API_BASE_URL}`);
}

main().catch((err) => {
  console.error('Fatal error starting MCP server:', err);
  process.exit(1);
});

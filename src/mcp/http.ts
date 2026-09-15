import { Router, type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './createServer.js';
import type { McpAudience, ToolContext } from './context.js';

/**
 * Streamable HTTP transport for the agent service, stateless: every POST
 * builds its own server bound to the caller's bearer token, so one endpoint
 * serves many users without sharing identity. The token isn't verified
 * here — each tool forwards it to the REST API, whose auth middleware
 * remains the single permission check. Buyer and seller JWTs share a
 * payload shape, so the audience comes from the path.
 */
const handle = (audience: Exclude<McpAudience, 'all'>) => async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Authorization: Bearer <token> is required.' },
      id: null,
    });
  }

  const ctx: ToolContext = audience === 'user'
    ? { userToken: token, sellerToken: '' }
    : { userToken: '', sellerToken: token };

  const server = createMcpServer(ctx, audience);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on('close', () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error(`MCP HTTP (${audience}) error:`, error);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  }
};

const methodNotAllowed = (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed: this MCP endpoint is stateless, use POST.' },
    id: null,
  });
};

const router = Router();
router.post('/user', handle('user'));
router.post('/seller', handle('seller'));
router.get(['/user', '/seller'], methodNotAllowed);
router.delete(['/user', '/seller'], methodNotAllowed);

export default router;

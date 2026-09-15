/**
 * Credentials the tools forward to the REST API. stdio fills both from env;
 * the HTTP transport fills only the one matching its endpoint, from the
 * caller's own Authorization header.
 */
export interface ToolContext {
  userToken: string;
  sellerToken: string;
}

export type McpAudience = 'user' | 'seller' | 'all';

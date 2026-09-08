import dotenv from 'dotenv';
dotenv.config();

/**
 * Runtime configuration for the MCP server.
 *
 * The MCP server is a thin wrapper around the existing REST API (see
 * docs/mcp-server-plan.md, section 6 "Architecture & integration approach").
 * It calls the running Express app over HTTP using pre-issued JWTs, so it
 * reuses the app's auth middleware, validation, caching and offer logic.
 */

// Base URL of the running Express API. Falls back to the local dev server.
export const API_BASE_URL =
  process.env.MCP_API_BASE_URL ||
  `http://localhost:${process.env.PORT || 4000}`;

// Pre-issued buyer/user JWT (Authorization: Bearer <token>). Optional:
// buyer-authenticated tools return a clear error if it is missing.
export const USER_TOKEN = process.env.MCP_API_TOKEN || '';

// Pre-issued seller JWT. Optional: seller tools error clearly if missing.
export const SELLER_TOKEN = process.env.MCP_SELLER_API_TOKEN || '';

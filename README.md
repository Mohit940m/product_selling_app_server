# Product Selling App — Backend

Express 5 + TypeScript + MongoDB (Mongoose) REST API for the `product_selling_app` platform. Serves both frontend clients (`product_selling_app_client_user`, the buyer storefront; `product_selling_app_clinet_admin`, the seller dashboard) and the AI shopping-assistant service (`product_selling_app_agent`).

For a project-wide architecture overview (all four apps, how they relate), see the root `CLAUDE.md`. This file covers just this backend.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript (ESM — relative imports use `.js` extensions even in `.ts` source) |
| Framework | Express 5 |
| Database | MongoDB via Mongoose |
| Auth | JWT (`jsonwebtoken`), shared `JWT_SECRET` with `product_selling_app_agent` |
| File uploads | Multer + Cloudinary |
| Payments | Razorpay |
| Cache | Redis (optional — opt-in via `REDIS_ENABLED`) |
| API docs | `swagger-jsdoc` + `swagger-ui-express`, served at `/api-docs` |

## Getting Started

### Prerequisites

- Node.js 18+
- A MongoDB connection string (Atlas or self-hosted)
- Cloudinary and Razorpay accounts for their respective features

### Installation

```bash
cd product_selling_app_server
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in real values — every field there has a comment explaining what it's for and, where relevant, what's *not* implemented around it (there is no Razorpay webhook handler yet, for instance).

### Running

```bash
npm run dev      # nodemon + tsx on src/server.ts, hot reload
npm run build    # tsc → dist/
npm start        # node ./dist/server.js (run build first)
```

Default port `4000` (`PORT` in `.env`). No test suite or lint script is configured in this project.

## API Reference

Two audiences, two route trees, both mounted in `src/server.ts`:

- `/api/v1/user/*` — buyer-facing (auth, profile, products, wishlist, cart, orders). Full reference: [doc/routes/user.routes.md](doc/routes/user.routes.md).
- `/api/v1/seller/*` — seller-facing (auth, products, shipping, offers). Full reference: [doc/routes/seller.routes.md](doc/routes/seller.routes.md).
- Interactive Swagger UI at `/api-docs` — currently only covers the two auth route files' registration/verify-registration endpoints in detail; the `doc/routes/*.md` files above are the more complete reference.

Both markdown route docs list every real endpoint 1:1 against the actual route files (verified directly, not assumed) as of this pass — if a future route change makes them drift again, re-verify with a quick grep-and-diff against `src/routes/**/*.routes.ts` rather than trusting the docs blind.

## Architecture

`src/routes/{user.routes,seller.routes}/` → `src/controllers/{user.controllers,seller.controllers}/` → `src/models/` (grouped `userModels/`, `sellerModels/`, `productModels/`, `orderModels/`). Auth middleware (`src/auth/auth.middleware.ts`) verifies a JWT, loads the account, and rejects inactive/deleted ones before a controller ever runs.

Login and registration are both two-step OTP flows (`src/auth/otp.service.ts`) — the OTP is returned directly in the API response rather than actually emailed/texted, since there's no real delivery integration; this is intentional for testing/demo purposes and both frontend clients rely on it.

See the root `CLAUDE.md` for the fuller architecture writeup (Redis caching, Cloudinary upload flow, the Razorpay checkout sequence, the offers system) shared across all four apps in this monorepo.

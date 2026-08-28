import dotenv from 'dotenv';
dotenv.config(); // Load environment variables

import express from 'express';
import connectDB from './config/db.js';
import cors from 'cors';
import userRoutes from './routes/user.routes/userRoute.js';
import sellerRoutes from './routes/seller.routes/sellerRoute.js';
import swaggerRoutes from './config/swagger.js';
import { redisEnabled } from './config/redis.js';

const port = process.env.PORT;

connectDB();

const app = express();

app.use(cors(
    {
        origin: '*',
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }
));

app.use(express.json());

// No rate-limiting exists anywhere in this API — every route, including
// /auth/login, /auth/register, and their OTP-verify counterparts, accepts
// unlimited requests from a single caller. Genuinely worth adding before
// any real deployment (Redis is already a first-class piece of this stack
// for product caching, so a Redis-backed limiter — falling open the same
// way src/config/redis.ts's cache helpers already do when Redis is
// disabled/unreachable, rather than blocking all traffic — would be a
// natural fit). Not added here: picking actual limits per route and an
// IP- vs. user-scoped strategy is a real product/ops decision, not a
// one-line fix, so this is left as a documented gap rather than guessed.
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/seller', sellerRoutes);
app.use("/api-docs", swaggerRoutes);

app.listen(port, () =>{
    console.log(`Server is running on http://localhost:${port}`);
    console.log(`Redis cache: ${redisEnabled ? 'enabled' : 'disabled'}`);
})

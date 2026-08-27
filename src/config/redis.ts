import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Redis is opt-in. Set REDIS_ENABLED=true in .env to run the API with
// product-listing caching. Anything else (or unset) means the app runs as a
// normal Express app: no client is created, no connection is attempted, and
// every cache helper below becomes a harmless no-op.
export const redisEnabled =
    String(process.env.REDIS_ENABLED ?? '').trim().toLowerCase() === 'true';

const redisClient = redisEnabled
    ? createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
            connectTimeout: 5000,
            // Give up reconnecting after a handful of attempts instead of retrying
            // forever — an unreachable REDIS_URL (e.g. a Render-internal host used
            // locally) must not block requests that queue commands while offline.
            reconnectStrategy: (retries) => (retries > 5 ? false : Math.min(retries * 200, 3000)),
        },
        disableOfflineQueue: true,
    })
    : null;

if (redisClient) {
    redisClient.on('error', (err) => console.error('Redis Client Error', err.message));

    (async () => {
        try {
            if (!redisClient.isOpen) {
                await redisClient.connect();
            }
        } catch (error) {
            console.error('Redis connection failed, continuing without cache:', (error as Error).message);
        }
    })();
} else {
    console.log('Redis disabled (REDIS_ENABLED is not "true") — running without cache.');
}

// Fail-open helpers: product listing/detail reads must degrade to "no cache"
// rather than hang or throw when Redis is disabled or unreachable.
export const getCache = async (key: string): Promise<string | null> => {
    if (!redisClient || !redisClient.isReady) return null;
    try {
        return await redisClient.get(key);
    } catch (error) {
        console.error('Redis get failed:', (error as Error).message);
        return null;
    }
};

export const setCache = async (key: string, value: string, ttlSeconds: number): Promise<void> => {
    if (!redisClient || !redisClient.isReady) return;
    try {
        await redisClient.setEx(key, ttlSeconds, value);
    } catch (error) {
        console.error('Redis setEx failed:', (error as Error).message);
    }
};

export const clearProductCache = async () => {
    if (!redisClient || !redisClient.isReady) return;
    try {
        // Clear all keys matching the products pattern
        for await (const key of redisClient.scanIterator({ MATCH: 'products:*' })) {
            await redisClient.del(key);
        }
        // Explicitly delete the master key if used, as requested
        await redisClient.del("products:all");
        console.log("Product cache cleared.");
    } catch (error) {
        console.error("Error clearing product cache:", error);
    }
};

export default redisClient;

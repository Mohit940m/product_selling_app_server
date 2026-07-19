import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        connectTimeout: 5000,
        // Give up reconnecting after a handful of attempts instead of retrying
        // forever — an unreachable REDIS_URL (e.g. a Render-internal host used
        // locally) must not block requests that queue commands while offline.
        reconnectStrategy: (retries) => (retries > 5 ? false : Math.min(retries * 200, 3000)),
    },
    disableOfflineQueue: true,
});

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

// Fail-open helpers: product listing/detail reads must degrade to "no cache"
// rather than hang or throw when Redis is unreachable.
export const getCache = async (key: string): Promise<string | null> => {
    if (!redisClient.isReady) return null;
    try {
        return await redisClient.get(key);
    } catch (error) {
        console.error('Redis get failed:', (error as Error).message);
        return null;
    }
};

export const setCache = async (key: string, value: string, ttlSeconds: number): Promise<void> => {
    if (!redisClient.isReady) return;
    try {
        await redisClient.setEx(key, ttlSeconds, value);
    } catch (error) {
        console.error('Redis setEx failed:', (error as Error).message);
    }
};

export const clearProductCache = async () => {
    if (!redisClient.isReady) return;
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

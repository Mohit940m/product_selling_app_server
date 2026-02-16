import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

(async () => {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
})();

export const clearProductCache = async () => {
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

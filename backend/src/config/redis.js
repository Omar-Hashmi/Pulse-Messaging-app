import Redis from 'ioredis';

// General purpose client (caching, online-user sets, etc.)
export const redisClient = new Redis(process.env.REDIS_URL);

// Dedicated pub/sub pair required by the Socket.IO Redis adapter
export const pubClient = new Redis(process.env.REDIS_URL);
export const subClient = pubClient.duplicate();

redisClient.on('error', (err) => console.error('Redis client error:', err));
pubClient.on('error', (err) => console.error('Redis pub error:', err));
subClient.on('error', (err) => console.error('Redis sub error:', err));

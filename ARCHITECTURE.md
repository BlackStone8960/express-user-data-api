# Architecture Overview

This Express.js API implements advanced caching, rate limiting, and asynchronous processing for user data management.

## System Architecture

```
Client Request → Rate Limiter → Cache Check → Queue System → Mock Database
                      ↓              ↓              ↓
                 Rate Limit    Cache Hit/Miss   Async Processing
```

## Core Components

### Express.js Server (`src/app.ts`)

- Main application entry point
- Route configuration and middleware setup
- Error handling and request logging

### LRU Cache System (`src/services/cache.ts`)

- In-memory cache with 60-second TTL
- LRU eviction policy for memory management
- Background cleanup of expired entries
- Cache statistics tracking

### Rate Limiting (`src/services/rateLimiter.ts`)

- Token bucket algorithm
- 10 requests per minute, 5 requests per 10 seconds
- IP-based client tracking
- Automatic cleanup of old records

### Queue System (`src/services/queue.ts`)

- Asynchronous job processing
- Concurrent request handling
- Result caching and reuse
- Retry mechanism with exponential backoff

### Mock Database (`src/services/mockData.ts`)

- Simulated database with 200ms delay
- User CRUD operations
- Data validation

## Request Flow

1. **Rate Limiting**: Check client request limits
2. **Cache Lookup**: Check if data exists in cache
3. **Cache Hit**: Return cached data immediately
4. **Cache Miss**: Queue database fetch job
5. **Database Fetch**: Process job asynchronously
6. **Cache Store**: Store result for future requests
7. **Response**: Return data to client

## Key Features

- **Performance**: Cache hits serve in ~1ms vs ~200ms for database
- **Scalability**: Handles concurrent requests efficiently
- **Reliability**: Automatic retry and error handling
- **Monitoring**: Built-in statistics and health checks

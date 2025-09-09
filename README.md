# Express User Data API

A TypeScript-based Express.js API implementing advanced caching, rate limiting, and asynchronous processing for user data management.

## Features

- **Express.js Server**: Built with TypeScript for type safety
- **LRU Cache**: In-memory cache with 60-second TTL
- **Rate Limiting**: 10 requests per minute with 5 requests per 10-second burst capacity
- **Asynchronous Processing**: Queue system for optimized database calls
- **Cache Statistics**: Monitor hit rate, miss rate, and cache size

## API Endpoints

```
GET    /api/users/:id          # Get user data by ID
POST   /api/users              # Create new user
GET    /api/cache-status       # Get cache statistics
DELETE /api/cache              # Clear entire cache
```

## Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

## Testing

```bash
# Run tests after starting the server
./test-api.sh
```

### Manual Testing Examples

```bash
# Get user data (first request: cache miss, second request: cache hit)
curl http://localhost:3000/api/users/1

# Create new user
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com"}' \
  http://localhost:3000/api/users

# Check cache statistics
curl http://localhost:3000/api/cache-status

# Test rate limiting
for i in {1..6}; do curl http://localhost:3000/api/users/1; done
```

## Implementation Details

### Caching Strategy

The API uses an LRU cache with 60-second TTL for storing user data:

- Automatically removes least recently used items when cache is full
- Background cleanup task removes expired entries every 30 seconds
- Tracks cache statistics (hits, misses, size) for monitoring
- Cache key format: `user:${id}`
- Thread-safe operations for concurrent access

When a cache miss occurs, data is fetched from the mock database and stored for future requests.

### Rate Limiting Implementation

Implements token bucket algorithm with dual-window limits:

- 10 requests per minute (primary limit)
- 5 requests per 10 seconds (burst limit)
- Tracks requests by IP address with proxy header support
- Returns HTTP 429 with rate limit headers when exceeded
- Automatic cleanup of old client records

Each client has a separate token bucket for fair resource allocation.

### Asynchronous Processing

Uses a queue system to handle database operations without blocking:

- In-memory job queue manages database fetch operations
- Concurrent requests for the same user ID are handled efficiently:
  - First request triggers database fetch
  - Subsequent requests wait and share the result
- Automatic retry with exponential backoff for failed operations
- Results are immediately cached after successful fetch

This approach minimizes database calls while handling high concurrent load.

## Mock Data

```javascript
const mockUsers = {
  1: { id: 1, name: "John Doe", email: "john@example.com" },
  2: { id: 2, name: "Jane Smith", email: "jane@example.com" },
  3: { id: 3, name: "Alice Johnson", email: "alice@example.com" },
};
```

# Express User Data API

A high-performance, production-ready Express.js API built with TypeScript, featuring advanced caching, rate limiting, and asynchronous processing capabilities.

## 🚀 Features

### Core Functionality

- **Express.js Server**: Built with TypeScript for type safety and maintainability
- **User Management**: CRUD operations for user data with mock database simulation
- **Health Monitoring**: Comprehensive health checks and system status endpoints

### Advanced Caching System

- **LRU Cache**: Least Recently Used caching strategy with 60-second TTL
- **Cache Statistics**: Real-time monitoring of cache hits, misses, and performance
- **Cache Management**: Clear entire cache or delete specific entries
- **Background Cleanup**: Automatic removal of stale cache entries

### Rate Limiting

- **Token Bucket Algorithm**: Sophisticated rate limiting with burst capacity
- **Dual Limits**: 10 requests/minute with 5 requests/10-second burst window
- **Client Identification**: IP-based tracking with proxy support
- **Graceful Degradation**: 429 status codes with detailed rate limit headers

### Asynchronous Processing

- **Queue System**: In-memory job queue for database operations
- **Concurrent Handling**: Efficient processing of simultaneous requests
- **Job Retry**: Automatic retry mechanism with exponential backoff
- **Result Caching**: Reuse results for duplicate requests within time window

### Security & Middleware

- **Helmet**: Security headers and protection
- **CORS**: Configurable cross-origin resource sharing
- **Request Logging**: Comprehensive request/response logging
- **Error Handling**: Global error handling with graceful degradation

## 📋 API Endpoints

### User Operations

```
GET    /api/users/:id          # Get user by ID
POST   /api/users              # Create new user
```

### Cache Management

```
GET    /api/cache-status       # Get cache statistics
DELETE /api/cache              # Clear entire cache
DELETE /api/cache/:key         # Delete specific cache entry
```

### System Monitoring

```
GET    /health                 # Health check
GET    /api                    # API information
GET    /api/rate-limit-status  # Rate limit statistics
GET    /api/queue-status       # Queue statistics
```

## 🛠️ Installation & Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd express-user-data-api

# Install dependencies
npm install

# Build the project
npm run build

# Start the server
npm start
```

### Development

```bash
# Run in development mode with watch
npm run dev

# Run linting
npm run lint

# Run type checking
npm run type-check
```

## 🧪 Testing

### Automated Test Suite

Run the comprehensive test suite:

```bash
# Start the server
npm start

# In another terminal, run tests
./test-api.sh
```

### Manual Testing Examples

#### Get User Data

```bash
# First request (cache miss)
curl http://localhost:3000/api/users/1

# Second request (cache hit)
curl http://localhost:3000/api/users/1
```

#### Create User

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com"}' \
  http://localhost:3000/api/users
```

#### Cache Management

```bash
# Check cache status
curl http://localhost:3000/api/cache-status

# Clear cache
curl -X DELETE http://localhost:3000/api/cache

# Delete specific cache entry
curl -X DELETE http://localhost:3000/api/cache/user:1
```

#### Rate Limiting Test

```bash
# Make multiple rapid requests to test rate limiting
for i in {1..6}; do curl http://localhost:3000/api/users/1; done
```

## 🏗️ Architecture

### Functional Programming Approach

The codebase is built using functional programming principles for better maintainability and testability:

- **Pure Functions**: Stateless functions with predictable outputs
- **Module-level State**: Centralized state management within modules
- **Composition**: Function composition for complex operations
- **Immutability**: Immutable data structures where possible

### Key Components

#### Cache Service (`src/services/cache.ts`)

- LRU cache implementation with TTL support
- Background cleanup tasks
- Statistics tracking and monitoring

#### Rate Limiter (`src/services/rateLimiter.ts`)

- Token bucket algorithm implementation
- Client identification and tracking
- Burst capacity management

#### Queue Service (`src/services/queue.ts`)

- Asynchronous job processing
- Concurrent request handling
- Retry mechanism with exponential backoff

#### Mock Database (`src/services/mockData.ts`)

- Simulated database operations with 200ms delay
- User CRUD operations
- Data validation and sanitization

## 📊 Performance Features

### Caching Strategy

- **Cache Hit Ratio**: Monitor cache effectiveness
- **TTL Management**: Automatic expiration of stale data
- **Memory Efficiency**: LRU eviction for optimal memory usage

### Rate Limiting

- **Burst Handling**: Allow short bursts while maintaining overall limits
- **Client Isolation**: Per-client rate limiting
- **Header Information**: Detailed rate limit status in response headers

### Asynchronous Processing

- **Non-blocking Operations**: Database calls don't block the event loop
- **Concurrent Processing**: Handle multiple requests simultaneously
- **Result Reuse**: Avoid duplicate database calls for the same data

## 🔧 Configuration

### Environment Variables

```bash
PORT=3000                    # Server port
NODE_ENV=production          # Environment mode
ALLOWED_ORIGINS=*            # CORS allowed origins
```

### Cache Configuration

```typescript
const CACHE_CONFIG = {
  maxSize: 100,              # Maximum cache entries
  ttlMs: 60000,             # Time-to-live in milliseconds
  cleanupIntervalMs: 30000   # Background cleanup interval
};
```

### Rate Limit Configuration

```typescript
const RATE_LIMIT_CONFIG = {
  windowMs: 60000,           # 1 minute window
  maxRequests: 10,           # Maximum requests per window
  burstWindowMs: 10000,      # 10 second burst window
  maxBurstRequests: 5        # Maximum burst requests
};
```

## 📈 Monitoring & Logging

### Log Levels

- **INFO**: General application flow
- **DEBUG**: Detailed debugging information
- **ERROR**: Error conditions and exceptions

### Metrics Available

- Cache hit/miss ratios
- Rate limit statistics
- Queue processing metrics
- Response time tracking
- Error rates

### Health Checks

- Server status monitoring
- Cache health verification
- Queue system status
- Rate limiter status

## 🚀 Production Considerations

### Security

- Helmet middleware for security headers
- CORS configuration for cross-origin requests
- Input validation and sanitization
- Rate limiting to prevent abuse

### Performance

- Efficient caching strategy
- Asynchronous processing
- Memory management with LRU eviction
- Background cleanup tasks

### Reliability

- Graceful error handling
- Process signal handling
- Uncaught exception management
- Unhandled promise rejection handling

### Scalability

- Stateless design for horizontal scaling
- Efficient memory usage
- Background task optimization
- Queue-based processing

## 📝 API Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "timestamp": "2025-09-06T22:15:00.000Z"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2025-09-06T22:15:00.000Z"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🎯 Future Enhancements

- [ ] Database integration (PostgreSQL/MongoDB)
- [ ] Authentication and authorization
- [ ] API versioning
- [ ] OpenAPI/Swagger documentation
- [ ] Docker containerization
- [ ] Kubernetes deployment manifests
- [ ] Prometheus metrics integration
- [ ] Redis cache backend
- [ ] Message queue integration (RabbitMQ/Apache Kafka)

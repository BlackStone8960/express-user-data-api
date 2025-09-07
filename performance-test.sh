#!/bin/bash

# Express User Data API Performance Test Script
# This script performs load testing and performance analysis

BASE_URL="http://localhost:3000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Express User Data API Performance Test Suite${NC}"
echo "=============================================="
echo ""

# Function to measure response time
measure_response_time() {
    local url=$1
    local description=$2
    
    echo -e "${YELLOW}Testing: $description${NC}"
    
    # Measure response time
    response_time=$(curl -o /dev/null -s -w "%{time_total}" "$url")
    http_code=$(curl -o /dev/null -s -w "%{http_code}" "$url")
    
    echo "Response Time: ${response_time}s"
    echo "HTTP Status: $http_code"
    echo ""
}

# Function to perform concurrent requests
concurrent_test() {
    local url=$1
    local num_requests=$2
    local description=$3
    
    echo -e "${YELLOW}Concurrent Test: $description${NC}"
    echo "Making $num_requests concurrent requests..."
    
    start_time=$(date +%s.%N)
    
    # Launch concurrent requests
    for i in $(seq 1 $num_requests); do
        curl -s "$url" > /dev/null &
    done
    
    # Wait for all requests to complete
    wait
    
    end_time=$(date +%s.%N)
    duration=$(echo "$end_time - $start_time" | bc)
    
    echo "Total Time: ${duration}s"
    echo "Average Time per Request: $(echo "scale=3; $duration / $num_requests" | bc)s"
    echo "Requests per Second: $(echo "scale=2; $num_requests / $duration" | bc)"
    echo ""
}

# Function to test rate limiting
test_rate_limiting() {
    echo -e "${YELLOW}Rate Limiting Test${NC}"
    echo "Making rapid requests to test rate limiting..."
    
    success_count=0
    rate_limited_count=0
    
    for i in {1..15}; do
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/users/1")
        http_code=$(echo "$response" | tail -n1)
        
        if [ "$http_code" = "200" ]; then
            ((success_count++))
        elif [ "$http_code" = "429" ]; then
            ((rate_limited_count++))
        fi
        
        echo "Request $i: Status $http_code"
        sleep 0.1
    done
    
    echo "Successful requests: $success_count"
    echo "Rate limited requests: $rate_limited_count"
    echo ""
}

# Function to test cache performance
test_cache_performance() {
    echo -e "${YELLOW}Cache Performance Test${NC}"
    
    # Clear cache first
    curl -s -X DELETE "$BASE_URL/api/cache" > /dev/null
    
    echo "Testing cache miss (first request)..."
    start_time=$(date +%s.%N)
    curl -s "$BASE_URL/api/users/1" > /dev/null
    end_time=$(date +%s.%N)
    cache_miss_time=$(echo "$end_time - $start_time" | bc)
    echo "Cache Miss Time: ${cache_miss_time}s"
    
    echo "Testing cache hit (second request)..."
    start_time=$(date +%s.%N)
    curl -s "$BASE_URL/api/users/1" > /dev/null
    end_time=$(date +%s.%N)
    cache_hit_time=$(echo "$end_time - $start_time" | bc)
    echo "Cache Hit Time: ${cache_hit_time}s"
    
    speedup=$(echo "scale=2; $cache_miss_time / $cache_hit_time" | bc)
    echo "Cache Speedup: ${speedup}x faster"
    echo ""
}

# Function to test queue performance
test_queue_performance() {
    echo -e "${YELLOW}Queue Performance Test${NC}"
    
    # Clear cache to force queue usage
    curl -s -X DELETE "$BASE_URL/api/cache" > /dev/null
    
    echo "Testing concurrent requests for same user (should reuse queue results)..."
    start_time=$(date +%s.%N)
    
    # Make 5 concurrent requests for the same user
    for i in {1..5}; do
        curl -s "$BASE_URL/api/users/2" > /dev/null &
    done
    
    wait
    end_time=$(date +%s.%N)
    duration=$(echo "$end_time - $start_time" | bc)
    
    echo "5 Concurrent Requests Time: ${duration}s"
    echo "Average Time per Request: $(echo "scale=3; $duration / 5" | bc)s"
    echo ""
}

# Function to get system statistics
get_system_stats() {
    echo -e "${YELLOW}System Statistics${NC}"
    
    echo "Cache Status:"
    curl -s "$BASE_URL/api/cache-status" | jq '.data'
    echo ""
    
    echo "Queue Status:"
    curl -s "$BASE_URL/api/queue-status" | jq '.data'
    echo ""
    
    echo "Rate Limit Status:"
    curl -s "$BASE_URL/api/rate-limit-status" | jq '.data'
    echo ""
}

# Wait for server to be ready
echo -e "${YELLOW}⏳ Waiting for server to be ready...${NC}"
for i in {1..30}; do
    if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Server is ready!${NC}"
        break
    fi
    sleep 1
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Server not ready after 30 seconds${NC}"
        exit 1
    fi
done
echo ""

# Run performance tests
echo -e "${BLUE}📊 Starting Performance Tests${NC}"
echo "================================"
echo ""

# Basic response time tests
measure_response_time "$BASE_URL/health" "Health Check"
measure_response_time "$BASE_URL/api" "API Information"
measure_response_time "$BASE_URL/api/cache-status" "Cache Status"

# Cache performance test
test_cache_performance

# Queue performance test
test_queue_performance

# Concurrent request tests
concurrent_test "$BASE_URL/api/users/1" 10 "10 Concurrent User Requests"
concurrent_test "$BASE_URL/api/cache-status" 20 "20 Concurrent Cache Status Requests"

# Rate limiting test
test_rate_limiting

# System statistics
get_system_stats

echo -e "${GREEN}🎉 Performance tests completed!${NC}"
echo ""
echo -e "${BLUE}Performance Test Summary:${NC}"
echo "- Response time measurements"
echo "- Cache hit/miss performance"
echo "- Concurrent request handling"
echo "- Rate limiting effectiveness"
echo "- Queue system performance"
echo "- System resource utilization"
echo ""
echo -e "${YELLOW}💡 Tips for optimization:${NC}"
echo "- Monitor cache hit ratios for optimal TTL settings"
echo "- Adjust rate limits based on expected traffic"
echo "- Consider queue concurrency limits for your use case"
echo "- Monitor memory usage with large cache sizes"

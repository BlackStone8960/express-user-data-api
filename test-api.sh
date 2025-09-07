#!/bin/bash

# Express User Data API Test Script
# This script tests all endpoints and features of the API

BASE_URL="http://localhost:3000"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Express User Data API Test Suite${NC}"
echo "=================================="
echo ""

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    
    echo -e "${YELLOW}Testing: $description${NC}"
    echo "Endpoint: $method $endpoint"
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} - Status: $http_code"
        echo "Response: $(echo "$body" | jq -c . 2>/dev/null || echo "$body")"
    else
        echo -e "${RED}❌ FAIL${NC} - Expected: $expected_status, Got: $http_code"
        echo "Response: $(echo "$body" | jq -c . 2>/dev/null || echo "$body")"
    fi
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

# Test 1: Health Check
test_endpoint "GET" "/health" "" "200" "Health Check"

# Test 2: API Information
test_endpoint "GET" "/api" "" "200" "API Information"

# Test 3: Get existing user (should hit cache after first call)
test_endpoint "GET" "/api/users/1" "" "200" "Get User 1 (First Call - Cache Miss)"
test_endpoint "GET" "/api/users/1" "" "200" "Get User 1 (Second Call - Cache Hit)"

# Test 4: Get non-existent user
test_endpoint "GET" "/api/users/999" "" "404" "Get Non-existent User"

# Test 5: Cache Status
test_endpoint "GET" "/api/cache-status" "" "200" "Cache Status"

# Test 6: Rate Limit Status
test_endpoint "GET" "/api/rate-limit-status" "" "200" "Rate Limit Status"

# Test 7: Queue Status
test_endpoint "GET" "/api/queue-status" "" "200" "Queue Status"

# Test 8: Create valid user
test_endpoint "POST" "/api/users" '{"name":"Test User","email":"test@example.com"}' "201" "Create Valid User"

# Test 9: Create user with invalid email
test_endpoint "POST" "/api/users" '{"name":"Test User","email":"invalid-email"}' "400" "Create User with Invalid Email"

# Test 10: Create user with missing fields
test_endpoint "POST" "/api/users" '{"name":"Test User"}' "400" "Create User with Missing Email"

# Test 11: Create user with short name
test_endpoint "POST" "/api/users" '{"name":"A","email":"test@example.com"}' "400" "Create User with Short Name"

# Test 12: Delete specific cache entry
test_endpoint "DELETE" "/api/cache/user:1" "" "200" "Delete Specific Cache Entry"

# Test 13: Delete non-existent cache entry
test_endpoint "DELETE" "/api/cache/nonexistent" "" "404" "Delete Non-existent Cache Entry"

# Test 14: Clear entire cache
test_endpoint "DELETE" "/api/cache" "" "200" "Clear Entire Cache"

# Test 15: Test rate limiting (make multiple rapid requests)
echo -e "${YELLOW}Testing Rate Limiting...${NC}"
echo "Making 6 rapid requests to test burst limit..."
for i in {1..6}; do
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/users/2")
    http_code=$(echo "$response" | tail -n1)
    echo "Request $i: Status $http_code"
    if [ "$http_code" = "429" ]; then
        echo -e "${GREEN}✅ Rate limiting working correctly${NC}"
        break
    fi
    sleep 0.1
done
echo ""

# Test 16: Test concurrent requests
echo -e "${YELLOW}Testing Concurrent Requests...${NC}"
echo "Making 3 concurrent requests for the same user..."
for i in {1..3}; do
    curl -s "$BASE_URL/api/users/3" > /dev/null &
done
wait
echo -e "${GREEN}✅ Concurrent requests completed${NC}"
echo ""

# Test 17: Final status check
echo -e "${YELLOW}Final System Status:${NC}"
test_endpoint "GET" "/api/cache-status" "" "200" "Final Cache Status"
test_endpoint "GET" "/api/queue-status" "" "200" "Final Queue Status"
test_endpoint "GET" "/api/rate-limit-status" "" "200" "Final Rate Limit Status"

echo -e "${GREEN}🎉 All tests completed!${NC}"
echo ""
echo -e "${YELLOW}Test Summary:${NC}"
echo "- Health check and API info endpoints"
echo "- User retrieval with caching"
echo "- User creation with validation"
echo "- Cache management (clear, delete specific entries)"
echo "- Rate limiting functionality"
echo "- Concurrent request handling"
echo "- System monitoring endpoints"

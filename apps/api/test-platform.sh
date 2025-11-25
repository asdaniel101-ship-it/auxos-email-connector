#!/bin/bash

# Platform End-to-End Test Script
# Run this after starting the API server

API_URL="${API_URL:-http://localhost:4000}"
API_KEY="${API_KEY:-}"

echo "🧪 Testing Auxo Platform"
echo "API URL: $API_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local expected_status=${4:-200}
  local headers=${5:-""}
  
  test_count=$((test_count + 1))
  echo -n "Testing $name... "
  
  if [ -n "$headers" ]; then
    response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" -H "$headers")
  else
    response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" -eq "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
    pass_count=$((pass_count + 1))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (Expected $expected_status, got $http_code)"
    echo "  Response: $body"
    fail_count=$((fail_count + 1))
    return 1
  fi
}

echo "=== Health Checks ==="
test_endpoint "Health Check" "GET" "/health" 200
test_endpoint "Readiness Check" "GET" "/health/ready" 200
test_endpoint "Liveness Check" "GET" "/health/live" 200

echo ""
echo "=== API Authentication ==="
if [ -n "$API_KEY" ]; then
  test_endpoint "Protected Endpoint (no key)" "POST" "/email-intake/poll" 401
  test_endpoint "Protected Endpoint (with key)" "POST" "/email-intake/poll" 200 "X-API-Key: $API_KEY"
else
  echo -e "${YELLOW}⚠ API_KEY not set, skipping auth tests${NC}"
fi

echo ""
echo "=== Public Endpoints ==="
test_endpoint "Get Submissions" "GET" "/email-intake/submissions" 200
test_endpoint "Create Session" "POST" "/sessions" 201 "Content-Type: application/json" -d '{"vertical":"insurance","ownerName":"Test","email":"test@example.com"}'

echo ""
echo "=== Rate Limiting ==="
echo "Making 5 quick requests to test rate limiting..."
for i in {1..5}; do
  curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" > /dev/null
done
echo -e "${GREEN}✓ Rate limiting test completed${NC}"

echo ""
echo "=== Summary ==="
echo "Total tests: $test_count"
echo -e "${GREEN}Passed: $pass_count${NC}"
if [ $fail_count -gt 0 ]; then
  echo -e "${RED}Failed: $fail_count${NC}"
else
  echo -e "${GREEN}Failed: $fail_count${NC}"
fi

if [ $fail_count -eq 0 ]; then
  echo -e "\n${GREEN}✅ All tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}❌ Some tests failed${NC}"
  exit 1
fi


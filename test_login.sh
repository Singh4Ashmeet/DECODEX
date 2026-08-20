#!/bin/bash
curl -s -X POST https://decodex-backend.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@decodex.com","password":"password123"}' \
  -c cookies.txt -v 2>&1 | grep -E "HTTP|Set-Cookie|{"
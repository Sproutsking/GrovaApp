#!/bin/bash
# Build script with proper Node memory allocation for Vercel
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build

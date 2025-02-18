#!/bin/bash

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v openscad >/dev/null 2>&1 || { echo "OpenSCAD is required but not installed. Aborting." >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "PostgreSQL client is required but not installed. Aborting." >&2; exit 1; }

# Create necessary directories
mkdir -p temp
mkdir -p dist

# Install dependencies
echo "Installing dependencies..."
npm install

# Run database migrations
echo "Running database migrations..."
npm run db:push

# Build the application
echo "Building the application..."
npm run build

# Start the application
echo "Starting the application..."
NODE_ENV=production npm run start
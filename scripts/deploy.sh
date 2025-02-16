#!/bin/bash

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v openscad >/dev/null 2>&1 || { echo "OpenSCAD is required but not installed. Aborting." >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "PostgreSQL client is required but not installed. Aborting." >&2; exit 1; }

# Create necessary directories
mkdir -p temp

# Install dependencies
echo "Installing dependencies..."
npm install

# Check for .env file
if [ ! -f .env ]; then
    echo "Creating .env file..."
    echo "DATABASE_URL=postgresql://username:password@localhost:5432/your_database_name" > .env
    echo "PORT=5000" >> .env
    echo "Please update the .env file with your database credentials"
fi

# Build the application
echo "Building the application..."
npm run build

# Start the application
echo "Starting the application..."
npm run start

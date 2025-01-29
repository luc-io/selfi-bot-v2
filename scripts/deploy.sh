#!/bin/bash

# Exit on any error
set -e

echo "Starting deployment..."

# Pull latest changes
echo "Pulling latest changes..."
git pull origin main

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Build TypeScript
echo "Building TypeScript..."
pnpm build

# Run database migrations
echo "Running database migrations..."
pnpm prisma generate
pnpm prisma db push

# Seed database if needed
if [ "$1" = "--seed" ]; then
  echo "Seeding database..."
  pnpm prisma db seed
fi

# Restart PM2 process
echo "Restarting PM2 process..."
pm2 restart selfi-bot

echo "Deployment completed successfully!"
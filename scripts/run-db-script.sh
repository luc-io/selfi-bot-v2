#!/bin/bash

# Set database URL
export DATABASE_URL="postgresql://selfibot:selfibot123@localhost:5432/selfibot"

# Compile and run the specified script
echo "Compiling $1..."
npx tsc "scripts/$1.ts"

echo "Running $1..."
node "scripts/$1.js"
#!/bin/bash

# Docker Setup Script for Remmie Travel Platform
set -e

echo "🚀 Setting up Remmie Travel Platform with Docker..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "⚠️  Please edit .env file with your actual configuration values!"
    echo "   Especially update the following:"
    echo "   - JWT_SECRET"
    echo "   - Database passwords"
    echo "   - Stripe keys"
    echo "   - OpenAI API key"
    echo "   - External API tokens"
    echo ""
    read -p "Press Enter after updating .env file to continue..."
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p backend/uploads/user_profile
mkdir -p ssl
mkdir -p database

# Create database init file if it doesn't exist
if [ ! -f database/init.sql ]; then
    echo "🗄️  Creating database initialization file..."
    cat > database/init.sql << 'EOF'
-- Database initialization script
-- Add your table creation scripts here
CREATE DATABASE IF NOT EXISTS remmie_db;
USE remmie_db;

-- Example table (replace with your actual schema)
CREATE TABLE IF NOT EXISTS trvl_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    mobile VARCHAR(20),
    profile_image VARCHAR(255),
    ip_address VARCHAR(45),
    login_time DATETIME,
    logout_time DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Add more tables as needed...
EOF
fi

echo "✅ Setup complete! You can now run:"
echo ""
echo "   Development mode:"
echo "   docker-compose -f docker-compose.dev.yml up --build"
echo ""
echo "   Production mode:"
echo "   docker-compose up --build"
echo ""
echo "   Production with Nginx proxy:"
echo "   docker-compose --profile production up --build"
echo ""
echo "📋 Next steps:"
echo "1. Update .env file with your actual values"
echo "2. Add your database schema to database/init.sql"
echo "3. Add SSL certificates to ssl/ directory for production"
echo "4. Run the appropriate Docker Compose command"

@echo off
REM Docker Setup Script for Remmie Travel Platform (Windows)

echo 🚀 Setting up Remmie Travel Platform with Docker...

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker Desktop first.
    pause
    exit /b 1
)

REM Check if Docker Compose is available
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose is not available. Please ensure Docker Desktop is running.
    pause
    exit /b 1
)

REM Create .env file if it doesn't exist
if not exist .env (
    echo 📝 Creating .env file from template...
    copy env.example .env
    echo ⚠️  Please edit .env file with your actual configuration values!
    echo    Especially update the following:
    echo    - JWT_SECRET
    echo    - Database passwords
    echo    - Stripe keys
    echo    - OpenAI API key
    echo    - External API tokens
    echo.
    pause
)

REM Create necessary directories
echo 📁 Creating necessary directories...
if not exist backend\uploads\user_profile mkdir backend\uploads\user_profile
if not exist ssl mkdir ssl
if not exist database mkdir database

REM Create database init file if it doesn't exist
if not exist database\init.sql (
    echo 🗄️  Creating database initialization file...
    echo -- Database initialization script > database\init.sql
    echo -- Add your table creation scripts here >> database\init.sql
    echo CREATE DATABASE IF NOT EXISTS remmie_db; >> database\init.sql
    echo USE remmie_db; >> database\init.sql
    echo. >> database\init.sql
    echo -- Example table ^(replace with your actual schema^) >> database\init.sql
    echo CREATE TABLE IF NOT EXISTS trvl_users ^( >> database\init.sql
    echo     id INT AUTO_INCREMENT PRIMARY KEY, >> database\init.sql
    echo     first_name VARCHAR^(100^), >> database\init.sql
    echo     last_name VARCHAR^(100^), >> database\init.sql
    echo     email VARCHAR^(255^) UNIQUE, >> database\init.sql
    echo     password VARCHAR^(255^), >> database\init.sql
    echo     mobile VARCHAR^(20^), >> database\init.sql
    echo     profile_image VARCHAR^(255^), >> database\init.sql
    echo     ip_address VARCHAR^(45^), >> database\init.sql
    echo     login_time DATETIME, >> database\init.sql
    echo     logout_time DATETIME, >> database\init.sql
    echo     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, >> database\init.sql
    echo     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP >> database\init.sql
    echo ^); >> database\init.sql
    echo. >> database\init.sql
    echo -- Add more tables as needed... >> database\init.sql
)

echo ✅ Setup complete! You can now run:
echo.
echo    Development mode:
echo    docker-compose -f docker-compose.dev.yml up --build
echo.
echo    Production mode:
echo    docker-compose up --build
echo.
echo    Production with Nginx proxy:
echo    docker-compose --profile production up --build
echo.
echo 📋 Next steps:
echo 1. Update .env file with your actual values
echo 2. Add your database schema to database\init.sql
echo 3. Add SSL certificates to ssl\ directory for production
echo 4. Run the appropriate Docker Compose command

pause

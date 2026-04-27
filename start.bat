@echo off
title SahayaSetu — Smart NGO Resource System
color 0A
echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║   🌿  SahayaSetu — Smart NGO Resource System         ║
echo ║   Disaster Relief Coordination Platform              ║
echo ║   Authentication: Email/Password + Google OAuth      ║
echo ╚══════════════════════════════════════════════════════╝
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is NOT installed.
    echo    Please download it from https://nodejs.org
    pause
    exit /b 1
)

echo ✅ Node.js found:
node --version
echo.

:: Check MongoDB
echo 🔍 Checking if MongoDB is running...
mongosh --eval "db.runCommand({ ping: 1 })" --quiet >nul 2>nul
if %errorlevel% equ 0 (
    echo ✅ MongoDB is running!
) else (
    echo ⚠️  MongoDB is NOT running.
    echo    Start MongoDB first:
    echo    - If installed as service: net start MongoDB
    echo    - Or run: mongod --dbpath C:\data\db
    echo    - Or install from: https://www.mongodb.com/try/download/community
    echo.
    set /p CONTINUE_WITHOUT_DB="Continue anyway? (demo mode will work) (Y/n): "
    if /i "%CONTINUE_WITHOUT_DB%"=="n" (
        pause
        exit /b 1
    )
)
echo.

:: Install backend dependencies if needed
cd /d "%~dp0backend"
if not exist "node_modules" (
    echo 📦 Installing backend dependencies (first run)...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed!
    echo.
) else (
    echo ✅ Backend dependencies already installed.
)

:: Ask user if they want to seed the database
set /p SEED_DB="🌱 Seed the database with demo data? (y/N): "
if /i "%SEED_DB%"=="y" (
    echo.
    echo 🌱 Seeding database with demo accounts...
    node seed.js
    echo ✅ Demo data seeded!
    echo.
)

:: Start the backend server in a new window
echo.
echo 🚀 Starting SahayaSetu backend server on port 5000...
start "SahayaSetu Backend - Keep this open!" cmd /k "cd /d %~dp0backend && node server.js"

:: Wait for server to start
timeout /t 4 /nobreak >nul

echo.
echo ══════════════════════════════════════════════════════
echo    🌐 SahayaSetu is RUNNING!
echo.
echo    🏠 Home:          http://localhost:5000/index.html
echo    🔐 Login:         http://localhost:5000/login.html
echo    📊 Dashboard:     http://localhost:5000/dashboard.html
echo    📋 Reports:       http://localhost:5000/reports.html
echo    🗺️  Crisis Map:    http://localhost:5000/map.html
echo    🙋 Volunteers:    http://localhost:5000/volunteer.html
echo    📦 Inventory:     http://localhost:5000/inventory.html
echo    💰 Donors:        http://localhost:5000/donors.html
echo.
echo    🔌 API Server:    http://localhost:5000/api
echo    ❤️  Health Check:  http://localhost:5000/api/health
echo ══════════════════════════════════════════════════════
echo.
echo 📋 Demo Login Credentials (Email + Password):
echo    Admin:        admin@SahayaSetu.org      / Admin@123
echo    Coordinator:  ayesha@SahayaSetu.org     / Coord@123
echo    Volunteer:    rahul@SahayaSetu.org      / Vol@12345
echo    Donor:        ananya.donor@gmail.com    / Donor@123
echo.
echo 🔑 Google Sign-In Setup:
echo    1. Go to: https://console.cloud.google.com
echo    2. APIs and Services → Credentials → Create OAuth 2.0 Client ID
echo    3. Add http://localhost:5000 as Authorized JavaScript Origin
echo    4. Copy your Client ID into backend\.env as GOOGLE_CLIENT_ID=...
echo    5. Also paste it in login.html line (const GOOGLE_CLIENT_ID = ...)
echo ══════════════════════════════════════════════════════
echo.

:: Open the login page via the server (not file://)
set /p OPEN_BROWSER="🌐 Open login page in browser? (Y/n): "
if /i not "%OPEN_BROWSER%"=="n" (
    start "" "http://localhost:5000/login.html"
)

echo.
echo ✅ SahayaSetu is live at http://localhost:5000
echo    Keep the backend window open while using the app.
echo    Press Ctrl+C in the backend window to stop the server.
echo.
pause

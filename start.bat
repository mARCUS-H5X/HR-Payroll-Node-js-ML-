@echo off
TITLE SAI Payroll System
echo ==================================================
echo         SAI Payroll Management          
echo ==================================================
echo.
echo Starting the local server...
echo.

:: Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in your PATH!
    echo Please download and install Node.js from https://nodejs.org/
    echo Press any key to exit...
    pause >nul
    exit /b
)

:: Try to install node modules if missing
if not exist "node_modules\" (
    echo First time setup detected. Installing required modules...
    call npm install
)

:: Start the server and wait 2 seconds before opening browser
start /b cmd /c "node server.js"
ping 127.0.0.1 -n 3 > nul
start http://localhost:3000

echo.
echo The application is now running.
echo Please leave this window open while using the app.
echo When you are done, simply close this window.
echo.
pause

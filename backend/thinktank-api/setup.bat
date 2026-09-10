@echo off
REM ---------------------------------------------------------------------
REM  First-time setup. Run this once.
REM
REM  Makes the virtual environment, installs the dependencies, writes a
REM  .env with a real SECRET_KEY, creates the tables and loads the demo
REM  data. Start Postgres first (docker compose up -d).
REM ---------------------------------------------------------------------
setlocal
cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Python is not on your PATH.
  echo   Install Python 3.11 or newer from python.org and tick
  echo   "Add python.exe to PATH" in the installer.
  echo.
  pause
  exit /b 1
)

if exist .venv\Scripts\activate.bat goto haveenv
echo Creating the virtual environment...
python -m venv .venv
if errorlevel 1 goto failed

:haveenv
call .venv\Scripts\activate.bat

echo Installing dependencies...
python -m pip install --upgrade pip >nul 2>&1
pip install -r requirements.txt
if errorlevel 1 goto failed

if exist .env goto haveconfig
copy .env.example .env >nul
for /f "delims=" %%K in ('python -c "import secrets;print(secrets.token_urlsafe(48))"') do set "NEWKEY=%%K"
powershell -NoProfile -Command "(Get-Content .env) -replace '^SECRET_KEY=.*', 'SECRET_KEY=%NEWKEY%' | Set-Content .env"
echo Wrote .env with a fresh SECRET_KEY.

:haveconfig
echo Creating the tables...
alembic upgrade head
if errorlevel 1 goto nodb

echo Loading the demo data...
python seed.py

echo.
echo   Ready. Double-click run-api.bat to start the server.
echo.
pause
exit /b 0

:nodb
echo.
echo   Could not reach the database.
echo   Start it first:  docker compose up -d
echo   ...or check DATABASE_URL in .env if you are running your own Postgres.
echo.
pause
exit /b 1

:failed
echo.
echo   Setup stopped on an error - the message above says which step.
echo.
pause
exit /b 1

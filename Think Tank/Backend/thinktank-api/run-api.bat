@echo off
REM  Starts the API on http://localhost:8000 with auto-reload.
REM  Leave this window open while you work. Ctrl+C stops it.
setlocal
cd /d "%~dp0"

if exist .venv\Scripts\activate.bat goto go
echo.
echo   No virtual environment here yet - run setup.bat first.
echo.
pause
exit /b 1

:go
call .venv\Scripts\activate.bat
echo.
echo   API      http://localhost:8000
echo   Docs     http://localhost:8000/docs
echo.
uvicorn app.main:app --reload --port 8000
pause

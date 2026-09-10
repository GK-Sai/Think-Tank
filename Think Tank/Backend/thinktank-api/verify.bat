@echo off
REM  Runs the 88 contract checks against a running API.
REM  Start run-api.bat in another window first.
setlocal
cd /d "%~dp0"
call .venv\Scripts\activate.bat
python verify_contract.py
pause

@echo off
setlocal EnableDelayedExpansion

REM ============================================================
REM AI Governor Launcher (Windows)
REM - Uses dynamic workspace relative pathing (%~dp0)
REM - Auto-selects backend and frontend ports if busy
REM - Launches FastAPI backend and Vite frontend
REM ============================================================

set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%ROOT_DIR%backend"
set "FRONTEND_DIR=%ROOT_DIR%frontend"

call :IsPortInUse 8000 BACKEND_BUSY
if "!BACKEND_BUSY!"=="1" (
  call :IsPortInUse 8001 BACKEND_BUSY
  if "!BACKEND_BUSY!"=="1" (
    call :IsPortInUse 8002 BACKEND_BUSY
    if "!BACKEND_BUSY!"=="1" (
      echo [ERROR] Ports 8000-8002 are all in use. Please free one and retry.
      exit /b 1
    ) else (
      set "BACKEND_PORT=8002"
    )
  ) else (
    set "BACKEND_PORT=8001"
  )
) else (
  set "BACKEND_PORT=8000"
)

call :IsPortInUse 5173 FRONTEND_BUSY
if "!FRONTEND_BUSY!"=="1" (
  call :IsPortInUse 5174 FRONTEND_BUSY
  if "!FRONTEND_BUSY!"=="1" (
    call :IsPortInUse 5175 FRONTEND_BUSY
    if "!FRONTEND_BUSY!"=="1" (
      echo [ERROR] Frontend ports 5173-5175 are all in use. Please free one and retry.
      exit /b 1
    ) else (
      set "FRONTEND_PORT=5175"
    )
  ) else (
    set "FRONTEND_PORT=5174"
  )
) else (
  set "FRONTEND_PORT=5173"
)

echo ============================================================
echo Starting AI Governor Emergency Coordination Network
echo   Backend  Port : !BACKEND_PORT!
echo   Frontend Port : !FRONTEND_PORT!
echo ============================================================

REM ===== Start backend =====
start "ai-governor-backend" cmd /k "cd /d "%BACKEND_DIR%" && set PYTHONPATH=. && python -m uvicorn app.main:app --host 127.0.0.1 --port !BACKEND_PORT! --log-level info"

REM ===== Start frontend =====
set "API_PROXY_TARGET=http://127.0.0.1:!BACKEND_PORT!"
set "WS_PROXY_TARGET=ws://127.0.0.1:!BACKEND_PORT!"
start "ai-governor-frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev -- --host 127.0.0.1 --port !FRONTEND_PORT!"

echo.
echo [OK] Started both servers.
echo Backend API Docs: http://127.0.0.1:!BACKEND_PORT!/api/docs
echo Backend Health:   http://127.0.0.1:!BACKEND_PORT!/api/health
echo Frontend UI:       http://127.0.0.1:!FRONTEND_PORT!/

goto :eof

REM ------------------------------------------------------------
REM %1 = port, %2 = output variable name (0/1)
REM ------------------------------------------------------------
:IsPortInUse
setlocal EnableDelayedExpansion
set "port=%~1"
set "result=0"
for /f %%A in ('netstat -ano ^| findstr /I ":!port!" ^| findstr /I "LISTENING"') do (
  set "result=1"
)
set "out=!result!"
endlocal & set "%~2=%out%"
exit /b 0

@echo off
echo ========================================================
echo Starting Glory Momo Remotion MCP Server...
echo ========================================================
cd /d "%~dp0..\remotion-mcp-app"
if not exist node_modules (
  echo Installing dependencies for Remotion MCP...
  call npm install
)
if not exist ".mcp-use\build" (
  echo Building Remotion MCP bundle...
  call npm run build
)
echo Launching Remotion MCP Server at http://localhost:3000/mcp ...
call npm start
pause

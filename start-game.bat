@echo off
setlocal
cd /d "%~dp0"

rem ABYSS.IO launcher. The server reads server\.env for the admin gate,
rem or you can set ABYSS_ADMIN_USER / ABYSS_ADMIN_PASSWORD_HASH as real
rem environment variables (they win over the file).

where python >nul 2>nul
if %errorlevel%==0 (
  python "server\server.py"
  goto :done
)

where py >nul 2>nul
if %errorlevel%==0 (
  py "server\server.py"
  goto :done
)

where node >nul 2>nul
if %errorlevel%==0 (
  node "server\server.js"
  goto :done
)

echo.
echo Python 3 and Node.js were both not found.
echo Install Python 3 from https://www.python.org/downloads/ and run this again.
echo.
pause

:done
endlocal

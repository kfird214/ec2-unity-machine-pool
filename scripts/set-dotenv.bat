@echo off

@REM Load environment variables from .env file
setlocal enabledelayedexpansion

@REM Load environment variables from .env file
for /f "tokens=1,2 delims==" %%A in (.env) do (
    set "tempVar=%%B"
    set "tempVar=!tempVar:"=!"
    set "output=!output!set %%A=!tempVar!&"
)

@REM Export all variables after endlocal
endlocal & %output%

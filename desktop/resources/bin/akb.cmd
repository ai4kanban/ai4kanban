@echo off
rem The `akb` command, as the app carries it on Windows (#226).
rem
rem There are no symlinks here. The installer puts THIS folder on the user's
rem PATH instead, so `akb` in a terminal finds this file and runs the app's own
rem copy of the command under the app's own Node. Updating the app updates the
rem command; a PATH entry only reaches terminals opened after it is written.
setlocal
set "A4K_BIN=%~dp0"
set "A4K_RESOURCES=%A4K_BIN%.."
set "A4K_APP=%A4K_RESOURCES%\.."
set "A4K_CLI=%A4K_RESOURCES%\cli\bin\ai4kanban.mjs"

for %%F in ("%A4K_APP%\AI4Kanban.exe") do set "A4K_EXE=%%~fF"
if not exist "%A4K_EXE%" (
  echo akb: could not find the AI4Kanban app around "%A4K_RESOURCES%" 1>&2
  exit /b 1
)
if not exist "%A4K_CLI%" (
  echo akb: the command is missing from this AI4Kanban app 1>&2
  exit /b 1
)

rem No action at all: open the app on the folder you are standing in. The variable
rem is cleared first: a shell that already exports it would start the app as a bare
rem Node process, and no window would ever appear.
if "%~1"=="" (
  set "ELECTRON_RUN_AS_NODE="
  start "" "%A4K_EXE%" --cwd "%CD%"
  exit /b 0
)

set "AI4KANBAN_COMMAND=akb"
set "ELECTRON_RUN_AS_NODE=1"
"%A4K_EXE%" "%A4K_CLI%" %*
exit /b %ERRORLEVEL%

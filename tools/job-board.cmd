@echo off
setlocal
chcp 65001 >nul

set "SCRIPT=%~dp0job_board_harness.mjs"
set "NODE_EXE="

if defined CODEX_NODE (
  if exist "%CODEX_NODE%" set "NODE_EXE=%CODEX_NODE%"
)

if not defined NODE_EXE (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  )
)

if not defined NODE_EXE (
  if exist "%LOCALAPPDATA%\OpenAI\Codex\bin\node.exe" (
    set "NODE_EXE=%LOCALAPPDATA%\OpenAI\Codex\bin\node.exe"
  )
)

if not defined NODE_EXE (
  for %%N in (node.exe) do (
    if not "%%~$PATH:N"=="" set "NODE_EXE=%%~$PATH:N"
  )
)

if not defined NODE_EXE (
  echo Node.js was not found. Set CODEX_NODE or repair the Codex primary runtime. 1>&2
  exit /b 1
)

"%NODE_EXE%" "%SCRIPT%" %*
exit /b %ERRORLEVEL%

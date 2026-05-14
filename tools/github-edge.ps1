$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$script = Join-Path $root "tools\github_edge_workflow.mjs"

$candidates = @()
if ($env:CODEX_NODE) {
  $candidates += $env:CODEX_NODE
}
$candidates += (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe")
$candidates += (Join-Path $env:LOCALAPPDATA "OpenAI\Codex\bin\node.exe")

$cmd = Get-Command node -ErrorAction SilentlyContinue
if ($cmd) {
  $candidates += $cmd.Source
}

$node = $null
foreach ($candidate in $candidates) {
  if ($candidate -and (Test-Path $candidate)) {
    $node = $candidate
    break
  }
}

if (-not $node) {
  throw "Node.js was not found. Set CODEX_NODE or repair the Codex primary runtime."
}

& $node $script @args
exit $LASTEXITCODE

# Put this folder on the user's PATH, or take it off again (#226).
#
# Windows has no symlinks to hand out, so `akb` gets there by having the app's own bin
# folder — this one, which holds akb.cmd — on the PATH. Three callers share this one file so
# the edit is written once: the installer adds it, the uninstaller takes it off, and the
# button in the app repairs it when it has gone missing.
#
# The user's PATH only, never the machine's, and never through `setx` — that truncates a
# PATH longer than 1024 characters, and a truncated PATH is a broken machine rather than a
# failed install. .NET's SetEnvironmentVariable tells the rest of Windows itself; a new
# entry still only reaches terminals opened after it.
param(
  [switch]$Add,
  [switch]$Remove
)

$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path

$current = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($null -eq $current) { $current = '' }

# Drop any entry naming this folder, whatever it was spelled like, and put one back when
# this is an add. Running it twice leaves one entry, not two.
$parts = @($current -split ';' | Where-Object { $_ -ne '' -and $_.TrimEnd('\') -ne $dir.TrimEnd('\') })
if ($Add -and -not $Remove) { $parts += $dir }

[Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User')

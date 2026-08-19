; What the Windows installer does beyond copying the app in (#226).
;
; There are no symlinks here, so `akb` reaches the PATH by way of the app's own bin folder —
; resources\bin, which holds akb.cmd. The edit itself lives in resources\bin\path.ps1, the
; same file the app's own repair button runs, so the PATH is written by one piece of code
; wherever it is asked for.
;
; It is the user's PATH, so this holds for a per-user install and asks for nothing.

!macro customInstall
  nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\bin\path.ps1" -Add'
  Pop $0
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\bin\path.ps1" -Remove'
  Pop $0
!macroend

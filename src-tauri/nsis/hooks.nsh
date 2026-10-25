; dBound NSIS hooks: the app stores activation in HKCU, remove it on uninstall.
!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegValue HKCU "Software\dBound" "License"
  DeleteRegKey /ifempty HKCU "Software\dBound"
!macroend

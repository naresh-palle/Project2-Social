# Run in PowerShell (Admin optional): installs Flutter stable to C:\flutter and adds PATH for this user.
$ErrorActionPreference = "Stop"
$FlutterRoot = "C:\flutter"
$Zip = "$env:TEMP\flutter_windows.zip"
$Url = "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.32.8-stable.zip"

Write-Host "Downloading Flutter stable to $Zip ..."
Invoke-WebRequest -Uri $Url -OutFile $Zip
if (Test-Path $FlutterRoot) {
  Write-Host "C:\flutter already exists — skipping extract. Delete it first to reinstall."
} else {
  Write-Host "Extracting to C:\ ..."
  Expand-Archive -Path $Zip -DestinationPath "C:\" -Force
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*C:\flutter\bin*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;C:\flutter\bin", "User")
  Write-Host "Added C:\flutter\bin to User PATH"
} else {
  Write-Host "PATH already contains Flutter"
}

Write-Host ""
Write-Host "NEXT:"
Write-Host "1) Install Android Studio from https://developer.android.com/studio"
Write-Host "2) Open Android Studio -> More Actions -> SDK Manager -> install Android SDK + cmdline-tools"
Write-Host "3) Close ALL terminals, open a new Cursor terminal:"
Write-Host "     flutter doctor"
Write-Host "     cd mobile"
Write-Host "     flutter pub get"
Write-Host "     flutter build apk --release --dart-define=API_BASE=https://project2-social.onrender.com/api"

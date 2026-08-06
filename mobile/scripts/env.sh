#!/usr/bin/env bash
# Source before Flutter commands if PATH is not set:
#   source mobile/scripts/env.sh
export FLUTTER_ROOT="${FLUTTER_ROOT:-/opt/flutter}"
if [ ! -x "$FLUTTER_ROOT/bin/flutter" ]; then
  # Common local install locations
  for candidate in "$HOME/flutter" "$HOME/development/flutter" "/opt/flutter" "C:/flutter" "/c/flutter"; do
    if [ -x "$candidate/bin/flutter" ]; then
      export FLUTTER_ROOT="$candidate"
      break
    fi
  done
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$FLUTTER_ROOT/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

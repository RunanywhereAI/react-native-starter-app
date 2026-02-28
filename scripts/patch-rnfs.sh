#!/bin/bash
# Patch react-native-fs to fix NullPointerException crash on React Native New Architecture
# Bug: promise.reject(null, ...) crashes because PromiseImpl.reject requires non-null code
RNFS_MANAGER="node_modules/react-native-fs/android/src/main/java/com/rnfs/RNFSManager.java"

if [ -f "$RNFS_MANAGER" ]; then
  sed -i.bak 's/promise.reject(null, ex.getMessage())/promise.reject("EUNSPECIFIED", ex.getMessage())/' "$RNFS_MANAGER"
  rm -f "${RNFS_MANAGER}.bak"
  echo "✅ Patched RNFSManager.java (null code fix)"
fi

# Patch Downloader.java buffer sizes for faster downloads (8KB -> 256KB)
DOWNLOADER="node_modules/react-native-fs/android/src/main/java/com/rnfs/Downloader.java"

if [ -f "$DOWNLOADER" ]; then
  sed -i.bak 's/new BufferedInputStream(connection.getInputStream(), 8 \* 1024)/new BufferedInputStream(connection.getInputStream(), 512 * 1024)/' "$DOWNLOADER"
  sed -i.bak 's/new byte\[8 \* 1024\]/new byte[256 * 1024]/' "$DOWNLOADER"
  rm -f "${DOWNLOADER}.bak"
  echo "✅ Patched Downloader.java (256KB buffer)"
fi

# Patch RunAnywhere SDK to use foreground downloads (Android OEMs throttle background downloads)
SDK_FILE="node_modules/@runanywhere/core/src/services/FileSystem.ts"

if [ -f "$SDK_FILE" ]; then
  sed -i.bak 's/background: true,/background: false,/' "$SDK_FILE"
  rm -f "${SDK_FILE}.bak"
  echo "✅ Patched FileSystem.ts (foreground download)"
fi

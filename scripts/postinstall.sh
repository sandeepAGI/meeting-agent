#!/bin/bash

# Postinstall script to fix whisper-node-addon native module path and rpaths
# Issue 1: The package uses 'darwin-arm64' but provides 'mac-arm64'
# Issue 2: The .node file has incorrect @rpath for dylibs

ADDON_DIR="./node_modules/@kutalia/whisper-node-addon/dist"

# Fix folder naming
if [ -d "$ADDON_DIR/mac-arm64" ] && [ ! -e "$ADDON_DIR/darwin-arm64" ]; then
  echo "Creating symlink for whisper-node-addon darwin-arm64 → mac-arm64"
  cd "$ADDON_DIR"
  ln -s mac-arm64 darwin-arm64
  echo "✅ Symlink created successfully"
fi

if [ -d "$ADDON_DIR/mac-x64" ] && [ ! -e "$ADDON_DIR/darwin-x64" ]; then
  echo "Creating symlink for whisper-node-addon darwin-x64 → mac-x64"
  cd "$ADDON_DIR"
  ln -s mac-x64 darwin-x64
  echo "✅ Symlink created successfully"
fi

# Fix dylib rpaths for macOS
if [ "$(uname)" = "Darwin" ]; then
  ARCH=$(uname -m)
  if [ "$ARCH" = "arm64" ]; then
    PLATFORM_DIR="$ADDON_DIR/mac-arm64"
  else
    PLATFORM_DIR="$ADDON_DIR/mac-x64"
  fi

  if [ -f "$PLATFORM_DIR/whisper.node" ]; then
    echo "Fixing dylib paths for whisper.node..."

    # Change @rpath references to use @loader_path (relative to the .node file)
    install_name_tool -change "@rpath/libwhisper.1.dylib" "@loader_path/libwhisper.1.dylib" "$PLATFORM_DIR/whisper.node" 2>/dev/null || true
    install_name_tool -change "@rpath/libggml.dylib" "@loader_path/libggml.dylib" "$PLATFORM_DIR/whisper.node" 2>/dev/null || true
    install_name_tool -change "@rpath/libggml-cpu.dylib" "@loader_path/libggml-cpu.dylib" "$PLATFORM_DIR/whisper.node" 2>/dev/null || true
    install_name_tool -change "@rpath/libggml-blas.dylib" "@loader_path/libggml-blas.dylib" "$PLATFORM_DIR/whisper.node" 2>/dev/null || true
    install_name_tool -change "@rpath/libggml-metal.dylib" "@loader_path/libggml-metal.dylib" "$PLATFORM_DIR/whisper.node" 2>/dev/null || true
    install_name_tool -change "@rpath/libggml-base.dylib" "@loader_path/libggml-base.dylib" "$PLATFORM_DIR/whisper.node" 2>/dev/null || true

    # Also fix the dylibs themselves to reference each other correctly
    if [ -f "$PLATFORM_DIR/libwhisper.1.dylib" ]; then
      install_name_tool -change "@rpath/libggml.dylib" "@loader_path/libggml.dylib" "$PLATFORM_DIR/libwhisper.1.dylib" 2>/dev/null || true
      install_name_tool -change "@rpath/libggml-base.dylib" "@loader_path/libggml-base.dylib" "$PLATFORM_DIR/libwhisper.1.dylib" 2>/dev/null || true
    fi

    echo "✅ dylib paths fixed successfully"
  fi
fi

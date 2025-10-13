#!/usr/bin/env node
/**
 * Simple test to verify the worker thread can be loaded
 */

const path = require('path')
const fs = require('fs')

console.log('=== Worker Thread Test ===\n')

// Check worker file exists
const workerPath = path.join(__dirname, 'dist/main/services/transcriptionWorker.js')
console.log('1. Checking worker path:', workerPath)

if (fs.existsSync(workerPath)) {
  console.log('   ✅ Worker file exists\n')
} else {
  console.log('   ❌ Worker file NOT found\n')
  process.exit(1)
}

// Check worker can be required (syntax check)
try {
  console.log('2. Checking worker syntax...')
  require(workerPath)
  console.log('   ⚠️  Worker loaded but should only run in worker_threads context\n')
} catch (error) {
  // Expected - parentPort will be null in main thread
  if (error.message.includes('parentPort')) {
    console.log('   ✅ Worker file is valid (expected error: parentPort is null)\n')
  } else {
    console.log('   ❌ Worker has syntax/import errors:', error.message, '\n')
    process.exit(1)
  }
}

// Check model file
const modelPath = path.join(__dirname, 'models/ggml-base.bin')
console.log('3. Checking model file:', modelPath)

if (fs.existsSync(modelPath)) {
  const stats = fs.statSync(modelPath)
  console.log(`   ✅ Model file exists (${(stats.size / 1024 / 1024).toFixed(1)} MB)\n`)
} else {
  console.log('   ❌ Model file NOT found\n')
  process.exit(1)
}

// Check native addon
const addonPath = path.join(__dirname, 'node_modules/@kutalia/whisper-node-addon/dist/darwin-arm64/whisper.node')
console.log('4. Checking native addon:', addonPath)

if (fs.existsSync(addonPath)) {
  console.log('   ✅ Native addon exists\n')
} else {
  console.log('   ❌ Native addon NOT found\n')
  process.exit(1)
}

// Try to load the addon
try {
  console.log('5. Loading native addon...')
  const whisper = require('@kutalia/whisper-node-addon')
  console.log('   ✅ Native addon loaded successfully\n')

  if (typeof whisper.transcribe === 'function') {
    console.log('   ✅ whisper.transcribe() function is available\n')
  } else {
    console.log('   ❌ whisper.transcribe() function NOT found\n')
    process.exit(1)
  }
} catch (error) {
  console.log('   ❌ Failed to load native addon:', error.message, '\n')
  process.exit(1)
}

console.log('=== All Checks Passed! ===')
console.log('The worker thread should work correctly in the Electron app.\n')

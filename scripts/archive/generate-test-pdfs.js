#!/usr/bin/env node
/**
 * Generate PDF reports from test log files
 *
 * Uses macOS's built-in cupsfilter to convert text to PDF
 */

const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

// Input log files
const logs = [
  {
    input: '/tmp/test-c200.log',
    output: 'test-c200-report.pdf',
    title: 'C200 Sync Test Report'
  },
  {
    input: '/tmp/test-sync3.log',
    output: 'test-sync3-report.pdf',
    title: 'Sync #3 Test Report'
  }
];

async function convertToPDF(logFile, outputFile, title) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(logFile)) {
      reject(new Error(`Log file not found: ${logFile}`));
      return;
    }

    // Read the log file and filter out dotenv banners
    const content = fs.readFileSync(logFile, 'utf-8');
    const cleanedContent = content
      .split('\n')
      .filter(line => !line.includes('[dotenv@') && !line.includes('tip:'))
      .join('\n');

    // Write cleaned content to a temporary file
    const tempFile = `/tmp/${path.basename(outputFile, '.pdf')}-clean.txt`;
    fs.writeFileSync(tempFile, cleanedContent);

    // Use macOS's cupsfilter directly with text input
    const command = `cupsfilter -D -o media=Letter -o fitplot -i text/plain ${tempFile} > ${outputFile}`;

    exec(command, (error, stdout, stderr) => {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        // Ignore cleanup errors
      }

      if (error) {
        console.error(`Error converting ${logFile}:`, stderr);
        reject(error);
      } else {
        console.log(`✅ Created ${outputFile}`);
        resolve(outputFile);
      }
    });
  });
}

async function main() {
  console.log('📄 Generating PDF reports from test logs...\n');

  for (const { input, output, title } of logs) {
    try {
      await convertToPDF(input, output, title);
    } catch (error) {
      console.error(`❌ Failed to generate ${output}:`, error.message);
    }
  }

  console.log('\n✅ PDF generation complete!');
  console.log('\nGenerated files:');
  console.log('  - test-c200-report.pdf');
  console.log('  - test-sync3-report.pdf');
}

main().catch(console.error);

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
require('dotenv').config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function downloadResults(batchId, filename) {
  try {
    const batch = await anthropic.messages.batches.retrieve(batchId);
    
    if (!batch.results_url) {
      console.log(`No results URL for ${batchId}`);
      return null;
    }
    
    // Use Anthropic SDK's authenticated fetch
    const response = await fetch(batch.results_url, {
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });
    
    const resultsText = await response.text();
    
    // Save to file
    fs.writeFileSync(filename, resultsText);
    console.log(`Saved ${resultsText.length} bytes to ${filename}`);
    
    // Parse first line
    const lines = resultsText.trim().split('\n');
    const firstResult = JSON.parse(lines[0]);
    
    return firstResult;
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

(async () => {
  console.log('Downloading Pass 1 results...');
  const pass1 = await downloadResults(
    'msgbatch_01HCLuJFC1TbBth7SFNUFp6j',
    'pass1-results.jsonl'
  );
  
  console.log('\nDownloading Pass 2 results...');
  const pass2 = await downloadResults(
    'msgbatch_012eQr8dm7jVcGNEZcBtdZCw',
    'pass2-results.jsonl'
  );
  
  console.log('\nResults downloaded successfully!');
  console.log('- pass1-results.jsonl');
  console.log('- pass2-results.jsonl');
})();

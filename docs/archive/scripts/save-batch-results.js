const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
require('dotenv').config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function saveBatchResults(batchId, filename) {
  try {
    const batch = await anthropic.messages.batches.retrieve(batchId);
    
    if (!batch.results_url) {
      console.log(`No results URL for ${batchId}`);
      return null;
    }
    
    const response = await fetch(batch.results_url);
    const resultsText = await response.text();
    
    // Save to file
    fs.writeFileSync(filename, resultsText);
    console.log(`Saved ${resultsText.length} bytes to ${filename}`);
    
    // Parse and return first result
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
  const pass1 = await saveBatchResults(
    'msgbatch_01HCLuJFC1TbBth7SFNUFp6j',
    'pass1-results.jsonl'
  );
  
  console.log('\nDownloading Pass 2 results...');
  const pass2 = await saveBatchResults(
    'msgbatch_012eQr8dm7jVcGNEZcBtdZCw',
    'pass2-results.jsonl'
  );
  
  if (pass1) {
    console.log('\n=== PASS 1 RESULT STRUCTURE ===');
    console.log('Custom ID:', pass1.custom_id);
    console.log('Result type:', pass1.result.type);
    if (pass1.result.type === 'succeeded') {
      const content = pass1.result.message.content[0].text;
      console.log('Content length:', content.length);
      console.log('Content preview (first 200 chars):');
      console.log(content.substring(0, 200));
    }
  }
  
  if (pass2) {
    console.log('\n=== PASS 2 RESULT STRUCTURE ===');
    console.log('Custom ID:', pass2.custom_id);
    console.log('Result type:', pass2.result.type);
    if (pass2.result.type === 'succeeded') {
      const content = pass2.result.message.content[0].text;
      console.log('Content length:', content.length);
      console.log('Content preview (first 200 chars):');
      console.log(content.substring(0, 200));
    }
  }
})();

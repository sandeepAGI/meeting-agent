const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function retrieveBatch(batchId) {
  try {
    console.log(`\n=== Retrieving batch: ${batchId} ===`);
    const batch = await anthropic.messages.batches.retrieve(batchId);
    console.log('Status:', batch.processing_status);
    console.log('Created at:', batch.created_at);
    console.log('Ended at:', batch.ended_at);
    console.log('Results URL:', batch.results_url || 'Not available');
    
    if (batch.results_url) {
      const response = await fetch(batch.results_url);
      const results = await response.text();
      return results;
    }
    return null;
  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

(async () => {
  console.log('Retrieving Pass 1 results...');
  const pass1Results = await retrieveBatch('msgbatch_01HCLuJFC1TbBth7SFNUFp6j');
  
  console.log('\nRetrieving Pass 2 results...');
  const pass2Results = await retrieveBatch('msgbatch_012eQr8dm7jVcGNEZcBtdZCw');
  
  if (pass1Results) {
    console.log('\n=== PASS 1 RESULTS AVAILABLE ===');
    console.log('Length:', pass1Results.length, 'bytes');
  }
  
  if (pass2Results) {
    console.log('\n=== PASS 2 RESULTS AVAILABLE ===');
    console.log('Length:', pass2Results.length, 'bytes');
  }
})();

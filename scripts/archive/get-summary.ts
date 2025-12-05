#!/usr/bin/env node
/**
 * Retrieve and display a meeting summary from the database
 *
 * Usage:
 *   npx tsx scripts/get-summary.ts <summary-id>
 */

import * as path from 'path';
import { DatabaseService } from '../src/services/database';

const summaryId = process.argv[2];

if (!summaryId) {
  console.error('Usage: npx tsx scripts/get-summary.ts <summary-id>');
  process.exit(1);
}

const dbPath = path.join(process.cwd(), 'data', 'test-meeting-agent.db');
const dbService = new DatabaseService(dbPath);

const summary = dbService.getSummary(summaryId);

if (!summary) {
  console.error(`Summary not found: ${summaryId}`);
  process.exit(1);
}

console.log('='.repeat(80));
console.log('MEETING SUMMARY');
console.log('='.repeat(80));
console.log(`\nID: ${summary.id}`);
console.log(`Status: ${summary.status}`);
console.log(`Created: ${summary.created_at}`);
console.log(`Updated: ${summary.updated_at}`);

if (summary.speakerMapping) {
  console.log('\n🗣️  SPEAKER IDENTIFICATION:');
  for (const [genericId, name] of Object.entries(summary.speakerMapping)) {
    const confidence = summary.speakerConfidence?.[genericId] || 'unknown';
    console.log(`  ${genericId} → ${name} (confidence: ${confidence})`);
  }
}

if (summary.actionItems && summary.actionItems.length > 0) {
  console.log('\n✅ ACTION ITEMS:');
  summary.actionItems.forEach((item: any, i: number) => {
    console.log(`  ${i + 1}. ${item.text || item}`);
    if (item.owner) console.log(`     Owner: ${item.owner}`);
    if (item.deadline) console.log(`     Deadline: ${item.deadline}`);
  });
}

if (summary.keyDecisions && summary.keyDecisions.length > 0) {
  console.log('\n🎯 KEY DECISIONS:');
  summary.keyDecisions.forEach((decision: any, i: number) => {
    console.log(`  ${i + 1}. ${decision.text || decision}`);
  });
}

if (summary.summary) {
  console.log('\n📄 MEETING SUMMARY:');
  console.log(summary.summary);
}

console.log('\n' + '='.repeat(80));

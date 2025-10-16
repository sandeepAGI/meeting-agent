#!/usr/bin/env node
/**
 * Generate formatted text report from test results JSON
 */

const fs = require('fs');
const { exec } = require('child_process');

function formatReport(result) {
  const lines = [];

  lines.push('='.repeat(80));
  lines.push('END-TO-END PIPELINE TEST RESULTS');
  lines.push('='.repeat(80));
  lines.push('');

  // Summary Statistics
  lines.push('📊 SUMMARY STATISTICS:');
  lines.push(`  Transcript: ${result.transcript.segments.length} segments, ${Math.floor(result.transcript.metadata.totalDuration / 60)}m duration`);
  lines.push(`  Speakers: ${Object.keys(result.transcript.speakers).length} (${Object.values(result.transcript.speakers).join(', ')})`);
  lines.push(`  Email Context: ${result.emailCount} emails fetched`);
  lines.push(`  Calendar Match: ${result.calendar.matchConfidence} confidence (${result.calendar.matchReason})`);
  lines.push('');

  // Processing Time
  lines.push('⏱️  PROCESSING TIME:');
  lines.push(`  Email Fetch: ${result.duration.emailFetch}ms`);
  lines.push(`  Pass 1 (Speaker ID + Summary): ${Math.floor(result.duration.pass1 / 1000)}s`);
  lines.push(`  Pass 2 (Validation): ${Math.floor(result.duration.pass2 / 1000)}s`);
  lines.push(`  Total: ${Math.floor(result.duration.total / 1000)}s`);
  lines.push('');

  if (result.finalSummary) {
    // Parse JSON fields
    const speakers = JSON.parse(
      result.finalSummary.final_speakers_json ||
      result.finalSummary.pass2_validated_speakers_json ||
      result.finalSummary.pass1_speaker_mappings_json ||
      '[]'
    );
    const actionItems = JSON.parse(
      result.finalSummary.final_action_items_json ||
      result.finalSummary.pass2_validated_action_items_json ||
      result.finalSummary.pass1_action_items_json ||
      '[]'
    );
    const keyDecisions = JSON.parse(
      result.finalSummary.final_key_decisions_json ||
      result.finalSummary.pass2_validated_key_decisions_json ||
      result.finalSummary.pass1_key_decisions_json ||
      '[]'
    );
    const detailedNotes = JSON.parse(
      result.finalSummary.final_detailed_notes_json ||
      result.finalSummary.pass2_refined_detailed_notes_json ||
      result.finalSummary.pass1_detailed_notes_json ||
      '{}'
    );
    const summary = result.finalSummary.final_summary ||
      result.finalSummary.pass2_refined_summary ||
      result.finalSummary.pass1_summary ||
      '';

    lines.push('📝 OVERVIEW:');
    lines.push(`  Speaker Mappings: ${speakers.length}`);
    lines.push(`  Action Items: ${actionItems.length}`);
    lines.push(`  Key Decisions: ${keyDecisions.length}`);
    lines.push(`  Discussion Topics: ${detailedNotes.discussion_by_topic?.length || 0}`);
    lines.push('');

    if (speakers.length > 0) {
      lines.push('🗣️  SPEAKER IDENTIFICATION:');
      speakers.forEach(speaker => {
        lines.push(`  ${speaker.label} → ${speaker.name} <${speaker.email}> (${speaker.confidence} confidence)`);
      });
      lines.push('');
    }

    if (summary) {
      lines.push('📄 EXECUTIVE SUMMARY:');
      lines.push(`  ${summary}`);
      lines.push('');
    }

    // DETAILED DISCUSSION BY TOPIC
    if (detailedNotes.discussion_by_topic && detailedNotes.discussion_by_topic.length > 0) {
      lines.push('💬 DETAILED DISCUSSION BY TOPIC:');
      lines.push('');
      detailedNotes.discussion_by_topic.forEach((topic, i) => {
        lines.push(`${i + 1}. ${topic.topic.toUpperCase()}`);
        lines.push('');

        if (topic.key_points && topic.key_points.length > 0) {
          lines.push('   Key Points:');
          topic.key_points.forEach(point => {
            lines.push(`   • ${point}`);
          });
          lines.push('');
        }

        if (topic.decisions && topic.decisions.length > 0) {
          lines.push('   Decisions:');
          topic.decisions.forEach(decision => {
            lines.push(`   ✓ ${decision}`);
          });
          lines.push('');
        }

        if (topic.action_items && topic.action_items.length > 0) {
          lines.push('   Action Items:');
          topic.action_items.forEach(item => {
            lines.push(`   → ${item.description}`);
            if (item.assignee) lines.push(`     Assignee: ${item.assignee}`);
            if (item.priority) lines.push(`     Priority: ${item.priority}`);
          });
          lines.push('');
        }

        lines.push('-'.repeat(80));
        lines.push('');
      });
    }

    // NOTABLE QUOTES
    if (detailedNotes.notable_quotes && detailedNotes.notable_quotes.length > 0) {
      lines.push('💭 NOTABLE QUOTES:');
      detailedNotes.notable_quotes.forEach((quote, i) => {
        lines.push(`  ${i + 1}. ${quote.speaker}: "${quote.quote}"`);
      });
      lines.push('');
    }

    // OPEN QUESTIONS
    if (detailedNotes.open_questions && detailedNotes.open_questions.length > 0) {
      lines.push('❓ OPEN QUESTIONS:');
      detailedNotes.open_questions.forEach((question, i) => {
        lines.push(`  ${i + 1}. ${question}`);
      });
      lines.push('');
    }

    // PARKING LOT
    if (detailedNotes.parking_lot && detailedNotes.parking_lot.length > 0) {
      lines.push('🅿️  PARKING LOT (Deferred Items):');
      detailedNotes.parking_lot.forEach((item, i) => {
        lines.push(`  ${i + 1}. ${item}`);
      });
      lines.push('');
    }

    // ALL ACTION ITEMS SUMMARY
    if (actionItems.length > 0) {
      lines.push('✅ ALL ACTION ITEMS (Consolidated):');
      actionItems.forEach((item, i) => {
        lines.push(`  ${i + 1}. ${item.description}`);
        if (item.assignee) lines.push(`     Assignee: ${item.assignee}`);
        if (item.priority) lines.push(`     Priority: ${item.priority}`);
        if (item.dueDate) lines.push(`     Due: ${item.dueDate}`);
      });
      lines.push('');
    }

    // ALL KEY DECISIONS SUMMARY
    if (keyDecisions.length > 0) {
      lines.push('🎯 ALL KEY DECISIONS (Consolidated):');
      keyDecisions.forEach((decision, i) => {
        lines.push(`  ${i + 1}. ${decision}`);
      });
      lines.push('');
    }
  } else {
    lines.push('❌ NO SUMMARY GENERATED');
    lines.push('');
    if (result.pass2Result && result.pass2Result.error) {
      lines.push('ERROR:');
      lines.push(`  ${result.pass2Result.error}`);
      lines.push('');
    }
  }

  lines.push('='.repeat(80));

  return lines.join('\n');
}

async function generateReport(jsonPath, outputTxt) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(jsonPath)) {
      reject(new Error(`JSON file not found: ${jsonPath}`));
      return;
    }

    try {
      // Read and format the JSON
      const result = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      const report = formatReport(result);

      // Write directly to text file
      fs.writeFileSync(outputTxt, report);
      console.log(`✅ Created ${outputTxt}`);
      resolve(outputTxt);
    } catch (error) {
      console.error(`Error generating ${outputTxt}:`, error.message);
      reject(error);
    }
  });
}

async function main() {
  console.log('📄 Generating detailed text reports from test results JSON...\n');

  const reports = [
    {
      json: 'tests/fixtures/manual-e2e/converted/2025-09-18-Sync-on-C200-test-results.json',
      txt: 'test-c200-report.txt'
    },
    {
      json: 'tests/fixtures/manual-e2e/converted/2025-10-7-Sync-3-test-results.json',
      txt: 'test-sync3-report.txt'
    }
  ];

  for (const { json, txt } of reports) {
    try {
      await generateReport(json, txt);
    } catch (error) {
      console.error(`❌ Failed to generate ${txt}:`, error.message);
    }
  }

  console.log('\n✅ Report generation complete!');
}

main().catch(console.error);

/**
 * Panel Discussion Summary Generator
 *
 * 3-pass workflow for generating summaries of panel discussions:
 * - Pass 1: Map SPEAKER_XX to actual panelist names
 * - Pass 2: Generate individual speaker summaries
 * - Pass 3: Synthesize key takeaways and recommendations
 *
 * Usage: tsx scripts/panel-discussion-summary.ts <recording_id>
 *
 * Example: tsx scripts/panel-discussion-summary.ts 5de8fee9-9296-49f9-8a4a-e2ad3b85f994
 */

import { DatabaseService } from '../src/services/database'
import { ClaudeBatchService } from '../src/services/claudeBatch'
import { PromptLoader } from '../src/utils/promptLoader'
import { parseJSONFromLLM } from './utils/parseJSON'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const userDataPath = process.env.ELECTRON_USER_DATA_PATH ||
  path.join(process.env.HOME || '', 'Library/Application Support/meeting-agent')

const dbPath = path.join(userDataPath, 'meeting-agent.db')

interface PanelConfig {
  eventName: string
  topic: string
  date: string
  panelistsInOrder: string
  audience: string
}

/**
 * Merge transcript segments with diarization speaker labels
 */
function mergeDiarizationWithTranscript(
  transcriptSegments: any[],
  diarizationSegments: any[]
): string {
  const merged: Array<{ speaker: string; text: string; start: number }> = []
  let currentSpeaker: string | null = null
  let currentText = ''
  let currentStart = 0

  for (const diarSeg of diarizationSegments) {
    if (currentSpeaker !== diarSeg.speaker) {
      if (currentText.trim()) {
        merged.push({
          speaker: currentSpeaker!,
          text: currentText.trim(),
          start: currentStart
        })
      }
      currentSpeaker = diarSeg.speaker
      currentText = ''
      currentStart = diarSeg.start
    }

    // Find matching transcript segments
    const matches = transcriptSegments.filter(
      (t) =>
        t.offsets.from / 1000 <= diarSeg.end &&
        t.offsets.to / 1000 >= diarSeg.start
    )

    for (const match of matches) {
      currentText += ' ' + match.text
    }
  }

  // Add last segment
  if (currentText.trim() && currentSpeaker) {
    merged.push({ speaker: currentSpeaker, text: currentText.trim(), start: currentStart })
  }

  // Format as transcript
  return merged
    .map((m) => {
      const time =
        Math.floor(m.start / 60) +
        ':' +
        String(Math.floor(m.start % 60)).padStart(2, '0')
      return `[${time}] [${m.speaker}]: ${m.text}`
    })
    .join('\n\n')
}

/**
 * Run Pass 1: Speaker Mapping
 */
async function runPass1SpeakerMapping(
  claudeService: ClaudeBatchService,
  promptLoader: PromptLoader,
  transcript: string,
  config: PanelConfig
): Promise<any> {
  console.log('\n📋 Pass 1: Speaker Mapping')
  console.log('━'.repeat(60))

  const prompt = promptLoader.loadAndSubstitute('panel-pass1-speaker-mapping.txt', {
    eventName: config.eventName,
    topic: config.topic,
    date: config.date,
    panelistsInOrder: config.panelistsInOrder,
    transcript: transcript
  })

  // For Pass 1, use immediate API (not batch) for faster speaker mapping
  // This allows us to use the mapped names in Pass 2
  console.log('Submitting speaker mapping request to Claude API...')

  const batchRequests = [
    {
      custom_id: 'pass1-speaker-mapping',
      params: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user' as const,
            content: prompt
          }
        ]
      }
    }
  ]

  const batchId = await claudeService.submitBatch(batchRequests)
  console.log(`✅ Batch submitted: ${batchId}`)
  console.log('⏳ Polling for results (this may take 30-60 minutes)...\n')

  // Poll for completion
  const status = await claudeService.pollBatchStatus(batchId, (status) => {
    console.log(
      `   Status: ${status.status}, ` +
        `Processed: ${status.request_counts.succeeded}/${status.request_counts.processing + status.request_counts.succeeded}`
    )
  })

  // Retrieve results
  console.log('\n📥 Retrieving results...')
  const results = await claudeService.retrieveResults(batchId)

  if (results.length === 0 || results[0].result.type !== 'succeeded') {
    throw new Error('Pass 1 failed or returned no results')
  }

  const content = results[0].result.message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response format from Pass 1')
  }

  // Debug: Save raw response to file
  const debugDir = path.join(process.cwd(), 'output')
  if (!fs.existsSync(debugDir)) {
    fs.mkdirSync(debugDir, { recursive: true })
  }
  fs.writeFileSync(path.join(debugDir, 'pass1-raw-response.txt'), content.text, 'utf-8')
  console.log('📝 Saved raw response to output/pass1-raw-response.txt for debugging\n')

  const speakerMappings = parseJSONFromLLM(content.text)
  console.log(`✅ Pass 1 complete! Mapped ${speakerMappings.speaker_mappings.length} speakers\n`)

  return speakerMappings
}

/**
 * Apply speaker mappings to transcript
 */
function applySpeakerMappings(transcript: string, mappings: any): string {
  let result = transcript

  for (const mapping of mappings.speaker_mappings) {
    const regex = new RegExp(`\\[${mapping.label}\\]`, 'g')
    result = result.replace(regex, `[${mapping.name}]`)
  }

  return result
}

/**
 * Run Pass 2: Individual Speaker Summaries
 */
async function runPass2IndividualSummaries(
  claudeService: ClaudeBatchService,
  promptLoader: PromptLoader,
  transcriptWithNames: string,
  speakerMappings: any,
  config: PanelConfig
): Promise<any> {
  console.log('\n📋 Pass 2: Individual Speaker Summaries')
  console.log('━'.repeat(60))

  const prompt = promptLoader.loadAndSubstitute('panel-pass2-individual-summaries.txt', {
    eventName: config.eventName,
    topic: config.topic,
    date: config.date,
    speakerMappings: JSON.stringify(speakerMappings.speaker_mappings, null, 2),
    transcript: transcriptWithNames
  })

  console.log('Submitting individual summaries request to Claude Batch API...')

  const batchRequests = [
    {
      custom_id: 'pass2-individual-summaries',
      params: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [
          {
            role: 'user' as const,
            content: prompt
          }
        ]
      }
    }
  ]

  const batchId = await claudeService.submitBatch(batchRequests)
  console.log(`✅ Batch submitted: ${batchId}`)
  console.log('⏳ Polling for results (this may take 30-60 minutes)...\n')

  // Poll for completion
  const status = await claudeService.pollBatchStatus(batchId, (status) => {
    console.log(
      `   Status: ${status.status}, ` +
        `Processed: ${status.request_counts.succeeded}/${status.request_counts.processing + status.request_counts.succeeded}`
    )
  })

  // Retrieve results
  console.log('\n📥 Retrieving results...')
  const results = await claudeService.retrieveResults(batchId)

  if (results.length === 0 || results[0].result.type !== 'succeeded') {
    throw new Error('Pass 2 failed or returned no results')
  }

  const content = results[0].result.message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response format from Pass 2')
  }

  const individualSummaries = parseJSONFromLLM(content.text)
  console.log(`✅ Pass 2 complete! Generated ${individualSummaries.individual_summaries.length} speaker summaries\n`)

  return individualSummaries
}

/**
 * Run Pass 3: Synthesis & Key Takeaways
 */
async function runPass3Synthesis(
  claudeService: ClaudeBatchService,
  promptLoader: PromptLoader,
  transcriptWithNames: string,
  individualSummaries: any,
  config: PanelConfig
): Promise<any> {
  console.log('\n📋 Pass 3: Synthesis & Key Takeaways')
  console.log('━'.repeat(60))

  const prompt = promptLoader.loadAndSubstitute('panel-pass3-synthesis.txt', {
    eventName: config.eventName,
    topic: config.topic,
    date: config.date,
    audience: config.audience,
    individualSummaries: JSON.stringify(individualSummaries.individual_summaries, null, 2),
    transcript: transcriptWithNames
  })

  console.log('Submitting synthesis request to Claude Batch API...')

  const batchRequests = [
    {
      custom_id: 'pass3-synthesis',
      params: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [
          {
            role: 'user' as const,
            content: prompt
          }
        ]
      }
    }
  ]

  const batchId = await claudeService.submitBatch(batchRequests)
  console.log(`✅ Batch submitted: ${batchId}`)
  console.log('⏳ Polling for results (this may take 30-60 minutes)...\n')

  // Poll for completion
  const status = await claudeService.pollBatchStatus(batchId, (status) => {
    console.log(
      `   Status: ${status.status}, ` +
        `Processed: ${status.request_counts.succeeded}/${status.request_counts.processing + status.request_counts.succeeded}`
    )
  })

  // Retrieve results
  console.log('\n📥 Retrieving results...')
  const results = await claudeService.retrieveResults(batchId)

  if (results.length === 0 || results[0].result.type !== 'succeeded') {
    throw new Error('Pass 3 failed or returned no results')
  }

  const content = results[0].result.message.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response format from Pass 3')
  }

  const synthesis = parseJSONFromLLM(content.text)
  console.log(`✅ Pass 3 complete! Generated synthesis with ${synthesis.key_takeaways_by_theme.length} themes\n`)

  return synthesis
}

/**
 * Generate Markdown output
 */
function generateMarkdown(
  config: PanelConfig,
  speakerMappings: any,
  individualSummaries: any,
  synthesis: any
): string {
  let md = ''

  // Header
  md += `# ${config.eventName}\n\n`
  md += `**Topic:** ${config.topic}\n\n`
  md += `**Date:** ${config.date}\n\n`
  md += `**Panelists:** ${config.panelistsInOrder}\n\n`
  md += `---\n\n`

  // Individual Speaker Summaries
  md += `## Individual Speaker Contributions\n\n`

  for (const summary of individualSummaries.individual_summaries) {
    md += `### ${summary.speaker_name}`
    if (summary.role) {
      md += ` - ${summary.role}`
    }
    md += `\n\n`

    if (summary.summary_type === 'moderator') {
      md += `${summary.contribution}\n\n`
    } else {
      if (summary.main_focus) {
        md += `**Main Focus:** ${summary.main_focus}\n\n`
      }

      if (summary.implementation_details) {
        md += `**Implementation:** ${summary.implementation_details}\n\n`
      }

      if (summary.key_points && summary.key_points.length > 0) {
        md += `**Key Points:**\n`
        for (const point of summary.key_points) {
          md += `- ${point}\n`
        }
        md += `\n`
      }

      if (summary.challenges_mentioned && summary.challenges_mentioned.length > 0) {
        md += `**Challenges:**\n`
        for (const challenge of summary.challenges_mentioned) {
          md += `- ${challenge}\n`
        }
        md += `\n`
      }

      if (summary.notable_quotes && summary.notable_quotes.length > 0) {
        md += `**Notable Quotes:**\n`
        for (const quote of summary.notable_quotes) {
          md += `> "${quote}"\n\n`
        }
      }
    }
  }

  md += `---\n\n`

  // Key Takeaways by Theme
  md += `## Key Takeaways for ${config.audience}\n\n`

  for (const theme of synthesis.key_takeaways_by_theme) {
    md += `### ${theme.theme}\n\n`
    md += `${theme.summary}\n\n`

    if (theme.key_insights && theme.key_insights.length > 0) {
      md += `**Key Insights:**\n`
      for (const insight of theme.key_insights) {
        md += `- ${insight}\n`
      }
      md += `\n`
    }

    if (theme.practical_implications) {
      md += `**Practical Implications:**\n${theme.practical_implications}\n\n`
    }
  }

  md += `---\n\n`

  // Recommendations
  md += `## Recommendations from the Panel\n\n`

  for (const rec of synthesis.recommendations) {
    md += `### ${rec.recommendation}\n\n`
    if (rec.source) {
      md += `**Source:** ${rec.source}\n\n`
    }
    if (rec.context) {
      md += `**Context:** ${rec.context}\n\n`
    }
  }

  md += `---\n\n`

  // Open Questions
  if (synthesis.open_questions && synthesis.open_questions.length > 0) {
    md += `## Open Questions\n\n`
    for (const question of synthesis.open_questions) {
      md += `- ${question}\n`
    }
    md += `\n---\n\n`
  }

  // Overall Synthesis
  md += `## Overall Synthesis\n\n`
  md += `${synthesis.overall_synthesis}\n\n`

  md += `---\n\n`
  md += `*Generated by Meeting Agent - Panel Discussion Summary*\n`

  return md
}

/**
 * Main function
 */
async function main() {
  const recordingId = process.argv[2]

  if (!recordingId) {
    console.error('\n❌ Error: Recording ID required')
    console.log('\nUsage: tsx scripts/panel-discussion-summary.ts <recording_id>')
    console.log('\nExample: tsx scripts/panel-discussion-summary.ts 5de8fee9-9296-49f9-8a4a-e2ad3b85f994\n')
    process.exit(1)
  }

  console.log('\n🎬 Panel Discussion Summary Generator')
  console.log('━'.repeat(60))
  console.log(`Recording ID: ${recordingId}`)
  console.log(`Database: ${dbPath}\n`)

  // Check API key
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'sk-ant-xxx') {
    console.error('\n❌ Error: ANTHROPIC_API_KEY not configured')
    console.log('Please set ANTHROPIC_API_KEY in .env file\n')
    process.exit(1)
  }

  // Initialize services
  const db = new DatabaseService(dbPath)
  const claudeService = new ClaudeBatchService(apiKey)
  const promptLoader = new PromptLoader()

  // Get recording data
  console.log('📥 Loading recording data from database...')

  // Get transcript
  const transcript = db.getTranscriptByRecordingId(recordingId)
  if (!transcript) {
    console.error(`\n❌ Error: No transcript found for recording ${recordingId}`)
    console.log('Please run transcription first.\n')
    process.exit(1)
  }

  // Get diarization
  const diarization = db.getDiarizationByTranscriptId(transcript.id)
  if (!diarization) {
    console.error(`\n❌ Error: No diarization found for recording ${recordingId}`)
    console.log('Please run diarization first.\n')
    process.exit(1)
  }

  console.log(`✅ Found transcript with ${JSON.parse(transcript.segments_json).length} segments`)
  console.log(`✅ Found diarization with ${diarization.num_speakers} speakers\n`)

  // Merge transcript with diarization
  console.log('🔄 Merging transcript with speaker labels...')
  const transcriptSegments = JSON.parse(transcript.segments_json)
  const diarizationSegments = JSON.parse(diarization.segments_json)
  const mergedTranscript = mergeDiarizationWithTranscript(
    transcriptSegments,
    diarizationSegments
  )
  console.log(`✅ Merged transcript: ${mergedTranscript.length} characters\n`)

  // Panel configuration - customize this for your event
  const config: PanelConfig = {
    eventName: 'MAPP Annual Meeting - AI & Automation Panel',
    topic: 'AI & Automation in Manufacturing',
    date: '2025-12-11',
    panelistsInOrder:
      'Derek Moeller (CognitionWorks, Moderator), Bob Breg (PTA Plastics), Christy Giardino (Admo), Chuck Forrestal (Metro Plastics Technologies), Troy Nix (MAPP Executive Director)',
    audience: 'MAPP Members (Manufacturers Association for Plastic Processors)'
  }

  // Run 3-pass workflow
  const speakerMappings = await runPass1SpeakerMapping(
    claudeService,
    promptLoader,
    mergedTranscript,
    config
  )

  const transcriptWithNames = applySpeakerMappings(mergedTranscript, speakerMappings)

  const individualSummaries = await runPass2IndividualSummaries(
    claudeService,
    promptLoader,
    transcriptWithNames,
    speakerMappings,
    config
  )

  const synthesis = await runPass3Synthesis(
    claudeService,
    promptLoader,
    transcriptWithNames,
    individualSummaries,
    config
  )

  // Generate markdown output
  console.log('\n📝 Generating Markdown output...')
  const markdown = generateMarkdown(config, speakerMappings, individualSummaries, synthesis)

  // Save to file
  const outputDir = path.join(process.cwd(), 'output')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0]
  const outputPath = path.join(outputDir, `panel-summary-${timestamp}.md`)

  fs.writeFileSync(outputPath, markdown, 'utf-8')

  console.log(`✅ Markdown saved to: ${outputPath}`)
  console.log(`📄 File size: ${(markdown.length / 1024).toFixed(2)} KB\n`)

  console.log('━'.repeat(60))
  console.log('✅ Panel Discussion Summary Complete!')
  console.log('━'.repeat(60))
  console.log(`\n📊 Summary Statistics:`)
  console.log(`   Speakers identified: ${speakerMappings.speaker_mappings.length}`)
  console.log(`   Individual summaries: ${individualSummaries.individual_summaries.length}`)
  console.log(`   Themes identified: ${synthesis.key_takeaways_by_theme.length}`)
  console.log(`   Recommendations: ${synthesis.recommendations.length}`)
  console.log(`\n✅ Done!\n`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })

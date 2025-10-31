import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'
import dotenv from 'dotenv'
import { initializeAudioLoopback } from './audioSetup'
import { transcriptionService } from '../services/transcription'
import { DiarizationService } from '../services/diarization'
import { M365AuthService } from '../services/m365Auth'
import { GraphApiService } from '../services/graphApi'
import { DatabaseService } from '../services/database'
import { ClaudeBatchService } from '../services/claudeBatch'
import { EmailContextService } from '../services/emailContext'
import { MeetingIntelligenceService } from '../services/meetingIntelligence'
import { mergeDiarizationWithTranscript } from '../utils/mergeDiarization'
import type { TranscriptionOptions } from '../types/transcription'

// Load environment variables from .env file
dotenv.config()
console.log('[ENV] HUGGINGFACE_TOKEN configured:', !!process.env.HUGGINGFACE_TOKEN)
console.log('[ENV] AZURE_CLIENT_ID configured:', !!process.env.AZURE_CLIENT_ID)
console.log('[ENV] ANTHROPIC_API_KEY configured:', !!process.env.ANTHROPIC_API_KEY)

// Initialize diarization service
const diarizationService = new DiarizationService()

// Initialize M365 Auth service
let m365AuthService: M365AuthService | null = null
if (process.env.AZURE_CLIENT_ID) {
  m365AuthService = new M365AuthService(
    process.env.AZURE_CLIENT_ID,
    process.env.AZURE_TENANT_ID || 'common'
  )
}

// Initialize Database service (Phase 2.3-3)
const dbService = new DatabaseService()

// Initialize Graph API service
const graphApiService = new GraphApiService()
// Phase 2.3-4: Connect GraphAPI to database for meeting persistence
graphApiService.setDatabaseService(dbService)

// Initialize Meeting Intelligence services (Phase 2.3-3)
let claudeService: ClaudeBatchService | null = null
let emailService: EmailContextService | null = null
let intelligenceService: MeetingIntelligenceService | null = null

if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sk-ant-xxx') {
  claudeService = new ClaudeBatchService(
    process.env.ANTHROPIC_API_KEY,
    process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'
  )
  console.log('[MeetingIntelligence] Claude Batch API initialized')
}

let mainWindow: BrowserWindow | null = null

// Initialize audio loopback before app is ready
initializeAudioLoopback()

// IPC Handlers for transcription
ipcMain.handle('transcribe-audio', async (event, audioFilePath: string, options?: TranscriptionOptions) => {
  try {
    // Transcribe with progress updates
    const result = await transcriptionService.transcribe(
      audioFilePath,
      options,
      (progress) => {
        // Send progress updates to renderer
        event.sender.send('transcription-progress', progress)
      }
    )
    return { success: true, result }
  } catch (error) {
    console.error('Transcription error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transcription failed',
    }
  }
})

ipcMain.handle('save-audio-file', async (_event, blob: ArrayBuffer, filename: string) => {
  try {
    // Save audio file to app's userData directory
    const userDataPath = app.getPath('userData')
    const recordingsDir = path.join(userDataPath, 'recordings')

    // Create recordings directory if it doesn't exist
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true })
    }

    const filePath = path.join(recordingsDir, filename)

    // Write audio data to file
    fs.writeFileSync(filePath, Buffer.from(blob))

    console.log('Audio file saved:', filePath)
    return { success: true, filePath }
  } catch (error) {
    console.error('Failed to save audio file:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save audio file',
    }
  }
})

// Phase 1.5: Save audio chunk to session directory
ipcMain.handle('save-audio-chunk', async (_event, blob: ArrayBuffer, sessionId: string, filename: string) => {
  try {
    const userDataPath = app.getPath('userData')
    const sessionDir = path.join(userDataPath, 'recordings', sessionId)

    // Create session directory if it doesn't exist
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true })
    }

    const filePath = path.join(sessionDir, filename)

    // Write chunk data to file
    fs.writeFileSync(filePath, Buffer.from(blob))

    console.log('[Chunk] Saved:', filePath)
    return { success: true, filePath }
  } catch (error) {
    console.error('[Chunk] Failed to save:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save chunk',
    }
  }
})

// Phase 1.5: Merge audio chunks using FFmpeg
ipcMain.handle('merge-audio-chunks', async (_event, sessionId: string) => {
  try {
    const userDataPath = app.getPath('userData')
    const sessionDir = path.join(userDataPath, 'recordings', sessionId)

    // Check if session directory exists
    if (!fs.existsSync(sessionDir)) {
      throw new Error(`Session directory not found: ${sessionDir}`)
    }

    // Get all chunk files
    const files = fs.readdirSync(sessionDir)
    const chunkFiles = files
      .filter(file => file.startsWith('chunk_') && file.endsWith('.wav'))
      .sort() // Sort alphabetically (chunk_000, chunk_001, etc.)

    if (chunkFiles.length === 0) {
      throw new Error('No chunks found to merge')
    }

    console.log(`[Merge] Found ${chunkFiles.length} chunks for session ${sessionId}`)

    // If only one chunk, just rename it
    if (chunkFiles.length === 1) {
      const singleChunk = path.join(sessionDir, chunkFiles[0])
      const mergedPath = path.join(sessionDir, 'merged.wav')
      fs.renameSync(singleChunk, mergedPath)

      const stats = fs.statSync(mergedPath)
      return { success: true, filePath: mergedPath, sizeBytes: stats.size }
    }

    // Create concat file list for FFmpeg
    // ISSUE 1 FIX: Use relative paths in concat file (ffmpeg runs from sessionDir)
    const concatListPath = path.join(sessionDir, 'concat_list.txt')
    const concatContent = chunkFiles
      .map(file => `file '${file}'`)  // Relative path, just filename
      .join('\n')

    fs.writeFileSync(concatListPath, concatContent)

    // Merge chunks using FFmpeg
    const mergedPath = path.join(sessionDir, 'merged.wav')

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat_list.txt',  // Use relative path
        '-c', 'copy',
        '-y',
        'merged.wav'  // Use relative filename
      ], {
        cwd: sessionDir  // Set working directory to session directory
      })

      let stderr = ''
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      ffmpeg.on('close', (code) => {
        // Clean up concat list
        try {
          fs.unlinkSync(concatListPath)
        } catch (err) {
          console.warn('[Merge] Failed to delete concat list:', err)
        }

        if (code === 0) {
          // Get merged file size
          const stats = fs.statSync(mergedPath)

          // Delete individual chunks
          chunkFiles.forEach(file => {
            try {
              fs.unlinkSync(path.join(sessionDir, file))
            } catch (err) {
              console.warn(`[Merge] Failed to delete chunk ${file}:`, err)
            }
          })

          console.log(`[Merge] Successfully merged ${chunkFiles.length} chunks`)
          resolve({ success: true, filePath: mergedPath, sizeBytes: stats.size })
        } else {
          console.error('[Merge] FFmpeg failed:', stderr)
          reject(new Error(`FFmpeg merge failed with exit code ${code}`))
        }
      })

      ffmpeg.on('error', (error) => {
        console.error('[Merge] FFmpeg error:', error)
        reject(new Error(`Failed to spawn FFmpeg: ${error.message}`))
      })
    })
  } catch (error) {
    console.error('[Merge] Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to merge chunks',
    }
  }
})

ipcMain.handle('get-transcription-status', async () => {
  return transcriptionService.getStatus()
})

// IPC Handler for playing announcement
ipcMain.handle('play-announcement', async (_event, text: string) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('[Announcement] Playing:', text)

      // Use macOS 'say' command for text-to-speech
      const say = spawn('say', [text])

      say.on('error', (error) => {
        console.error('[Announcement] Failed to play:', error)
        reject(new Error(`Failed to play announcement: ${error.message}`))
      })

      say.on('close', (code) => {
        if (code === 0) {
          console.log('[Announcement] Completed successfully')
          resolve({ success: true })
        } else {
          console.error('[Announcement] Process exited with code:', code)
          reject(new Error(`Announcement failed with exit code ${code}`))
        }
      })
    } catch (error) {
      console.error('[Announcement] Error:', error)
      reject(error)
    }
  })
})

// IPC Handler for speaker diarization
ipcMain.handle('diarize-audio', async (event, audioFilePath: string) => {
  try {
    // Check if diarization is available
    const isAvailable = await diarizationService.isAvailable()
    if (!isAvailable) {
      return {
        success: false,
        error: 'Diarization not available. Install pyannote.audio and set HUGGINGFACE_TOKEN.'
      }
    }

    // Run diarization with progress updates
    const result = await diarizationService.diarize(
      audioFilePath,
      (progress) => {
        // Send progress updates to renderer
        event.sender.send('diarization-progress', progress)
      }
    )

    return { success: true, result }
  } catch (error) {
    console.error('Diarization error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Diarization failed'
    }
  }
})

// IPC Handler for transcription + diarization (combined)
ipcMain.handle('transcribe-and-diarize', async (event, audioFilePath: string, options?: TranscriptionOptions) => {
  try {
    // Step 1: Transcribe
    event.sender.send('transcription-progress', {
      stage: 'loading',
      progress: 0,
      message: 'Starting transcription...'
    })

    const transcriptionResult = await transcriptionService.transcribe(
      audioFilePath,
      options,
      (progress) => {
        // Scale progress to 0-50%
        event.sender.send('transcription-progress', {
          ...progress,
          progress: progress.progress / 2
        })
      }
    )

    // Step 2: Diarize (if available)
    const isAvailable = await diarizationService.isAvailable()
    if (!isAvailable) {
      // Return transcription only if diarization not available
      return {
        success: true,
        result: {
          ...transcriptionResult,
          merged: null
        }
      }
    }

    event.sender.send('transcription-progress', {
      stage: 'processing',
      progress: 50,
      message: 'Running speaker diarization...'
    })

    const diarizationResult = await diarizationService.diarize(
      audioFilePath,
      (progress) => {
        // Scale progress to 50-90%
        event.sender.send('transcription-progress', {
          stage: 'processing',
          progress: 50 + (progress.progress || 0) * 0.4,
          message: progress.message
        })
      }
    )

    // Step 3: Merge transcription + diarization
    event.sender.send('transcription-progress', {
      stage: 'processing',
      progress: 95,
      message: 'Merging transcription with speaker labels...'
    })

    const merged = mergeDiarizationWithTranscript(
      transcriptionResult.segments,
      diarizationResult
    )

    event.sender.send('transcription-progress', {
      stage: 'complete',
      progress: 100,
      message: 'Complete!'
    })

    // Step 4: Save to database
    try {
      const { randomUUID } = await import('crypto')

      // Get file stats
      const stats = fs.statSync(audioFilePath)

      // Save recording
      const recordingId = randomUUID()
      dbService.saveRecording({
        id: recordingId,
        file_path: audioFilePath,
        file_size_bytes: stats.size,
        duration_seconds: transcriptionResult.duration,
        sample_rate: 16000,
        channels: 1,
        format: 'wav'
      })

      // Save transcript
      const transcriptId = randomUUID()
      const fullTranscript = transcriptionResult.segments.map(s => s.text).join(' ')
      dbService.saveTranscript({
        id: transcriptId,
        recording_id: recordingId,
        transcript_text: fullTranscript,
        segments_json: JSON.stringify(transcriptionResult.segments),
        processing_time_seconds: transcriptionResult.processingTime
      })

      // Save diarization
      if (diarizationResult && diarizationResult.segments) {
        const diarizationId = randomUUID()
        const speakerNumbers = diarizationResult.segments.map(d =>
          parseInt(d.speaker.replace('SPEAKER_', ''))
        )
        const numSpeakers = speakerNumbers.length > 0
          ? Math.max(...speakerNumbers) + 1
          : 0

        dbService.saveDiarizationResult({
          id: diarizationId,
          transcript_id: transcriptId,
          segments_json: JSON.stringify(diarizationResult.segments),
          num_speakers: numSpeakers
        })
      }

      console.log(`[Database] Saved recording ${recordingId}, transcript ${transcriptId}`)
    } catch (dbError) {
      console.error('[Database] Failed to save to database:', dbError)
      // Don't fail the entire operation if database save fails
    }

    return {
      success: true,
      result: {
        ...transcriptionResult,
        merged
      }
    }
  } catch (error) {
    console.error('Transcription + diarization error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transcription + diarization failed'
    }
  }
})

// ===== Phase 2.1: M365 Authentication IPC Handlers =====

// Initialize M365 Auth
ipcMain.handle('m365-auth-initialize', async () => {
  try {
    if (!m365AuthService) {
      return {
        success: false,
        error: 'Azure credentials not configured. Set AZURE_CLIENT_ID and AZURE_TENANT_ID in .env file.'
      }
    }

    await m365AuthService.initialize()
    const authState = m365AuthService.getAuthState()

    return { success: true, authState }
  } catch (error) {
    console.error('[M365Auth] Initialize failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize authentication'
    }
  }
})

// Login
ipcMain.handle('m365-auth-login', async () => {
  try {
    if (!m365AuthService) {
      return {
        success: false,
        error: 'Azure credentials not configured.'
      }
    }

    const result = await m365AuthService.login(mainWindow || undefined)
    const authState = m365AuthService.getAuthState()

    return { success: true, authState }
  } catch (error) {
    console.error('[M365Auth] Login failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Login failed'
    }
  }
})

// Logout
ipcMain.handle('m365-auth-logout', async () => {
  try {
    if (!m365AuthService) {
      return {
        success: false,
        error: 'Azure credentials not configured.'
      }
    }

    await m365AuthService.logout()
    const authState = m365AuthService.getAuthState()

    return { success: true, authState }
  } catch (error) {
    console.error('[M365Auth] Logout failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Logout failed'
    }
  }
})

// Get auth state
ipcMain.handle('m365-auth-get-state', async () => {
  try {
    if (!m365AuthService) {
      return {
        success: false,
        error: 'Azure credentials not configured.'
      }
    }

    const authState = m365AuthService.getAuthState()
    return { success: true, authState }
  } catch (error) {
    console.error('[M365Auth] Get state failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get auth state'
    }
  }
})

// Get access token
ipcMain.handle('m365-auth-get-token', async () => {
  try {
    if (!m365AuthService) {
      return {
        success: false,
        error: 'Azure credentials not configured.'
      }
    }

    const accessToken = await m365AuthService.getAccessToken()
    return { success: true, accessToken }
  } catch (error) {
    console.error('[M365Auth] Get token failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get access token'
    }
  }
})

// Refresh token
ipcMain.handle('m365-auth-refresh-token', async () => {
  try {
    if (!m365AuthService) {
      return {
        success: false,
        error: 'Azure credentials not configured.'
      }
    }

    const accessToken = await m365AuthService.refreshToken()
    return { success: true, accessToken }
  } catch (error) {
    console.error('[M365Auth] Refresh token failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to refresh token'
    }
  }
})

// ===== Phase 2.2: Graph API Calendar IPC Handlers =====

// Get today's meetings
ipcMain.handle('graph-get-todays-meetings', async () => {
  try {
    if (!m365AuthService) {
      return {
        success: false,
        error: 'Azure credentials not configured.'
      }
    }

    // Get access token
    const accessToken = await m365AuthService.getAccessToken()

    // Initialize Graph API client
    graphApiService.initialize(accessToken)

    // Fetch today's meetings
    const meetings = await graphApiService.getTodaysMeetings()

    return { success: true, meetings }
  } catch (error) {
    console.error('[GraphAPI] Get todays meetings failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch meetings'
    }
  }
})

// Get upcoming meetings
ipcMain.handle('graph-get-upcoming-meetings', async (_event, minutesAhead: number = 15) => {
  try {
    if (!m365AuthService) {
      return {
        success: false,
        error: 'Azure credentials not configured.'
      }
    }

    // Get access token
    const accessToken = await m365AuthService.getAccessToken()

    // Initialize Graph API client
    graphApiService.initialize(accessToken)

    // Fetch upcoming meetings
    const meetings = await graphApiService.getUpcomingMeetings(minutesAhead)

    return { success: true, meetings }
  } catch (error) {
    console.error('[GraphAPI] Get upcoming meetings failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch upcoming meetings'
    }
  }
})

// Get meetings in date range (Phase 2.3-4: For syncing historical meetings)
ipcMain.handle('graph-get-meetings-in-date-range', async (_event, startDate: string, endDate: string) => {
  try {
    if (!m365AuthService) {
      return {
        success: false,
        error: 'Azure credentials not configured.'
      }
    }

    // Get access token
    const accessToken = await m365AuthService.getAccessToken()

    // Initialize Graph API client
    graphApiService.initialize(accessToken)

    // Fetch meetings in date range
    const meetings = await graphApiService.getMeetingsInDateRange(
      new Date(startDate),
      new Date(endDate)
    )

    return { success: true, meetings }
  } catch (error) {
    console.error('[GraphAPI] Get meetings in date range failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch meetings'
    }
  }
})

// Get meeting by ID
ipcMain.handle('graph-get-meeting-by-id', async (_event, eventId: string) => {
  try {
    if (!m365AuthService) {
      return {
        success: false,
        error: 'Azure credentials not configured.'
      }
    }

    // Get access token
    const accessToken = await m365AuthService.getAccessToken()

    // Initialize Graph API client
    graphApiService.initialize(accessToken)

    // Fetch meeting
    const meeting = await graphApiService.getMeetingById(eventId)

    if (!meeting) {
      return {
        success: false,
        error: `Meeting with ID ${eventId} not found`
      }
    }

    return { success: true, meeting }
  } catch (error) {
    console.error(`[GraphAPI] Get meeting ${eventId} failed:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch meeting'
    }
  }
})

// Phase 5: Email Distribution - Send email via Graph API
ipcMain.handle('graph-send-email', async (_event, options: {
  to: { name: string; email: string }[]
  cc?: { name: string; email: string }[]
  subject: string
  bodyHtml: string
}) => {
  try {
    if (!m365AuthService) {
      return {
        success: false,
        error: 'Microsoft 365 authentication not configured.'
      }
    }

    // Bug #10 fix: Enforce AI disclaimer (server-side validation)
    // This prevents bypass if client is modified or uses Graph API directly
    const disclaimerText = 'AI-Generated Summary Disclaimer'
    if (!options.bodyHtml.includes(disclaimerText)) {
      console.warn('[Security] Email missing AI disclaimer, rejecting send')
      return {
        success: false,
        error: 'Email must include AI-generated disclaimer for legal compliance. Please regenerate the email.'
      }
    }

    // Get fresh access token
    const accessToken = await m365AuthService.getAccessToken()

    // Initialize Graph API client
    graphApiService.initialize(accessToken)

    // Send email
    await graphApiService.sendEmail(options)

    console.log('[Main] Email sent successfully')
    return { success: true }
  } catch (error) {
    console.error('[Main] Failed to send email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email'
    }
  }
})

// ===== Phase 2.3-3: Meeting Intelligence IPC Handlers =====

// Helper to ensure intelligence service is initialized
function ensureIntelligenceService(): MeetingIntelligenceService {
  if (!intelligenceService) {
    if (!claudeService) {
      throw new Error('Claude API not configured. Set ANTHROPIC_API_KEY in .env file.')
    }
    if (!m365AuthService) {
      throw new Error('Microsoft 365 not configured.')
    }

    // Initialize email service (requires Graph API client)
    const graphClient = graphApiService.getClient()
    if (!graphClient) {
      throw new Error('Graph API client not initialized. Please log in first.')
    }

    emailService = new EmailContextService(graphClient, dbService)
    intelligenceService = new MeetingIntelligenceService(
      claudeService,
      dbService
    )
    console.log('[MeetingIntelligence] Service initialized')
  }

  return intelligenceService
}

// Start summary generation
ipcMain.handle('meeting-intelligence-start', async (_event, meetingId: string, transcriptId: string) => {
  try {
    const service = ensureIntelligenceService()
    const summaryId = await service.generateSummary(meetingId, transcriptId)

    console.log(`[MeetingIntelligence] Started summary generation: ${summaryId}`)
    return { success: true, summaryId }
  } catch (error) {
    console.error('[MeetingIntelligence] Start failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start summary generation'
    }
  }
})

// Get summary status
ipcMain.handle('meeting-intelligence-get-status', async (_event, summaryId: string) => {
  try {
    const service = ensureIntelligenceService()
    const status = await service.getSummaryStatus(summaryId)

    return { success: true, status }
  } catch (error) {
    console.error('[MeetingIntelligence] Get status failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get summary status'
    }
  }
})

// Get summary result
ipcMain.handle('meeting-intelligence-get-summary', async (_event, summaryId: string) => {
  try {
    const summary = dbService.getSummary(summaryId)

    if (!summary) {
      return {
        success: false,
        error: `Summary not found: ${summaryId}`
      }
    }

    return { success: true, summary }
  } catch (error) {
    console.error('[MeetingIntelligence] Get summary failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get summary'
    }
  }
})

// Update summary (user edits)
ipcMain.handle('meeting-intelligence-update-summary', async (_event, summaryId: string, updates: any) => {
  try {
    dbService.updateSummaryFinal(summaryId, updates)

    // FIX: Return updated summary so UI can refresh
    const updatedSummary = dbService.getSummary(summaryId)

    console.log(`[MeetingIntelligence] Updated summary: ${summaryId}`)
    return { success: true, summary: updatedSummary }
  } catch (error) {
    console.error('[MeetingIntelligence] Update summary failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update summary'
    }
  }
})

// Cancel summary generation
ipcMain.handle('meeting-intelligence-cancel', async (_event, summaryId: string) => {
  try {
    const service = ensureIntelligenceService()
    await service.cancelSummary(summaryId)

    console.log(`[MeetingIntelligence] Cancelled summary: ${summaryId}`)
    return { success: true }
  } catch (error) {
    console.error('[MeetingIntelligence] Cancel failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel summary'
    }
  }
})

// Regenerate summary
ipcMain.handle('meeting-intelligence-regenerate', async (_event, summaryId: string) => {
  try {
    const service = ensureIntelligenceService()
    await service.regenerateSummary(summaryId)

    console.log(`[MeetingIntelligence] Regenerating summary: ${summaryId}`)
    return { success: true }
  } catch (error) {
    console.error('[MeetingIntelligence] Regenerate failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to regenerate summary'
    }
  }
})

// Fetch email context for a meeting
ipcMain.handle('meeting-intelligence-fetch-emails', async (_event, meetingId: string, participantEmails: string[]) => {
  try {
    if (!emailService) {
      throw new Error('Email service not initialized')
    }

    const emails = await emailService.getEmailsForMeeting(meetingId, participantEmails)

    return { success: true, emails }
  } catch (error) {
    console.error('[MeetingIntelligence] Fetch emails failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch emails'
    }
  }
})

// ===== Database Query IPC Handlers =====

// Get recordings with transcripts (for UI)
ipcMain.handle('db-get-recordings-with-transcripts', async (_event, limit: number = 20) => {
  try {
    console.log('[Database] Fetching recordings with transcripts, limit:', limit)
    const recordings = dbService.getRecordingsWithTranscripts(limit)
    console.log('[Database] Found recordings:', recordings.length)
    console.log('[Database] First recording:', recordings[0])
    return { success: true, recordings }
  } catch (error) {
    console.error('[Database] Get recordings with transcripts failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recordings'
    }
  }
})

// Get untranscribed recordings (for "Untranscribed" tab)
ipcMain.handle('db-get-untranscribed-recordings', async (_event, limit: number = 50) => {
  try {
    console.log('[Database] Fetching untranscribed recordings, limit:', limit)
    const recordings = dbService.getUntranscribedRecordings(limit)
    console.log('[Database] Found untranscribed recordings:', recordings.length)
    return { success: true, recordings }
  } catch (error) {
    console.error('[Database] Get untranscribed recordings failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get untranscribed recordings'
    }
  }
})

// Phase 2.3-4: Meeting-Recording Association - Database Query Handlers

// Get meeting by ID (Phase 4b: RecipientSelector)
ipcMain.handle('db-get-meeting-by-id', async (_event, meetingId: string) => {
  try {
    console.log('[Database] Fetching meeting by ID:', meetingId)
    const meeting = dbService.getMeeting(meetingId)
    return { success: true, meeting }
  } catch (error) {
    console.error('[Database] Get meeting by ID failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get meeting'
    }
  }
})

// Get meetings in date range
ipcMain.handle('db-get-meetings-in-date-range', async (_event, startDate: string, endDate: string) => {
  try {
    console.log('[Database] Fetching meetings in date range:', startDate, '-', endDate)
    const meetings = dbService.getMeetingsByDateRange(startDate, endDate)
    console.log('[Database] Found meetings:', meetings.length)
    return { success: true, meetings }
  } catch (error) {
    console.error('[Database] Get meetings in date range failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get meetings'
    }
  }
})

// Get meetings with recordings and summaries (with full JOIN)
ipcMain.handle('db-get-meetings-with-recordings-and-summaries', async (_event, startDate: string, endDate: string) => {
  try {
    console.log('[Database] Fetching meetings with recordings and summaries:', startDate, '-', endDate)
    const meetings = dbService.getMeetingsWithRecordingsAndSummaries(startDate, endDate)
    console.log('[Database] Found meetings with details:', meetings.length)
    return { success: true, meetings }
  } catch (error) {
    console.error('[Database] Get meetings with recordings and summaries failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get meetings'
    }
  }
})

// Search meetings by title
ipcMain.handle('db-search-meetings-by-title', async (_event, query: string, limit: number = 50) => {
  try {
    console.log('[Database] Searching meetings by title:', query)
    const meetings = dbService.searchMeetingsByTitle(query, limit)
    console.log('[Database] Found meetings:', meetings.length)
    return { success: true, meetings }
  } catch (error) {
    console.error('[Database] Search meetings by title failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search meetings'
    }
  }
})

// Get recordings by meeting ID
ipcMain.handle('db-get-recordings-by-meeting-id', async (_event, meetingId: string) => {
  try {
    console.log('[Database] Fetching recordings for meeting:', meetingId)
    const recordings = dbService.getRecordingsByMeetingId(meetingId)
    console.log('[Database] Found recordings:', recordings.length)
    return { success: true, recordings }
  } catch (error) {
    console.error('[Database] Get recordings by meeting ID failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recordings'
    }
  }
})

// Update summary meeting ID
ipcMain.handle('db-update-summary-meeting-id', async (_event, summaryId: string, meetingId: string | null) => {
  try {
    console.log('[Database] Updating summary meeting ID:', summaryId, '->', meetingId)
    dbService.updateSummaryMeetingId(summaryId, meetingId)
    return { success: true }
  } catch (error) {
    console.error('[Database] Update summary meeting ID failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update summary meeting ID'
    }
  }
})

ipcMain.handle('db-update-recording-meeting-id', async (_event, recordingId: string, meetingId: string | null) => {
  try {
    console.log('[Database] Updating recording meeting ID:', recordingId, '->', meetingId)
    dbService.updateRecordingMeetingId(recordingId, meetingId)
    return { success: true }
  } catch (error) {
    console.error('[Database] Update recording meeting ID failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update recording meeting ID'
    }
  }
})

// Phase 4: Get transcript by recording ID
ipcMain.handle('db-get-transcript-by-recording-id', async (_event, recordingId: string) => {
  try {
    console.log('[Database] Fetching transcript for recording:', recordingId)
    const transcript = dbService.getTranscriptByRecordingId(recordingId)
    return { success: true, transcript }
  } catch (error) {
    console.error('[Database] Get transcript failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get transcript'
    }
  }
})

// Phase 4: Get summary by recording ID
ipcMain.handle('db-get-summary-by-recording-id', async (_event, recordingId: string) => {
  try {
    console.log('[Database] Fetching summary for recording:', recordingId)
    const summary = dbService.getSummaryByRecordingId(recordingId)
    return { success: true, summary }
  } catch (error) {
    console.error('[Database] Get summary failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get summary'
    }
  }
})

// Phase 4: Get recordings with summaries (for browse mode)
ipcMain.handle('db-get-recordings-with-summaries', async (_event, limit: number = 50) => {
  try {
    console.log('[Database] Fetching recordings with summaries, limit:', limit)
    const stmt = dbService['db'].prepare(`
      SELECT
        r.id as recording_id,
        r.file_path,
        r.duration_seconds,
        r.created_at,
        t.id as transcript_id,
        t.transcript_text,
        s.id as summary_id,
        s.overall_status as summary_status,
        m.subject as meeting_subject
      FROM recordings r
      LEFT JOIN transcripts t ON r.id = t.recording_id
      LEFT JOIN meeting_summaries s ON t.id = s.transcript_id
      LEFT JOIN meetings m ON r.meeting_id = m.id
      WHERE t.id IS NOT NULL
      ORDER BY r.created_at DESC
      LIMIT ?
    `)
    const recordings = stmt.all(limit)
    console.log('[Database] Found recordings:', recordings.length)
    return { success: true, recordings }
  } catch (error) {
    console.error('[Database] Get recordings with summaries failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recordings'
    }
  }
})

// Phase 5: Email Distribution - Mark summary as sent
ipcMain.handle('db-mark-summary-sent', async (_event, summaryId: string, recipients: { name: string; email: string }[]) => {
  try {
    dbService.markSummaryAsSent(summaryId, recipients)
    return { success: true }
  } catch (error) {
    console.error('[Database] Mark summary sent failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark summary as sent'
    }
  }
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  // Initialize Whisper model
  try {
    await transcriptionService.initialize('base')
  } catch (error) {
    console.error('Failed to initialize Whisper:', error)
  }

  // Initialize M365 Auth service
  if (m365AuthService) {
    try {
      await m365AuthService.initialize()
      console.log('[M365Auth] Initialized successfully')
    } catch (error) {
      console.error('[M365Auth] Failed to initialize:', error)
    }
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

# Meeting Agent User Guide

Complete guide to using Meeting Agent for recording, transcribing, and summarizing online meetings.

**Version**: 0.3.1
**Last Updated**: 2025-10-14

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Recording Your First Meeting](#recording-your-first-meeting)
4. [Transcription and Speaker Identification](#transcription-and-speaker-identification)
5. [Microsoft 365 Integration](#microsoft-365-integration)
6. [Meeting Intelligence and Summaries](#meeting-intelligence-and-summaries)
7. [Managing Audio Resources](#managing-audio-resources)
8. [Tips and Best Practices](#tips-and-best-practices)
9. [Troubleshooting](#troubleshooting)
10. [Privacy and Ethics](#privacy-and-ethics)

---

## Introduction

Meeting Agent is a macOS application that helps you capture, transcribe, and summarize online meetings from any platform (Teams, Zoom, Google Meet, etc.). It runs **100% locally** for transcription and speaker identification, with optional cloud services for AI-powered summarization.

### What Meeting Agent Does

- **Records audio** from your computer's system audio (meeting participants) and microphone (your voice)
- **Transcribes** the recording using OpenAI Whisper running on your Mac
- **Identifies speakers** using AI to label who said what
- **Generates summaries** with speaker identification, action items, and key decisions using Claude AI
- **Exports** summaries as markdown files for easy sharing

### Key Benefits

- 💰 **Cost-effective**: ~$0.09 per meeting (vs $2.50 with cloud-only services)
- 🔒 **Privacy-first**: Transcription happens on your machine
- 🚀 **Fast**: Metal GPU acceleration on Apple Silicon
- 🎤 **Universal**: Works with any meeting platform

---

## Getting Started

### System Requirements

- **macOS**: 12.3 or later
- **Hardware**: Apple Silicon (M1/M2/M3/M4) recommended for GPU acceleration
- **Internet**: Required for Microsoft 365 integration and AI summarization
- **Microsoft 365**: Optional, for calendar integration and email context

### First Launch

1. **Grant Permissions**
   - When you first launch Meeting Agent, macOS will ask for permissions
   - Grant **Screen Recording** permission (required for system audio capture)
   - Grant **Microphone** permission (optional, for capturing your voice)

2. **App Layout**
   The app has four main sections:
   - **Audio Recording**: Controls for recording meetings
   - **M365 Authentication**: Login to Microsoft 365 (optional)
   - **Calendar**: View today's meetings (requires M365)
   - **Meeting Intelligence**: Generate and view AI summaries

3. **Initial Configuration**
   - The app works immediately after granting permissions
   - Microsoft 365 login is optional but recommended for better summaries

---

## Recording Your First Meeting

### Step 1: Initialize Audio Capture

1. Click **"Initialize Audio Capture"** button
2. Choose whether to **"Include microphone"** (checked by default)
   - ✅ Checked: Records system audio + your microphone
   - ☐ Unchecked: Records only system audio (meeting participants)
3. Click **"✓ Ready to Record"**
4. Wait for initialization (takes ~2-3 seconds)

**What happens**: The app configures audio capture streams and prepares for recording.

### Step 2: Start Recording

1. Join your online meeting (Teams, Zoom, Google Meet, etc.)
2. Click **"🎤 Start Recording"** button
3. **Important**: An announcement will play automatically:
   > "This meeting, with your permission, is being recorded to generate meeting notes. These recordings will be deleted after notes are generated."

   This announcement:
   - Informs all participants that recording is active
   - Ensures legal compliance with recording laws
   - Is captured in the recording itself
   - Takes about 7 seconds

4. Status changes to **"🔴 Recording..."**
5. You'll see:
   - Duration timer (MM:SS)
   - Real-time audio level meter (visual bars)
   - Auto-save status (every 5 minutes)

**Tips**:
- Start recording BEFORE the meeting begins if possible
- The announcement ensures transparency and consent
- Audio levels should show activity when people speak

### Step 3: Monitor Recording

During the meeting:
- **Duration timer** shows elapsed time
- **Audio level meter** shows real-time audio activity:
  - Green: Low levels
  - Yellow: Medium levels
  - Red: High levels (be careful of distortion)
- **Auto-save indicator**: "Last saved: X minutes ago"
  - Recordings are automatically saved every 5 minutes
  - Protects against data loss if app crashes
  - Memory usage stays constant regardless of meeting length

**Active sources display**:
- ✅ System audio (meeting participants, videos, etc.)
- ✅ Microphone (your voice) - if enabled

### Step 4: Stop Recording

1. When the meeting ends, click **"⏹ Stop Recording"**
2. Wait a moment while the recording is finalized
3. Status changes to **"⏸️ Ready"**
4. Recording is saved to: `~/Library/Application Support/meeting-agent/recordings/`

**What happens**:
- All auto-saved chunks are merged into a single WAV file
- Individual chunks are deleted
- Final recording is ready for transcription

---

## Transcription and Speaker Identification

After recording, you have two options:

### Option 1: Transcribe Only (Fast)

**Best for**: Quick transcripts without speaker labels

1. Click **"⚡ Transcribe Only"**
2. Watch progress bar (takes ~30 seconds for 30-second audio)
3. Transcript appears with text only (no speaker labels)

**Speed**: ~50x realtime (5-minute recording in ~6 seconds)
**Cost**: $0.00 (runs on your Mac)

### Option 2: Transcribe + Diarize (Accurate)

**Best for**: Meetings where you need to know who said what

1. Click **"📝 Transcribe + Diarize"**
2. Watch progress through stages:
   - **Preprocessing**: Converting audio format
   - **Transcribing**: Converting speech to text
   - **Diarizing**: Identifying speakers
   - **Merging**: Combining results
3. Transcript appears with speaker labels

**Example output**:
```
[SPEAKER_00]: Good morning everyone, let's get started.
[SPEAKER_01]: Thanks for joining. I'll share my screen.
[SPEAKER_00]: Great, I can see it now.
[SPEAKER_02]: Quick question about the timeline...
```

**Speed**: ~3x realtime (5-minute recording in ~15 seconds with GPU)
**Cost**: $0.00 (runs on your Mac)
**Accuracy**: Depends on audio quality and speaker overlap

### Understanding Speaker Labels

- Speakers are labeled as `SPEAKER_00`, `SPEAKER_01`, etc.
- Numbers don't indicate importance, just order of first appearance
- Same speaker keeps the same label throughout the meeting
- Later, AI summarization can identify speakers by name using meeting context

### Transcript Display

After transcription completes, you'll see:
- **Full transcript** with speaker labels (if diarized)
- **Statistics**:
  - Duration of recording
  - Processing time
  - Detected language
  - Number of speakers
- **Actions**: Options to generate AI summary

---

## Microsoft 365 Integration

Microsoft 365 integration is optional but provides:
- Context about meeting attendees (for better speaker identification)
- Email history with participants (for understanding background)
- Calendar information (meeting title, organizer, attendees)

### Setting Up M365 Integration

1. **Prerequisites**:
   - Microsoft 365 account (work or school)
   - Azure AD app registration (see `docs/guides/azure-ad-setup.md`)
   - Environment variables configured in `.env`:
     ```
     AZURE_CLIENT_ID=your_client_id
     AZURE_TENANT_ID=your_tenant_id
     ```

2. **Login Process**:
   - Scroll to **"Microsoft 365 Authentication"** section
   - Click **"🔐 Login with Microsoft"**
   - Browser window opens with Microsoft login
   - Sign in with your work/school account
   - Grant permissions when prompted
   - Return to the app - you'll see your name/email

3. **What's Stored**:
   - Access tokens are stored in macOS Keychain (secure)
   - Tokens automatically refresh - no need to login again
   - Click **"Logout"** to clear tokens and disconnect

### Using Calendar Integration

After M365 login:
1. **"Today's Meetings"** section shows:
   - All meetings scheduled for today
   - Meeting title, time, duration
   - Organizer name
   - Attendee list
   - Join links for online meetings
   - Location (for in-person meetings)

2. **Visual Indicators**:
   - 🟢 **"In Progress"** badge: Meeting is happening now
   - 🔵 **"Starting Soon"** badge: Meeting starts within 15 minutes
   - 🌐 **Online meeting** indicator: Shows video meeting icon

3. **Refresh Button**:
   - Click to update meeting list
   - Useful if you've added meetings since launching the app

**Why this matters**: When generating AI summaries, the app uses calendar data to:
- Identify speakers by matching meeting attendees
- Understand meeting context and topics
- Fetch relevant email history with participants

---

## Meeting Intelligence and Summaries

Meeting Intelligence uses AI to analyze transcripts and generate comprehensive summaries with speaker identification, action items, and key decisions.

### How It Works

**Two-Pass Process** (runs in background, takes 30-60 minutes):

1. **Pass 1: Initial Analysis**
   - AI reads the transcript
   - Matches speaker labels (SPEAKER_00, etc.) to actual names using meeting context
   - Generates initial summary, action items, and key decisions
   - Takes ~30 minutes

2. **Pass 2: Validation**
   - AI reviews Pass 1 results
   - Verifies speaker identifications against transcript evidence
   - Corrects any inaccuracies
   - Refines summary and action items
   - Takes ~30 minutes

**Total time**: 30-60 minutes
**Cost**: ~$0.09 per meeting (96% savings vs cloud alternatives)

### Generating a Summary

#### Step 1: Select Recording

1. Scroll to **"Meeting Intelligence"** section
2. You'll see **"Recording Browser"** with past recordings
3. Each recording shows:
   - Meeting title (if linked to calendar) or "Untitled Recording"
   - Recording date and time
   - Duration
   - Number of speakers detected
   - Transcript preview (first 200 characters)

4. Click on a recording to select it (highlights in purple)
5. Click **"🧠 Generate Summary"** button

**Note**: You can generate summaries without recording - the section is always accessible.

#### Step 2: Monitor Progress

While processing, you'll see:
- **Current status**: "Pass 1 Processing" or "Pass 2 Processing"
- **Elapsed time**: How long the process has been running
- **Next status check**: Countdown to next update
- **Cancel button**: Stop the process if needed

**Status messages**:
- **"Submitted"**: Batch job sent to Claude API
- **"In Progress"**: AI is processing
- **"Pass 1 Complete"**: First pass done, starting Pass 2
- **"Pass 2 Complete"**: Summary ready!

**Can you close the app?**: Yes! Processing happens in the cloud. You can close the app and check back later - progress is saved in the database.

#### Step 3: View Summary

When complete, the summary displays with:

**1. Speaker Identification**
Shows each speaker with:
- Label (e.g., SPEAKER_00)
- Real name (matched from meeting attendees)
- Email address (if available)
- Confidence level (High/Medium/Low)
- Reasoning (why the AI thinks this match is correct)

Example:
```
SPEAKER_00 → John Smith (john@company.com) [High Confidence]
Reasoning: "Mentioned being the project manager and referenced previous
discussions about the Q4 roadmap, matching John Smith's role as PM."
```

**2. Meeting Summary**
- Concise overview of what was discussed
- Main topics and themes
- Key points from each speaker
- Duration and participation notes

**3. Action Items**
Each action item shows:
- Description of the task
- Assignee (who should do it)
- Due date (if mentioned)
- Priority (High/Medium/Low)

Example:
```
1. Send updated design mockups to stakeholders
   Assignee: Sarah Chen
   Due: October 20, 2025
   Priority: High
```

**4. Key Decisions**
- Important decisions made during the meeting
- Agreements reached
- Directions chosen
- Changes approved

**5. Validation Corrections** (if any)
Shows what Pass 2 changed from Pass 1:
- Corrected speaker identifications
- Updated action item assignments
- Refined decisions based on evidence

### Working with Summaries

#### Export Summary

Click **"💾 Export"** button (always visible) to:
- **Download** summary as markdown file (`meeting-summary-2025-10-14.md`)
- **Copy to clipboard** automatically
- File includes all data: summary, speakers, action items, decisions, metadata

**Markdown format example**:
```markdown
# Meeting Summary

## Summary
This meeting focused on the Q4 product roadmap...

## Speaker Identification (3)
- SPEAKER_00 → John Smith (john@company.com) [High Confidence]
  Mentioned being the project manager...

## Action Items (5)
1. Send updated design mockups to stakeholders
   Assignee: Sarah Chen
   Due: October 20, 2025
   Priority: High

## Key Decisions (3)
1. Approved the new feature timeline for Q4
2. Agreed to increase the marketing budget by 15%

## Metadata
Created: October 14, 2025 2:30 PM
Pass 1 Complete: October 14, 2025 3:00 PM
Pass 2 Complete: October 14, 2025 3:30 PM
```

#### Edit Summary (Coming in Phase 4)

Currently, you can export the markdown file and edit it manually. Future versions will include:
- In-app editing of summary text
- Reassigning action items
- Correcting speaker identifications
- Adding/removing key decisions

#### Regenerate Summary

If the summary has issues:
1. Click **"🔄 Regenerate"** button
2. Process starts over from Pass 1
3. Uses same transcript but generates fresh analysis
4. Useful if:
   - Speaker identifications are wrong
   - Summary missed important points
   - You've updated meeting attendees in calendar

**Note**: Regeneration costs the same as initial generation (~$0.09).

### Standalone Recordings

You can generate summaries for recordings **without** Microsoft 365 calendar meetings:

- Speaker labels remain as SPEAKER_00, SPEAKER_01, etc.
- Meeting context shows "Untitled Recording"
- No email context available
- Summary still includes action items and key decisions
- Useful for ad-hoc recordings or personal notes

**To improve results**: Add meeting details manually to the transcript before generating summary (future feature).

---

## Managing Audio Resources

### Stop Audio Capture

After you're done recording meetings:

1. Click **"⏹️ Stop Audio Capture"** button (appears when not recording)
2. Audio system deinitializes
3. System resources are freed
4. Returns to initialization screen

**Why this matters**:
- Frees microphone and audio streams
- Reduces CPU usage
- Removes system "microphone in use" indicator
- You can reinitialize anytime by clicking "Initialize Audio Capture"

**When to use**:
- After finishing all recordings for the day
- When you want to use microphone in other apps
- To reduce resource usage when not recording

### Storage Management

Recordings are stored in: `~/Library/Application Support/meeting-agent/`

**Directory structure**:
```
recordings/
  └── 2025-10-14T14:30:00.000Z/
      └── merged.wav          # Final recording
transcripts/                  # (Stored in database)
summaries/                    # (Stored in database)
```

**Current behavior**:
- Recordings are kept indefinitely
- No auto-deletion (yet)
- You can manually delete old recordings

**Future (Phase 6)**:
- Configurable storage quotas
- Auto-delete recordings after X days
- Option to keep only transcripts/summaries
- Export before deletion

**Manual cleanup**:
```bash
# View recordings directory
open ~/Library/Application\ Support/meeting-agent/recordings/

# Delete recordings older than 30 days (macOS Terminal)
find ~/Library/Application\ Support/meeting-agent/recordings/ \
  -type d -mtime +30 -exec rm -rf {} +
```

---

## Tips and Best Practices

### Recording Quality

**Audio Quality Tips**:
- Use headphones to prevent echo/feedback
- Test audio levels before important meetings
- Keep microphone close to your mouth
- Minimize background noise
- Close unnecessary apps to free CPU

**Best Audio Settings**:
- ✅ Include microphone: Only if you speak in the meeting
- ✅ System audio: Always enabled (captures all participants)
- Monitor audio levels during recording (should be mostly green/yellow)

### Transcription Tips

**For Best Accuracy**:
- Clear audio is crucial - good microphone matters
- Minimize overlapping speech
- Speakers should speak clearly and at moderate pace
- Reduce background noise (music, notifications, etc.)
- One speaker at a time produces best results

**When to Use Each Option**:
- **Transcribe Only**: Internal meetings, personal notes, quick reference
- **Transcribe + Diarize**: Client meetings, important decisions, formal meetings

### Meeting Intelligence Tips

**For Better Speaker Identification**:
- ✅ Link recording to calendar meeting (login to M365)
- ✅ Ensure meeting attendees list is accurate in calendar
- ✅ Have participants introduce themselves at meeting start
- ✅ Use video so names appear on screen (system audio captures this)
- ✅ Reference people by name during the meeting

**For Better Summaries**:
- Record full meetings (don't skip intro/conclusion)
- Include any screen shares that contain text
- Clearly state decisions and action items during meeting
- Summarize key points before ending the meeting

### Cost Management

**Current costs** (per meeting):
- Transcription: $0.00 (local)
- Diarization: $0.00 (local)
- AI Summary: ~$0.09 (Claude Batch API)
- **Total: ~$0.09 per meeting**

**Tips to minimize costs**:
- Only generate summaries for important meetings
- Use "Transcribe Only" for informal meetings
- Export transcripts for personal reference (no AI cost)
- Batch processing reduces costs by 50% vs real-time API

**Cost comparison** (20 meetings/month):
- **Meeting Agent**: ~$1.86/month
- **Cloud-only services**: ~$50/month
- **Your savings**: 96% or ~$48/month

---

## Troubleshooting

### Audio Issues

**Problem**: No audio being recorded
- **Check**: System Settings → Privacy & Security → Screen Recording
- **Solution**: Enable permission for Meeting Agent
- **Restart**: Quit and relaunch the app

**Problem**: Microphone not working
- **Check**: System Settings → Privacy & Security → Microphone
- **Solution**: Enable permission for Meeting Agent
- **Test**: Speak and watch audio level meter

**Problem**: Audio level meter shows no activity
- **Check**: Meeting audio is playing through computer speakers
- **Solution**: Ensure meeting is not on "Mute Audio" mode
- **Test**: Play a video and watch audio levels

**Problem**: Recording file is empty or corrupted
- **Check**: Did recording run for at least 5 seconds?
- **Solution**: Stop and start a new recording
- **Verify**: Check file size is > 0 bytes

### Transcription Issues

**Problem**: Transcription is very slow
- **Check**: Metal GPU acceleration enabled? (automatic on Apple Silicon)
- **Solution**: Close other CPU-intensive apps
- **Check**: Is your Mac thermal throttling? (too hot)

**Problem**: Transcription has many errors
- **Cause**: Poor audio quality, heavy accents, background noise
- **Solution**: Improve recording conditions, use better microphone
- **Note**: Whisper works best with clear, English audio

**Problem**: Wrong language detected
- **Current**: English-only support (language detection automatic)
- **Future**: Manual language selection coming in Phase 7

### Speaker Diarization Issues

**Problem**: Wrong number of speakers detected
- **Cause**: Overlapping speech, background noise, poor audio
- **Solution**: Can't fix after recording - improve audio quality next time
- **Note**: Works best with one speaker at a time

**Problem**: Same speaker gets multiple labels
- **Cause**: Long pauses, speech pattern changes, audio quality
- **Workaround**: AI summary can merge these in speaker identification
- **Note**: This is a known limitation of diarization

**Problem**: Diarization takes too long
- **Check**: Metal GPU detected? Look for "Using device: Metal GPU" in console
- **Speed**: Should be ~5-10x realtime with GPU, ~1x realtime on CPU
- **Solution**: Ensure macOS 12.3+ and Apple Silicon for GPU

### Meeting Intelligence Issues

**Problem**: "No recordings with transcripts found"
- **Cause**: Haven't transcribed any recordings yet
- **Solution**: Record and transcribe a meeting first
- **Check**: Transcript should appear after transcription completes

**Problem**: Summary generation stuck
- **Check**: Status in "Meeting Intelligence" section
- **Wait**: Batch processing takes 30-60 minutes
- **Check**: Internet connection active?
- **Solution**: Click "Cancel" and regenerate if stuck >90 minutes

**Problem**: Speaker identification is wrong
- **Cause**: Insufficient meeting context, similar voices, poor audio
- **Solution**:
  - Ensure M365 calendar has correct attendees
  - Click "🔄 Regenerate" to try again
  - Export and manually correct names

**Problem**: "Meeting not found" error
- **Cause**: Database state mismatch (rare)
- **Solution**: Restart the app
- **Report**: If persists, check console logs

### M365 Integration Issues

**Problem**: Cannot login to Microsoft 365
- **Check**: `.env` file has correct `AZURE_CLIENT_ID` and `AZURE_TENANT_ID`
- **Check**: Azure AD app registration complete (see `azure-ad-setup.md`)
- **Check**: Internet connection active
- **Solution**: Review Azure AD setup guide

**Problem**: Token expired / Need to login again
- **Automatic**: Token should refresh automatically
- **Manual**: Click "Logout" then "Login" again
- **Check**: MSAL cache file in `~/Library/Application Support/meeting-agent/`

**Problem**: Calendar shows no meetings
- **Check**: Do you have meetings today?
- **Check**: Microsoft 365 calendar permissions granted?
- **Solution**: Click "🔄 Refresh" button to reload

### Database Issues

**Problem**: App crashes on launch
- **Check**: Database file corrupted?
- **Location**: `~/Library/Application Support/meeting-agent/meeting-agent.db`
- **Solution**: Delete database file (you'll lose summaries) and restart
- **Backup**: Make backup before deleting

---

## Privacy and Ethics

### Recording Laws and Consent

Meeting Agent is designed for ethical use:

**Automatic Announcement**:
- Plays at recording start
- Informs all participants
- Captured in the recording
- Ensures transparency

**Your Responsibilities**:
- Comply with local recording laws (varies by state/country)
- Obtain consent from all participants
- Some jurisdictions require "one-party consent" (you can record)
- Others require "all-party consent" (everyone must agree)
- **When in doubt, ask participants for permission**

### Data Privacy

**What Stays Local**:
- ✅ Audio recordings (stored on your Mac)
- ✅ Transcripts (stored in local database)
- ✅ Speaker diarization (processed on your Mac)
- ✅ Meeting metadata (stored in local database)

**What Goes to Cloud**:
- ❌ AI summarization (transcript sent to Claude API)
- ❌ Email context (fetched from Microsoft Graph API)
- ❌ Calendar data (fetched from Microsoft Graph API)

**Data Control**:
- You can delete recordings anytime
- You can use "Transcribe Only" and skip AI summarization
- You can disable M365 integration
- No telemetry or usage tracking
- No data sold or shared with third parties

### Data Retention

**Current Behavior**:
- Recordings: Kept indefinitely in `~/Library/Application Support/meeting-agent/`
- Transcripts: Kept indefinitely in database
- Summaries: Kept indefinitely in database

**Future (Phase 6)**:
- Configurable retention policies
- Auto-delete after X days
- Option to delete recordings after transcription
- Export before deletion

**Manual Deletion**:
```bash
# Delete specific recording
rm -rf ~/Library/Application\ Support/meeting-agent/recordings/2025-10-14T14:30:00.000Z/

# Delete database (keeps recordings)
rm ~/Library/Application\ Support/meeting-agent/meeting-agent.db
```

### Best Practices

1. **Always announce**: Let the automatic announcement play fully
2. **Get consent**: Confirm participants agree to recording
3. **State purpose**: Explain recording is for note-taking, not surveillance
4. **Share summaries**: Offer to share summaries with participants
5. **Delete after use**: Don't keep recordings longer than needed
6. **Secure your Mac**: Use disk encryption, strong passwords
7. **No sensitive data**: Avoid recording confidential/proprietary information without proper clearance

---

## Need Help?

### Getting Support

- **GitHub Issues**: [github.com/sandeepAGI/meeting-agent/issues](https://github.com/sandeepAGI/meeting-agent/issues)
- **Documentation**: Check `docs/` folder for technical details
- **Logs**: Check Console.app for detailed error messages

### Reporting Bugs

When reporting issues, include:
1. macOS version
2. Meeting Agent version (shown in app)
3. Steps to reproduce
4. Error messages (from Console.app)
5. Screenshots if relevant

### Feature Requests

Future features are tracked in:
- `docs/planning/roadmap.md` - Full 10-phase plan
- GitHub Issues with "enhancement" label

---

**Version**: 0.3.1
**Last Updated**: 2025-10-14
**Built with**: Claude Code (Sonnet 4.5) 🤖

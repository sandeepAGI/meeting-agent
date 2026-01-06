# Manual End-to-End Testing with Real Teams Transcripts

This directory contains real Microsoft Teams meeting transcripts for manual end-to-end testing of the Meeting Intelligence pipeline.

## Directory Structure

```
manual-e2e/
├── README.md                    # This file
├── teams-transcripts/           # Add your raw Teams transcript exports here
├── converted/                   # Generated: Converted to our diarization format
└── metadata/                    # Generated: Meeting metadata (calendar, emails)
```

## How to Add Transcripts

### 1. Export from Teams
1. Open Teams meeting chat
2. Click "..." → "Meeting details"
3. Download transcript (VTT, DOCX, or text format)

### 2. Add to This Folder
Place your transcript files in `teams-transcripts/`:
- Naming convention: `YYYY-MM-DD-meeting-topic.{vtt,docx,txt}`
- Example: `2025-10-14-q4-budget-review.vtt`

### 3. Supported Formats
- **VTT** (preferred) - WebVTT format with timestamps
- **DOCX** - Word document export
- **TXT** - Plain text with speaker names and timestamps

## What Happens Next

Once you add transcripts, we'll:
1. **Convert** them to our diarization format (`SPEAKER_00`, `SPEAKER_01`, etc.)
2. **Link** to calendar meetings (via subject match or manual)
3. **Fetch** email context using EmailContextService
4. **Generate** summaries using Claude API (two-pass workflow)
5. **Evaluate** quality: speaker ID accuracy, action items, decisions

## Expected Transcript Format

### Teams VTT Example
```vtt
WEBVTT

00:00:15.000 --> 00:00:18.500
John Smith: Good morning everyone, let's start the budget review.

00:00:19.000 --> 00:00:23.500
Sarah Johnson: Thanks John. I've prepared the Q4 numbers.
```

### Our Target Format (after conversion)
```json
{
  "segments": [
    {
      "start": 15.0,
      "end": 18.5,
      "speaker": "SPEAKER_00",
      "text": "Good morning everyone, let's start the budget review."
    },
    {
      "start": 19.0,
      "end": 23.5,
      "speaker": "SPEAKER_01",
      "text": "Thanks John. I've prepared the Q4 numbers."
    }
  ],
  "speakers": {
    "SPEAKER_00": "John Smith",
    "SPEAKER_01": "Sarah Johnson"
  }
}
```

## Testing Goals

- **Speaker Mapping**: Verify SPEAKER_XX → actual names using meeting context
- **Action Items**: Ensure all action items are captured
- **Key Decisions**: Validate decision tracking
- **Factual Accuracy**: Check for hallucinations
- **Summary Quality**: Assess completeness and usefulness

## Privacy Note

**IMPORTANT**: Only add transcripts from meetings where:
- You have permission to use the data for testing
- No confidential/sensitive information is present
- All participants would consent to testing use

Consider redacting sensitive content before adding transcripts.

---

**Last Updated**: 2025-10-15

/**
 * Summary Display Component
 *
 * Displays meeting summary with speaker mappings, action items, and key decisions.
 * Supports editing before final distribution.
 * Phase 2.3-3: LLM-Based Meeting Intelligence
 */

import { useState, useCallback, useEffect } from 'react'
import type { MeetingSummary, SpeakerMapping, ActionItem, DetailedNotes, EmailRecipient, EmailSectionToggles } from '../../types/meetingSummary'
import { RecipientSelector } from './RecipientSelector'
import { EmailPreview } from './EmailPreview'
import { EmailSectionToggles as EmailSectionTogglesComponent } from './EmailSectionToggles'

interface SummaryDisplayProps {
  summary: MeetingSummary
  onUpdate: (updates: {
    summary?: string
    speakers?: SpeakerMapping[]
    actionItems?: ActionItem[]
    keyDecisions?: string[]
    recipients?: EmailRecipient[]
    subjectLine?: string
    // Phase 5.5: Email customization
    detailedNotes?: DetailedNotes | null
    customIntroduction?: string
    enabledSections?: EmailSectionToggles
  }) => void
  onRegenerate: () => void
  onBack?: () => void  // Phase 2.3-4: Navigate back to selection
  isUpdating: boolean
}

export function SummaryDisplay({ summary, onUpdate, onRegenerate, onBack, isUpdating }: SummaryDisplayProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedSummary, setEditedSummary] = useState(summary.final_summary || summary.pass2_refined_summary || summary.pass1_summary || '')

  // Phase 4b: Editing state for other sections
  const [isEditingActionItems, setIsEditingActionItems] = useState(false)
  const [isEditingKeyDecisions, setIsEditingKeyDecisions] = useState(false)
  const [isEditingSpeakers, setIsEditingSpeakers] = useState(false)

  // Parse JSON fields
  const speakers: SpeakerMapping[] = JSON.parse(
    summary.final_speakers_json || summary.pass2_validated_speakers_json || summary.pass1_speaker_mappings_json || '[]'
  )
  const actionItems: ActionItem[] = JSON.parse(
    summary.final_action_items_json || summary.pass2_validated_action_items_json || summary.pass1_action_items_json || '[]'
  )
  const keyDecisions: string[] = JSON.parse(
    summary.final_key_decisions_json || summary.pass2_validated_key_decisions_json || summary.pass1_key_decisions_json || '[]'
  )
  const detailedNotes: DetailedNotes | null = (() => {
    const notesJson = summary.pass2_refined_detailed_notes_json || summary.pass1_detailed_notes_json
    if (!notesJson) return null
    try {
      return JSON.parse(notesJson)
    } catch (e) {
      return null
    }
  })()

  // Phase 4b: Edited values
  const [editedSpeakers, setEditedSpeakers] = useState<SpeakerMapping[]>(speakers)
  const [editedActionItems, setEditedActionItems] = useState<ActionItem[]>(actionItems)
  const [editedKeyDecisions, setEditedKeyDecisions] = useState<string[]>(keyDecisions)

  // Phase 5.5: Detailed notes editing state
  const [editedDetailedNotes, setEditedDetailedNotes] = useState<DetailedNotes | null>(detailedNotes)
  const [isEditingDiscussionTopics, setIsEditingDiscussionTopics] = useState(false)
  const [isEditingQuotes, setIsEditingQuotes] = useState(false)
  const [isEditingQuestions, setIsEditingQuestions] = useState(false)
  const [isEditingParkingLot, setIsEditingParkingLot] = useState(false)

  // Bug #5 fix: Local saving states for each section
  const [isSavingSummary, setIsSavingSummary] = useState(false)
  const [isSavingSpeakers, setIsSavingSpeakers] = useState(false)
  const [isSavingActionItems, setIsSavingActionItems] = useState(false)
  const [isSavingKeyDecisions, setIsSavingKeyDecisions] = useState(false)
  const [isSavingDetailedNotes, setIsSavingDetailedNotes] = useState(false)
  const [isSavingIntroduction, setIsSavingIntroduction] = useState(false)

  // Bug #1 fix: Sync editedDetailedNotes when summary prop updates (after database save)
  useEffect(() => {
    const notesJson = summary.pass2_refined_detailed_notes_json || summary.pass1_detailed_notes_json
    if (notesJson) {
      try {
        const parsed = JSON.parse(notesJson)
        setEditedDetailedNotes(parsed)
      } catch (e) {
        console.error('[SummaryDisplay] Failed to parse detailed notes:', e)
        setEditedDetailedNotes(null)
      }
    } else {
      setEditedDetailedNotes(null)
    }
  }, [summary.pass2_refined_detailed_notes_json, summary.pass1_detailed_notes_json])

  // Phase 4b: Email distribution
  const initialRecipients: EmailRecipient[] = summary.final_recipients_json
    ? JSON.parse(summary.final_recipients_json)
    : []
  const [selectedRecipients, setSelectedRecipients] = useState<EmailRecipient[]>(initialRecipients)
  const [subjectLine, setSubjectLine] = useState<string>(
    summary.final_subject_line || `Meeting Summary: ${summary.meeting_subject || 'Standalone Recording'}`
  )
  const [showEmailPreview, setShowEmailPreview] = useState(false)

  // Phase 5: Email sending state
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState(false)

  // Phase 5.5: Email customization
  const defaultSections: EmailSectionToggles = {
    summary: true,
    participants: true,
    actionItems: true,
    decisions: true,
    discussionTopics: true,
    quotes: true,
    questions: true,
    parkingLot: true
  }
  const initialEnabledSections: EmailSectionToggles = summary.enabled_sections_json
    ? JSON.parse(summary.enabled_sections_json)
    : defaultSections
  const [enabledSections, setEnabledSections] = useState<EmailSectionToggles>(initialEnabledSections)
  const [customIntroduction, setCustomIntroduction] = useState<string>(summary.custom_introduction || '')
  const [isEditingIntroduction, setIsEditingIntroduction] = useState(false)

  // Bug #2 fix: Sync enabledSections when summary prop updates (after database save)
  useEffect(() => {
    const sections = summary.enabled_sections_json
      ? JSON.parse(summary.enabled_sections_json)
      : defaultSections
    setEnabledSections(sections)
  }, [summary.enabled_sections_json, defaultSections])

  // Bug #3 fix: Sync customIntroduction when summary prop updates (after database save)
  useEffect(() => {
    setCustomIntroduction(summary.custom_introduction || '')
  }, [summary.custom_introduction])

  // Handle back navigation - safe to call since this component only renders when summary is complete
  const handleBack = () => {
    if (isEditing || isEditingActionItems || isEditingKeyDecisions || isEditingSpeakers ||
        isEditingDiscussionTopics || isEditingQuotes || isEditingQuestions || isEditingParkingLot) {
      // Warn user if they have unsaved edits
      if (confirm('You have unsaved edits. Are you sure you want to go back?')) {
        onBack?.()
      }
    } else {
      onBack?.()
    }
  }

  // Summary text save/cancel
  const handleSave = async () => {
    console.log('[SummaryDisplay] Saving summary text')
    setIsSavingSummary(true)
    try {
      await onUpdate({ summary: editedSummary })
      setIsEditing(false)
    } catch (error) {
      console.error('[SummaryDisplay] Failed to save summary:', error)
      // Keep editing mode open on error
    } finally {
      setIsSavingSummary(false)
    }
  }

  const handleCancel = () => {
    setEditedSummary(summary.final_summary || summary.pass2_refined_summary || summary.pass1_summary || '')
    setIsEditing(false)
  }

  // Phase 4b: Action items save/cancel
  const handleSaveActionItems = async () => {
    setIsSavingActionItems(true)
    try {
      await onUpdate({ actionItems: editedActionItems })
      setIsEditingActionItems(false)
    } catch (error) {
      console.error('[SummaryDisplay] Failed to save action items:', error)
    } finally {
      setIsSavingActionItems(false)
    }
  }

  const handleCancelActionItems = () => {
    setEditedActionItems(actionItems)
    setIsEditingActionItems(false)
  }

  // Phase 4b: Key decisions save/cancel
  const handleSaveKeyDecisions = async () => {
    setIsSavingKeyDecisions(true)
    try {
      await onUpdate({ keyDecisions: editedKeyDecisions })
      setIsEditingKeyDecisions(false)
    } catch (error) {
      console.error('[SummaryDisplay] Failed to save key decisions:', error)
    } finally {
      setIsSavingKeyDecisions(false)
    }
  }

  const handleCancelKeyDecisions = () => {
    setEditedKeyDecisions(keyDecisions)
    setIsEditingKeyDecisions(false)
  }

  // Phase 4b: Speaker mappings save/cancel
  const handleSaveSpeakers = async () => {
    setIsSavingSpeakers(true)
    try {
      await onUpdate({ speakers: editedSpeakers })
      setIsEditingSpeakers(false)
    } catch (error) {
      console.error('[SummaryDisplay] Failed to save speakers:', error)
    } finally {
      setIsSavingSpeakers(false)
    }
  }

  const handleCancelSpeakers = () => {
    setEditedSpeakers(speakers)
    setIsEditingSpeakers(false)
  }

  // Phase 4b: Action item manipulation
  const handleAddActionItem = () => {
    setEditedActionItems([...editedActionItems, {
      description: '',
      assignee: null,
      priority: 'medium',
      dueDate: null
    }])
  }

  const handleUpdateActionItem = (index: number, field: keyof ActionItem, value: any) => {
    const updated = [...editedActionItems]
    updated[index] = { ...updated[index], [field]: value }
    setEditedActionItems(updated)
  }

  const handleDeleteActionItem = (index: number) => {
    setEditedActionItems(editedActionItems.filter((_, i) => i !== index))
  }

  // Phase 4b: Key decision manipulation
  const handleAddKeyDecision = () => {
    setEditedKeyDecisions([...editedKeyDecisions, ''])
  }

  const handleUpdateKeyDecision = (index: number, value: string) => {
    const updated = [...editedKeyDecisions]
    updated[index] = value
    setEditedKeyDecisions(updated)
  }

  const handleDeleteKeyDecision = (index: number) => {
    setEditedKeyDecisions(editedKeyDecisions.filter((_, i) => i !== index))
  }

  // Phase 4b: Speaker mapping manipulation
  const handleUpdateSpeaker = (index: number, field: keyof SpeakerMapping, value: any) => {
    const updated = [...editedSpeakers]
    updated[index] = { ...updated[index], [field]: value }
    setEditedSpeakers(updated)
  }

  // Phase 5.5: Detailed notes save/cancel handlers
  const handleSaveDetailedNotes = async () => {
    console.log('[SummaryDisplay] Saving detailed notes:', editedDetailedNotes)
    setIsSavingDetailedNotes(true)
    try {
      await onUpdate({ detailedNotes: editedDetailedNotes })
      setIsEditingDiscussionTopics(false)
      setIsEditingQuotes(false)
      setIsEditingQuestions(false)
      setIsEditingParkingLot(false)
    } catch (error) {
      console.error('[SummaryDisplay] Failed to save detailed notes:', error)
    } finally {
      setIsSavingDetailedNotes(false)
    }
  }

  const handleCancelDetailedNotes = () => {
    setEditedDetailedNotes(detailedNotes)
    setIsEditingDiscussionTopics(false)
    setIsEditingQuotes(false)
    setIsEditingQuestions(false)
    setIsEditingParkingLot(false)
  }

  // Phase 5.5: Discussion topics manipulation
  const handleAddDiscussionTopic = () => {
    if (!editedDetailedNotes) {
      setEditedDetailedNotes({
        discussion_by_topic: [{ topic: '', key_points: [], decisions: [], action_items: [] }],
        notable_quotes: [],
        open_questions: [],
        parking_lot: []
      })
    } else {
      setEditedDetailedNotes({
        ...editedDetailedNotes,
        discussion_by_topic: [
          ...editedDetailedNotes.discussion_by_topic,
          { topic: '', key_points: [], decisions: [], action_items: [] }
        ]
      })
    }
  }

  const handleUpdateDiscussionTopic = (index: number, field: string, value: any) => {
    if (!editedDetailedNotes) return
    const updated = [...editedDetailedNotes.discussion_by_topic]
    updated[index] = { ...updated[index], [field]: value }
    setEditedDetailedNotes({ ...editedDetailedNotes, discussion_by_topic: updated })
  }

  const handleDeleteDiscussionTopic = (index: number) => {
    if (!editedDetailedNotes) return
    setEditedDetailedNotes({
      ...editedDetailedNotes,
      discussion_by_topic: editedDetailedNotes.discussion_by_topic.filter((_, i) => i !== index)
    })
  }

  // Phase 5.5: Notable quotes manipulation
  const handleAddQuote = () => {
    if (!editedDetailedNotes) {
      setEditedDetailedNotes({
        discussion_by_topic: [],
        notable_quotes: [{ speaker: '', quote: '' }],
        open_questions: [],
        parking_lot: []
      })
    } else {
      setEditedDetailedNotes({
        ...editedDetailedNotes,
        notable_quotes: [...editedDetailedNotes.notable_quotes, { speaker: '', quote: '' }]
      })
    }
  }

  const handleUpdateQuote = (index: number, field: 'speaker' | 'quote', value: string) => {
    if (!editedDetailedNotes) return
    const updated = [...editedDetailedNotes.notable_quotes]
    updated[index] = { ...updated[index], [field]: value }
    setEditedDetailedNotes({ ...editedDetailedNotes, notable_quotes: updated })
  }

  const handleDeleteQuote = (index: number) => {
    if (!editedDetailedNotes) return
    setEditedDetailedNotes({
      ...editedDetailedNotes,
      notable_quotes: editedDetailedNotes.notable_quotes.filter((_, i) => i !== index)
    })
  }

  // Phase 5.5: Open questions manipulation
  const handleAddQuestion = () => {
    if (!editedDetailedNotes) {
      setEditedDetailedNotes({
        discussion_by_topic: [],
        notable_quotes: [],
        open_questions: [''],
        parking_lot: []
      })
    } else {
      setEditedDetailedNotes({
        ...editedDetailedNotes,
        open_questions: [...editedDetailedNotes.open_questions, '']
      })
    }
  }

  const handleUpdateQuestion = (index: number, value: string) => {
    if (!editedDetailedNotes) return
    const updated = [...editedDetailedNotes.open_questions]
    updated[index] = value
    setEditedDetailedNotes({ ...editedDetailedNotes, open_questions: updated })
  }

  const handleDeleteQuestion = (index: number) => {
    if (!editedDetailedNotes) return
    setEditedDetailedNotes({
      ...editedDetailedNotes,
      open_questions: editedDetailedNotes.open_questions.filter((_, i) => i !== index)
    })
  }

  // Phase 5.5: Parking lot manipulation
  const handleAddParkingLotItem = () => {
    if (!editedDetailedNotes) {
      setEditedDetailedNotes({
        discussion_by_topic: [],
        notable_quotes: [],
        open_questions: [],
        parking_lot: ['']
      })
    } else {
      setEditedDetailedNotes({
        ...editedDetailedNotes,
        parking_lot: [...editedDetailedNotes.parking_lot, '']
      })
    }
  }

  const handleUpdateParkingLotItem = (index: number, value: string) => {
    if (!editedDetailedNotes) return
    const updated = [...editedDetailedNotes.parking_lot]
    updated[index] = value
    setEditedDetailedNotes({ ...editedDetailedNotes, parking_lot: updated })
  }

  const handleDeleteParkingLotItem = (index: number) => {
    if (!editedDetailedNotes) return
    setEditedDetailedNotes({
      ...editedDetailedNotes,
      parking_lot: editedDetailedNotes.parking_lot.filter((_, i) => i !== index)
    })
  }

  // Phase 4b: Save recipients and subject line
  const handleSaveEmailSettings = () => {
    onUpdate({
      recipients: selectedRecipients,
      subjectLine: subjectLine
    })
  }

  // Phase 5.5: Handle section toggles change (memoized to prevent infinite loop)
  const handleSectionsChange = useCallback((sections: EmailSectionToggles) => {
    setEnabledSections(sections)
    onUpdate({ enabledSections: sections })
  }, [onUpdate])

  // Phase 5: Send email handler
  const handleSendEmail = async () => {
    setIsSending(true)
    setSendError(null)
    setSendSuccess(false)

    try {
      // Import email generator to create HTML
      const { generateEmailHTML } = await import('../../utils/emailGenerator')

      // Generate email HTML with Phase 5.5 customizations
      const emailHtml = generateEmailHTML({
        summary: editedSummary,
        speakers: editedSpeakers,
        actionItems: editedActionItems,
        keyDecisions: editedKeyDecisions,
        detailedNotes: editedDetailedNotes,
        customIntroduction: customIntroduction || undefined,
        enabledSections: enabledSections
      })

      // Send via Graph API
      const result = await window.electronAPI.graphApi.sendEmail({
        to: selectedRecipients,
        subject: subjectLine,
        bodyHtml: emailHtml
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to send email')
      }

      // Mark as sent in database
      const markResult = await window.electronAPI.database.markSummarySent(
        summary.id,
        selectedRecipients
      )

      if (!markResult.success) {
        console.error('Failed to mark summary as sent:', markResult.error)
        // Don't throw - email was sent successfully, just database update failed
      }

      setSendSuccess(true)

      // Close preview after 2 seconds
      setTimeout(() => {
        setShowEmailPreview(false)
        setSendSuccess(false)
      }, 2000)

    } catch (error) {
      console.error('Failed to send email:', error)
      setSendError(error instanceof Error ? error.message : 'Failed to send email')
    } finally {
      setIsSending(false)
    }
  }

  const handleExport = () => {
    // Parse detailed notes if available
    const detailedNotesJson = summary.pass2_refined_detailed_notes_json || summary.pass1_detailed_notes_json
    let detailedNotes = null
    if (detailedNotesJson) {
      try {
        detailedNotes = JSON.parse(detailedNotesJson)
      } catch (e) {
        console.error('Failed to parse detailed notes:', e)
      }
    }

    // Format summary data for export
    const exportData = {
      summary: editedSummary,
      speakers: speakers.map(s => ({
        label: s.label,
        name: s.name,
        email: s.email,
        confidence: s.confidence,
        reasoning: s.reasoning
      })),
      actionItems: actionItems.map(a => ({
        description: a.description,
        assignee: a.assignee,
        dueDate: a.dueDate,
        priority: a.priority
      })),
      keyDecisions: keyDecisions,
      detailedNotes,
      metadata: {
        created: summary.created_at,
        pass1Completed: summary.pass1_completed_at,
        pass2Completed: summary.pass2_completed_at,
        edited: summary.edited_at
      }
    }

    // Create formatted text version
    let textContent = '# Meeting Summary\n\n'

    // Summary
    textContent += `## Summary\n${editedSummary}\n\n`

    // Speakers
    if (speakers.length > 0) {
      textContent += `## Speaker Identification (${speakers.length})\n`
      speakers.forEach(speaker => {
        textContent += `- ${speaker.label} → ${speaker.name}`
        if (speaker.email) textContent += ` (${speaker.email})`
        textContent += ` [Confidence: ${speaker.confidence}]\n`
        textContent += `  ${speaker.reasoning}\n`
      })
      textContent += '\n'
    }

    // Action Items
    if (actionItems.length > 0) {
      textContent += `## Action Items (${actionItems.length})\n`
      actionItems.forEach((item, i) => {
        textContent += `${i + 1}. ${item.description}\n`
        if (item.assignee) textContent += `   Assignee: ${item.assignee}\n`
        if (item.dueDate) textContent += `   Due: ${new Date(item.dueDate).toLocaleDateString()}\n`
        textContent += `   Priority: ${item.priority}\n`
      })
      textContent += '\n'
    }

    // Key Decisions
    if (keyDecisions.length > 0) {
      textContent += `## Key Decisions (${keyDecisions.length})\n`
      keyDecisions.forEach((decision, i) => {
        textContent += `${i + 1}. ${decision}\n`
      })
      textContent += '\n'
    }

    // Detailed Notes
    if (detailedNotes) {
      // Discussion by Topic
      if (detailedNotes.discussion_by_topic && detailedNotes.discussion_by_topic.length > 0) {
        textContent += `## Discussion by Topic\n\n`
        detailedNotes.discussion_by_topic.forEach((topic: any) => {
          textContent += `### ${topic.topic}\n\n`

          if (topic.key_points && topic.key_points.length > 0) {
            textContent += `**Key Points:**\n`
            topic.key_points.forEach((point: string) => {
              textContent += `- ${point}\n`
            })
            textContent += '\n'
          }

          if (topic.decisions && topic.decisions.length > 0) {
            textContent += `**Decisions:**\n`
            topic.decisions.forEach((decision: string) => {
              textContent += `- ${decision}\n`
            })
            textContent += '\n'
          }

          if (topic.action_items && topic.action_items.length > 0) {
            textContent += `**Related Action Items:**\n`
            topic.action_items.forEach((item: any) => {
              textContent += `- ${item.description}`
              if (item.assignee) textContent += ` (${item.assignee})`
              textContent += '\n'
            })
            textContent += '\n'
          }
        })
      }

      // Notable Quotes
      if (detailedNotes.notable_quotes && detailedNotes.notable_quotes.length > 0) {
        textContent += `## Notable Quotes\n\n`
        detailedNotes.notable_quotes.forEach((quote: any) => {
          textContent += `> "${quote.quote}"\n>\n> — ${quote.speaker}\n\n`
        })
      }

      // Open Questions
      if (detailedNotes.open_questions && detailedNotes.open_questions.length > 0) {
        textContent += `## Open Questions\n\n`
        detailedNotes.open_questions.forEach((question: string) => {
          textContent += `- ${question}\n`
        })
        textContent += '\n'
      }

      // Parking Lot
      if (detailedNotes.parking_lot && detailedNotes.parking_lot.length > 0) {
        textContent += `## Parking Lot\n\n`
        detailedNotes.parking_lot.forEach((item: string) => {
          textContent += `- ${item}\n`
        })
        textContent += '\n'
      }
    }

    // Metadata
    textContent += '## Metadata\n'
    textContent += `Created: ${new Date(summary.created_at).toLocaleString()}\n`
    if (summary.pass1_completed_at) {
      textContent += `Pass 1 Complete: ${new Date(summary.pass1_completed_at).toLocaleString()}\n`
    }
    if (summary.pass2_completed_at) {
      textContent += `Pass 2 Complete: ${new Date(summary.pass2_completed_at).toLocaleString()}\n`
    }

    // Create downloadable blob
    const blob = new Blob([textContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // Use local date instead of UTC for filename
    const localDate = new Date()
    const dateStr = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`
    a.download = `meeting-summary-${dateStr}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    // Also copy to clipboard
    navigator.clipboard.writeText(textContent).then(() => {
      console.log('Summary copied to clipboard')
    }).catch(err => {
      console.error('Failed to copy to clipboard:', err)
    })
  }

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'high': return 'badge-priority-high'
      case 'medium': return 'badge-priority-medium'
      case 'low': return 'badge-priority-low'
      default: return 'badge-priority-medium'
    }
  }

  const getConfidenceBadgeClass = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'badge-confidence-high'
      case 'medium': return 'badge-confidence-medium'
      case 'low': return 'badge-confidence-low'
      default: return 'badge-confidence-medium'
    }
  }

  return (
    <div className="summary-display">
      <div className="summary-header">
        <div className="summary-title-row">
          {onBack && (
            <button
              onClick={handleBack}
              className="btn btn-back"
              title="Return to meeting selection"
            >
              ← Back
            </button>
          )}
          <h3>📝 Meeting Summary</h3>
        </div>
        <div className="summary-actions">
          <button
            onClick={handleExport}
            className="btn btn-primary"
            title="Export summary as markdown file and copy to clipboard"
          >
            💾 Export
          </button>
          <button
            onClick={onRegenerate}
            disabled={isUpdating}
            className="btn btn-secondary"
          >
            🔄 Regenerate
          </button>
        </div>
      </div>

      {/* Speaker Mappings */}
      <div className="summary-section">
        <div className="section-header">
          <h4>👥 Speaker Identification ({editedSpeakers.length})</h4>
          {!isEditingSpeakers && (
            <button
              onClick={() => setIsEditingSpeakers(true)}
              className="btn btn-small btn-edit"
            >
              ✏️ Edit
            </button>
          )}
        </div>

        {isEditingSpeakers ? (
          <div className="editor-container">
            <div className="speakers-list">
              {editedSpeakers.map((speaker, index) => (
                <div key={index} className="speaker-card editing">
                  <div className="speaker-edit-form">
                    <div className="form-row">
                      <label className="form-label">
                        <span className="speaker-label-readonly">{speaker.label}</span>
                      </label>
                      <input
                        type="text"
                        value={speaker.name}
                        onChange={(e) => handleUpdateSpeaker(index, 'name', e.target.value)}
                        placeholder="Speaker name"
                        className="form-input"
                      />
                      <input
                        type="email"
                        value={speaker.email || ''}
                        onChange={(e) => handleUpdateSpeaker(index, 'email', e.target.value)}
                        placeholder="Email (optional)"
                        className="form-input"
                      />
                    </div>
                    <div className="form-row">
                      <label>Confidence:</label>
                      <select
                        value={speaker.confidence}
                        onChange={(e) => handleUpdateSpeaker(index, 'confidence', e.target.value)}
                        className="form-select"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                    <textarea
                      value={speaker.reasoning}
                      onChange={(e) => handleUpdateSpeaker(index, 'reasoning', e.target.value)}
                      placeholder="Reasoning for this mapping"
                      className="form-textarea"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="editor-actions">
              <button
                onClick={handleSaveSpeakers}
                disabled={isSavingSpeakers}
                className="btn btn-primary"
              >
                {isSavingSpeakers ? '💾 Saving...' : '💾 Save'}
              </button>
              <button
                onClick={handleCancelSpeakers}
                disabled={isSavingSpeakers}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="speakers-list">
            {editedSpeakers.map((speaker, index) => (
              <div key={index} className="speaker-card">
                <div className="speaker-header">
                  <span className="speaker-label">{speaker.label}</span>
                  <span className="speaker-arrow">→</span>
                  <span className="speaker-name">{speaker.name}</span>
                  {speaker.email && (
                    <span className="speaker-email">({speaker.email})</span>
                  )}
                  <span className={`badge ${getConfidenceBadgeClass(speaker.confidence)}`}>
                    {speaker.confidence}
                  </span>
                </div>
                <p className="speaker-reasoning">{speaker.reasoning}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="summary-section">
        <div className="section-header">
          <h4>📄 Summary</h4>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="btn btn-small btn-edit"
            >
              ✏️ Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="summary-editor">
            <textarea
              value={editedSummary}
              onChange={(e) => setEditedSummary(e.target.value)}
              className="summary-textarea"
              rows={10}
            />
            <div className="editor-actions">
              <button
                onClick={handleSave}
                disabled={isSavingSummary}
                className="btn btn-primary"
              >
                {isSavingSummary ? '💾 Saving...' : '💾 Save'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSavingSummary}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="summary-content">
            <p className="summary-text">{editedSummary}</p>
          </div>
        )}
      </div>

      {/* Action Items */}
      {(editedActionItems.length > 0 || isEditingActionItems) && (
        <div className="summary-section">
          <div className="section-header">
            <h4>✅ Action Items ({editedActionItems.length})</h4>
            {!isEditingActionItems && (
              <button
                onClick={() => setIsEditingActionItems(true)}
                className="btn btn-small btn-edit"
              >
                ✏️ Edit
              </button>
            )}
          </div>

          {isEditingActionItems ? (
            <div className="editor-container">
              <div className="action-items-list">
                {editedActionItems.map((item, index) => (
                  <div key={index} className="action-item editing">
                    <div className="action-edit-form">
                      <textarea
                        value={item.description}
                        onChange={(e) => handleUpdateActionItem(index, 'description', e.target.value)}
                        placeholder="Action item description"
                        className="form-textarea"
                        rows={3}
                      />
                      <div className="form-row">
                        <input
                          type="text"
                          value={item.assignee || ''}
                          onChange={(e) => handleUpdateActionItem(index, 'assignee', e.target.value || null)}
                          placeholder="Assignee (optional)"
                          className="form-input"
                        />
                        <select
                          value={item.priority}
                          onChange={(e) => handleUpdateActionItem(index, 'priority', e.target.value)}
                          className="form-select"
                        >
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                        </select>
                        <input
                          type="date"
                          value={item.dueDate || ''}
                          onChange={(e) => handleUpdateActionItem(index, 'dueDate', e.target.value || null)}
                          className="form-input"
                        />
                        <button
                          onClick={() => handleDeleteActionItem(index)}
                          className="btn btn-small btn-danger"
                          title="Delete action item"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddActionItem}
                className="btn btn-small btn-secondary"
              >
                ➕ Add Action Item
              </button>
              <div className="editor-actions">
                <button
                  onClick={handleSaveActionItems}
                  disabled={isSavingActionItems}
                  className="btn btn-primary"
                >
                  {isSavingActionItems ? '💾 Saving...' : '💾 Save'}
                </button>
                <button
                  onClick={handleCancelActionItems}
                  disabled={isSavingActionItems}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="action-items-list">
              {editedActionItems.map((item, index) => (
                <div key={index} className="action-item">
                  <div className="action-header">
                    <span className={`badge ${getPriorityBadgeClass(item.priority)}`}>
                      {item.priority}
                    </span>
                    {item.assignee && (
                      <span className="action-assignee">
                        👤 {item.assignee}
                      </span>
                    )}
                    {item.dueDate && (
                      <span className="action-due-date">
                        📅 {new Date(item.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="action-description">{item.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Key Decisions */}
      {(editedKeyDecisions.length > 0 || isEditingKeyDecisions) && (
        <div className="summary-section">
          <div className="section-header">
            <h4>🎯 Key Decisions ({editedKeyDecisions.length})</h4>
            {!isEditingKeyDecisions && (
              <button
                onClick={() => setIsEditingKeyDecisions(true)}
                className="btn btn-small btn-edit"
              >
                ✏️ Edit
              </button>
            )}
          </div>

          {isEditingKeyDecisions ? (
            <div className="editor-container">
              <div className="decisions-list editing">
                {editedKeyDecisions.map((decision, index) => (
                  <div key={index} className="decision-item-edit">
                    <textarea
                      value={decision}
                      onChange={(e) => handleUpdateKeyDecision(index, e.target.value)}
                      placeholder="Key decision"
                      className="form-textarea"
                      rows={2}
                    />
                    <button
                      onClick={() => handleDeleteKeyDecision(index)}
                      className="btn btn-small btn-danger"
                      title="Delete decision"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddKeyDecision}
                className="btn btn-small btn-secondary"
              >
                ➕ Add Decision
              </button>
              <div className="editor-actions">
                <button
                  onClick={handleSaveKeyDecisions}
                  disabled={isSavingKeyDecisions}
                  className="btn btn-primary"
                >
                  {isSavingKeyDecisions ? '💾 Saving...' : '💾 Save'}
                </button>
                <button
                  onClick={handleCancelKeyDecisions}
                  disabled={isSavingKeyDecisions}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <ul className="decisions-list">
              {editedKeyDecisions.map((decision, index) => (
                <li key={index} className="decision-item">
                  {decision}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Phase 5.5: Discussion by Topic */}
      {editedDetailedNotes && editedDetailedNotes.discussion_by_topic &&
        editedDetailedNotes.discussion_by_topic.length > 0 && (
        <div className="summary-section">
          <div className="section-header">
            <h4>📋 Discussion by Topic ({editedDetailedNotes.discussion_by_topic.length})</h4>
            {!isEditingDiscussionTopics && (
              <button
                onClick={() => setIsEditingDiscussionTopics(true)}
                className="btn btn-small btn-edit"
              >
                ✏️ Edit
              </button>
            )}
          </div>

          {isEditingDiscussionTopics ? (
            <div className="editor-container">
              <div className="discussion-topics-list editing">
                {editedDetailedNotes.discussion_by_topic.map((topic, index) => (
                  <div key={index} className="discussion-topic editing">
                    <input
                      type="text"
                      value={topic.topic}
                      onChange={(e) => handleUpdateDiscussionTopic(index, 'topic', e.target.value)}
                      placeholder="Topic name"
                      className="form-input"
                      style={{ marginBottom: '12px', fontWeight: 'bold' }}
                    />

                    {/* Key Points */}
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                        Key Points:
                      </label>
                      {topic.key_points.map((point, pointIndex) => (
                        <div key={pointIndex} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                          <input
                            type="text"
                            value={point}
                            onChange={(e) => {
                              const updated = [...topic.key_points]
                              updated[pointIndex] = e.target.value
                              handleUpdateDiscussionTopic(index, 'key_points', updated)
                            }}
                            placeholder="Key point"
                            className="form-input"
                          />
                          <button
                            onClick={() => {
                              const updated = topic.key_points.filter((_, i) => i !== pointIndex)
                              handleUpdateDiscussionTopic(index, 'key_points', updated)
                            }}
                            className="btn btn-danger btn-small"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const updated = [...topic.key_points, '']
                          handleUpdateDiscussionTopic(index, 'key_points', updated)
                        }}
                        className="btn btn-small btn-secondary"
                        style={{ marginTop: '6px' }}
                      >
                        ➕ Add Key Point
                      </button>
                    </div>

                    {/* Decisions */}
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>
                        Decisions:
                      </label>
                      {topic.decisions.map((decision, decIndex) => (
                        <div key={decIndex} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                          <input
                            type="text"
                            value={decision}
                            onChange={(e) => {
                              const updated = [...topic.decisions]
                              updated[decIndex] = e.target.value
                              handleUpdateDiscussionTopic(index, 'decisions', updated)
                            }}
                            placeholder="Decision"
                            className="form-input"
                          />
                          <button
                            onClick={() => {
                              const updated = topic.decisions.filter((_, i) => i !== decIndex)
                              handleUpdateDiscussionTopic(index, 'decisions', updated)
                            }}
                            className="btn btn-danger btn-small"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const updated = [...topic.decisions, '']
                          handleUpdateDiscussionTopic(index, 'decisions', updated)
                        }}
                        className="btn btn-small btn-secondary"
                        style={{ marginTop: '6px' }}
                      >
                        ➕ Add Decision
                      </button>
                    </div>

                    {/* Delete Topic Button */}
                    <button
                      onClick={() => handleDeleteDiscussionTopic(index)}
                      className="btn btn-danger btn-small"
                      style={{ marginTop: '12px' }}
                    >
                      🗑️ Delete Topic
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddDiscussionTopic}
                className="btn btn-small btn-secondary"
              >
                ➕ Add Topic
              </button>

              <div className="editor-actions">
                <button
                  onClick={handleSaveDetailedNotes}
                  disabled={isSavingDetailedNotes}
                  className="btn btn-primary"
                >
                  {isSavingDetailedNotes ? '💾 Saving...' : '💾 Save'}
                </button>
                <button
                  onClick={handleCancelDetailedNotes}
                  disabled={isSavingDetailedNotes}
                  className="btn btn-secondary"
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="discussion-topics-list">
              {editedDetailedNotes.discussion_by_topic.map((topic, index) => (
                <div key={index} className="discussion-topic">
                  <h5 style={{ marginBottom: '8px', color: '#2D2042' }}>{topic.topic}</h5>

                  {topic.key_points.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <strong>Key Points:</strong>
                      <ul style={{ marginTop: '6px', marginLeft: '20px' }}>
                        {topic.key_points.map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {topic.decisions.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <strong>Decisions:</strong>
                      <ul style={{ marginTop: '6px', marginLeft: '20px' }}>
                        {topic.decisions.map((decision, i) => (
                          <li key={i}>{decision}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {topic.action_items && topic.action_items.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <strong>Related Action Items:</strong>
                      <ul style={{ marginTop: '6px', marginLeft: '20px' }}>
                        {topic.action_items.map((item, i) => (
                          <li key={i}>
                            {item.description}
                            {item.assignee && <span style={{ color: '#777' }}> ({item.assignee})</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Phase 5.5: Detailed Notes Sections */}
      {editedDetailedNotes && editedDetailedNotes.notable_quotes && editedDetailedNotes.notable_quotes.length > 0 && (
        <div className="summary-section">
          <div className="section-header">
            <h4>💬 Notable Quotes ({editedDetailedNotes.notable_quotes.length})</h4>
            {!isEditingQuotes && (
              <button
                onClick={() => setIsEditingQuotes(true)}
                className="btn btn-small btn-edit"
              >
                ✏️ Edit
              </button>
            )}
          </div>

          {isEditingQuotes ? (
            <div className="editor-container">
              <div className="quotes-list editing">
                {editedDetailedNotes.notable_quotes.map((quote, index) => (
                  <div key={index} className="quote-item editing">
                    <input
                      type="text"
                      value={quote.speaker}
                      onChange={(e) => handleUpdateQuote(index, 'speaker', e.target.value)}
                      placeholder="Speaker name"
                      className="form-input"
                      style={{ marginBottom: '8px' }}
                    />
                    <textarea
                      value={quote.quote}
                      onChange={(e) => handleUpdateQuote(index, 'quote', e.target.value)}
                      placeholder="Quote text"
                      className="form-input"
                      rows={2}
                      style={{ marginBottom: '8px' }}
                    />
                    <button
                      onClick={() => handleDeleteQuote(index)}
                      className="btn btn-danger btn-small"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddQuote}
                className="btn btn-small btn-secondary"
              >
                ➕ Add Quote
              </button>
              <div className="editor-actions">
                <button
                  onClick={handleSaveDetailedNotes}
                  disabled={isSavingDetailedNotes}
                  className="btn btn-primary"
                >
                  {isSavingDetailedNotes ? '💾 Saving...' : '💾 Save'}
                </button>
                <button
                  onClick={handleCancelDetailedNotes}
                  disabled={isSavingDetailedNotes}
                  className="btn btn-secondary"
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="quotes-list">
              {editedDetailedNotes.notable_quotes.map((quote, index) => (
                <div key={index} className="quote-item">
                  <blockquote>"{quote.quote}"</blockquote>
                  <cite>— {quote.speaker}</cite>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editedDetailedNotes && editedDetailedNotes.open_questions && editedDetailedNotes.open_questions.length > 0 && (
        <div className="summary-section">
          <div className="section-header">
            <h4>❓ Open Questions ({editedDetailedNotes.open_questions.length})</h4>
            {!isEditingQuestions && (
              <button
                onClick={() => setIsEditingQuestions(true)}
                className="btn btn-small btn-edit"
              >
                ✏️ Edit
              </button>
            )}
          </div>

          {isEditingQuestions ? (
            <div className="editor-container">
              <div className="questions-list editing">
                {editedDetailedNotes.open_questions.map((question, index) => (
                  <div key={index} className="question-item editing">
                    <textarea
                      value={question}
                      onChange={(e) => handleUpdateQuestion(index, e.target.value)}
                      placeholder="Question text"
                      className="form-input"
                      rows={2}
                    />
                    <button
                      onClick={() => handleDeleteQuestion(index)}
                      className="btn btn-danger btn-small"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddQuestion}
                className="btn btn-small btn-secondary"
              >
                ➕ Add Question
              </button>
              <div className="editor-actions">
                <button
                  onClick={handleSaveDetailedNotes}
                  disabled={isSavingDetailedNotes}
                  className="btn btn-primary"
                >
                  {isSavingDetailedNotes ? '💾 Saving...' : '💾 Save'}
                </button>
                <button
                  onClick={handleCancelDetailedNotes}
                  disabled={isSavingDetailedNotes}
                  className="btn btn-secondary"
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
          ) : (
            <ul className="questions-list">
              {editedDetailedNotes.open_questions.map((question, index) => (
                <li key={index}>{question}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {editedDetailedNotes && editedDetailedNotes.parking_lot && editedDetailedNotes.parking_lot.length > 0 && (
        <div className="summary-section">
          <div className="section-header">
            <h4>🅿️ Parking Lot ({editedDetailedNotes.parking_lot.length})</h4>
            {!isEditingParkingLot && (
              <button
                onClick={() => setIsEditingParkingLot(true)}
                className="btn btn-small btn-edit"
              >
                ✏️ Edit
              </button>
            )}
          </div>

          {isEditingParkingLot ? (
            <div className="editor-container">
              <div className="parking-lot-list editing">
                {editedDetailedNotes.parking_lot.map((item, index) => (
                  <div key={index} className="parking-lot-item editing">
                    <textarea
                      value={item}
                      onChange={(e) => handleUpdateParkingLotItem(index, e.target.value)}
                      placeholder="Parking lot item"
                      className="form-input"
                      rows={2}
                    />
                    <button
                      onClick={() => handleDeleteParkingLotItem(index)}
                      className="btn btn-danger btn-small"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddParkingLotItem}
                className="btn btn-small btn-secondary"
              >
                ➕ Add Item
              </button>
              <div className="editor-actions">
                <button
                  onClick={handleSaveDetailedNotes}
                  disabled={isSavingDetailedNotes}
                  className="btn btn-primary"
                >
                  {isSavingDetailedNotes ? '💾 Saving...' : '💾 Save'}
                </button>
                <button
                  onClick={handleCancelDetailedNotes}
                  disabled={isSavingDetailedNotes}
                  className="btn btn-secondary"
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
          ) : (
            <ul className="parking-lot-list">
              {editedDetailedNotes.parking_lot.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Phase 4b: Email Recipients and Subject Line */}
      <div className="summary-section">
        <h4>📧 Email Distribution</h4>

        <div className="email-settings">
          <div className="subject-line-editor">
            <label htmlFor="subject-line">Subject Line:</label>
            <input
              id="subject-line"
              type="text"
              value={subjectLine}
              onChange={(e) => setSubjectLine(e.target.value)}
              className="form-input subject-input"
              placeholder="Email subject line"
            />
          </div>

          {/* Phase 5.5: Custom Introduction */}
          <div className="summary-section" style={{ marginTop: '30px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '15px'
            }}>
              <h3 style={{
                color: '#2D2042',
                fontSize: '18px',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>👋</span>
                <span>Custom Introduction (Optional)</span>
              </h3>
              {!isEditingIntroduction && (
                <button
                  onClick={() => setIsEditingIntroduction(true)}
                  className="btn btn-small btn-edit"
                >
                  ✏️ Edit
                </button>
              )}
            </div>

            {isEditingIntroduction ? (
              <div>
                <textarea
                  value={customIntroduction}
                  onChange={(e) => setCustomIntroduction(e.target.value)}
                  placeholder="Add a personalized introduction before the summary (e.g., context, follow-up instructions, or background info)..."
                  maxLength={500}
                  style={{
                    width: '100%',
                    minHeight: '100px',
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #e0e0e0',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    lineHeight: '1.6',
                    resize: 'vertical'
                  }}
                />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '10px'
                }}>
                  <span style={{ fontSize: '13px', color: '#777' }}>
                    {customIntroduction.length}/500 characters
                  </span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={async () => {
                        setIsSavingIntroduction(true)
                        try {
                          await onUpdate({ customIntroduction })
                          setIsEditingIntroduction(false)
                        } catch (error) {
                          console.error('[SummaryDisplay] Failed to save introduction:', error)
                        } finally {
                          setIsSavingIntroduction(false)
                        }
                      }}
                      disabled={isSavingIntroduction}
                      className="btn btn-primary"
                      style={{
                        padding: '6px 16px',
                        fontSize: '14px'
                      }}
                    >
                      {isSavingIntroduction ? '💾 Saving...' : '💾 Save'}
                    </button>
                    <button
                      onClick={() => {
                        setCustomIntroduction(summary.custom_introduction || '')
                        setIsEditingIntroduction(false)
                      }}
                      disabled={isSavingIntroduction}
                      className="btn btn-secondary"
                      style={{
                        padding: '6px 16px',
                        fontSize: '14px'
                      }}
                    >
                      ✖️ Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                background: customIntroduction ? '#EBF4FF' : '#f8f8f8',
                padding: '15px',
                borderRadius: '6px',
                border: `1px solid ${customIntroduction ? '#60B5E5' : '#e0e0e0'}`,
                fontSize: '14px',
                color: customIntroduction ? '#555' : '#999',
                lineHeight: '1.6',
                fontStyle: customIntroduction ? 'normal' : 'italic'
              }}>
                {customIntroduction || 'No custom introduction added. Click Edit to add one.'}
              </div>
            )}
          </div>

          {/* Phase 5.5: Email Section Toggles */}
          <EmailSectionTogglesComponent
            initialSections={enabledSections}
            onChange={handleSectionsChange}
          />

          <RecipientSelector
            meetingId={summary.meeting_id}
            selectedRecipients={selectedRecipients}
            onRecipientsChange={setSelectedRecipients}
          />

          <div className="email-actions">
            <button
              onClick={handleSaveEmailSettings}
              disabled={isUpdating}
              className="btn btn-primary"
            >
              💾 Save Email Settings
            </button>
            <button
              onClick={() => setShowEmailPreview(true)}
              className="btn btn-secondary"
              disabled={selectedRecipients.length === 0}
              title={selectedRecipients.length === 0 ? 'Add recipients to preview email' : 'Preview formatted email'}
            >
              👁️ Preview Email
            </button>
          </div>
        </div>
      </div>

      {/* Email Preview Modal */}
      {showEmailPreview && (
        <EmailPreview
          summary={editedSummary}
          speakers={editedSpeakers}
          actionItems={editedActionItems}
          keyDecisions={editedKeyDecisions}
          detailedNotes={editedDetailedNotes}
          recipients={selectedRecipients}
          subjectLine={subjectLine}
          customIntroduction={customIntroduction}
          enabledSections={enabledSections}
          onClose={() => setShowEmailPreview(false)}
          onSend={handleSendEmail}
          isSending={isSending}
          sendError={sendError}
          sendSuccess={sendSuccess}
        />
      )}

      {/* Pass 2 Corrections (if available) */}
      {summary.pass2_corrections_json && (
        <div className="summary-section corrections-section">
          <h4>🔍 Validation Corrections</h4>
          <ul className="corrections-list">
            {JSON.parse(summary.pass2_corrections_json).map((correction: string, index: number) => (
              <li key={index} className="correction-item">
                {correction}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Timestamps */}
      <div className="summary-footer">
        <div className="summary-metadata">
          <span className="metadata-item">
            Created: {new Date(summary.created_at).toLocaleString()}
          </span>
          {summary.pass1_completed_at && (
            <span className="metadata-item">
              Pass 1: {new Date(summary.pass1_completed_at).toLocaleString()}
            </span>
          )}
          {summary.pass2_completed_at && (
            <span className="metadata-item">
              Pass 2: {new Date(summary.pass2_completed_at).toLocaleString()}
            </span>
          )}
          {summary.edited_at && (
            <span className="metadata-item">
              Edited: {new Date(summary.edited_at).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

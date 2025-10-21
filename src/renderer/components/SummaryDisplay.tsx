/**
 * Summary Display Component
 *
 * Displays meeting summary with speaker mappings, action items, and key decisions.
 * Supports editing before final distribution.
 * Phase 2.3-3: LLM-Based Meeting Intelligence
 */

import { useState } from 'react'
import type { MeetingSummary, SpeakerMapping, ActionItem } from '../../types/meetingSummary'

interface SummaryDisplayProps {
  summary: MeetingSummary
  onUpdate: (updates: {
    summary?: string
    speakers?: SpeakerMapping[]
    actionItems?: ActionItem[]
    keyDecisions?: string[]
  }) => void
  onRegenerate: () => void
  onBack?: () => void  // Phase 2.3-4: Navigate back to selection
  isUpdating: boolean
}

export function SummaryDisplay({ summary, onUpdate, onRegenerate, onBack, isUpdating }: SummaryDisplayProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedSummary, setEditedSummary] = useState(summary.final_summary || summary.pass2_refined_summary || summary.pass1_summary || '')

  // Handle back navigation - safe to call since this component only renders when summary is complete
  const handleBack = () => {
    if (isEditing) {
      // Warn user if they have unsaved edits
      if (confirm('You have unsaved edits. Are you sure you want to go back?')) {
        onBack?.()
      }
    } else {
      onBack?.()
    }
  }

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

  const handleSave = () => {
    onUpdate({ summary: editedSummary })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedSummary(summary.final_summary || summary.pass2_refined_summary || summary.pass1_summary || '')
    setIsEditing(false)
  }

  const handleExport = () => {
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
    a.download = `meeting-summary-${new Date().toISOString().split('T')[0]}.md`
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
        <h4>👥 Speaker Identification ({speakers.length})</h4>
        <div className="speakers-list">
          {speakers.map((speaker, index) => (
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
                disabled={isUpdating}
                className="btn btn-primary"
              >
                💾 Save
              </button>
              <button
                onClick={handleCancel}
                disabled={isUpdating}
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
      {actionItems.length > 0 && (
        <div className="summary-section">
          <h4>✅ Action Items ({actionItems.length})</h4>
          <div className="action-items-list">
            {actionItems.map((item, index) => (
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
        </div>
      )}

      {/* Key Decisions */}
      {keyDecisions.length > 0 && (
        <div className="summary-section">
          <h4>🎯 Key Decisions ({keyDecisions.length})</h4>
          <ul className="decisions-list">
            {keyDecisions.map((decision, index) => (
              <li key={index} className="decision-item">
                {decision}
              </li>
            ))}
          </ul>
        </div>
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

/**
 * Email Preview Component
 *
 * Preview formatted email before sending
 * Phase 4b: Summary Editor & Email
 */

import type { MeetingSummary, SpeakerMapping, ActionItem, DetailedNotes, EmailRecipient } from '../../types/meetingSummary'

interface EmailPreviewProps {
  summary: string
  speakers: SpeakerMapping[]
  actionItems: ActionItem[]
  keyDecisions: string[]
  detailedNotes: DetailedNotes | null
  recipients: EmailRecipient[]
  subjectLine: string
  onClose: () => void
  onSend?: () => void
}

export function EmailPreview({
  summary,
  speakers,
  actionItems,
  keyDecisions,
  detailedNotes,
  recipients,
  subjectLine,
  onClose,
  onSend
}: EmailPreviewProps) {
  // Generate email body HTML
  const generateEmailHTML = () => {
    let html = `
      <div style="font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
        <!-- Header with Aileron Branding -->
        <div style="background: linear-gradient(135deg, #2D2042 0%, #60B5E5 100%); padding: 30px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Meeting Summary</h1>
        </div>

        <!-- Content -->
        <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
    `

    // Summary
    html += `
      <div style="margin-bottom: 30px;">
        <h2 style="color: #2D2042; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #60B5E5; padding-bottom: 10px;">📄 Summary</h2>
        <p style="line-height: 1.6; color: #555;">${summary.replace(/\n/g, '<br>')}</p>
      </div>
    `

    // Speaker Identification (filter out Unknown speakers - typically the recording announcement)
    const knownSpeakers = speakers.filter(s => !s.name.toLowerCase().includes('unknown'))
    if (knownSpeakers.length > 0) {
      html += `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #2D2042; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #60B5E5; padding-bottom: 10px;">👥 Participants (${knownSpeakers.length})</h2>
          <div style="display: grid; gap: 10px;">
      `
      knownSpeakers.forEach(speaker => {
        // Extract organization from email domain (e.g., gil@aileron-group.com → Aileron Group)
        let organization = ''
        if (speaker.email) {
          const domain = speaker.email.split('@')[1]
          if (domain) {
            // Remove TLD and format: aileron-group.com → Aileron Group
            const orgName = domain.split('.')[0]
            organization = orgName
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ')
          }
        }

        html += `
          <div style="background: #f8f8f8; padding: 15px; border-radius: 6px; border-left: 4px solid #60B5E5;">
            <strong style="color: #2D2042;">${speaker.name}</strong>${organization ? `, ${organization}` : ''}
            ${speaker.email ? `<br><span style="color: #777; font-size: 14px;">${speaker.email}</span>` : ''}
          </div>
        `
      })
      html += `
          </div>
        </div>
      `
    }

    // Action Items
    if (actionItems.length > 0) {
      html += `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #2D2042; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #60B5E5; padding-bottom: 10px;">✅ Action Items (${actionItems.length})</h2>
          <div style="display: grid; gap: 15px;">
      `
      actionItems.forEach((item, i) => {
        const priorityColor = item.priority === 'high' ? '#e74c3c' : item.priority === 'medium' ? '#f39c12' : '#95a5a6'
        html += `
          <div style="background: #f8f8f8; padding: 15px; border-radius: 6px; border-left: 4px solid ${priorityColor};">
            <div style="margin-bottom: 8px;">
              <span style="background: ${priorityColor}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 12px; text-transform: uppercase;">${item.priority}</span>
              ${item.assignee ? `<span style="color: #555; margin-left: 10px;">👤 ${item.assignee}</span>` : ''}
              ${item.dueDate ? `<span style="color: #555; margin-left: 10px;">📅 ${new Date(item.dueDate).toLocaleDateString()}</span>` : ''}
            </div>
            <p style="margin: 0; color: #333;">${item.description}</p>
          </div>
        `
      })
      html += `
          </div>
        </div>
      `
    }

    // Key Decisions
    if (keyDecisions.length > 0) {
      html += `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #2D2042; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #60B5E5; padding-bottom: 10px;">🎯 Key Decisions (${keyDecisions.length})</h2>
          <ul style="list-style: none; padding: 0;">
      `
      keyDecisions.forEach(decision => {
        html += `
          <li style="background: #f8f8f8; padding: 12px 15px; margin-bottom: 10px; border-radius: 6px; border-left: 4px solid #60B5E5;">
            ${decision}
          </li>
        `
      })
      html += `
          </ul>
        </div>
      `
    }

    // Detailed Notes: Discussion by Topic
    if (detailedNotes && detailedNotes.discussion_by_topic && detailedNotes.discussion_by_topic.length > 0) {
      html += `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #2D2042; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #60B5E5; padding-bottom: 10px;">💬 Discussion by Topic</h2>
      `
      detailedNotes.discussion_by_topic.forEach((topic, index) => {
        html += `
          <div style="background: #f8f8f8; padding: 20px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #60B5E5;">
            <h3 style="color: #2D2042; font-size: 18px; margin-top: 0; margin-bottom: 12px;">${topic.topic}</h3>

            ${topic.key_points.length > 0 ? `
              <div style="margin-bottom: 12px;">
                <strong style="color: #555;">Key Points:</strong>
                <ul style="margin: 8px 0; padding-left: 20px; color: #666;">
                  ${topic.key_points.map(point => `<li style="margin-bottom: 4px;">${point}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            ${topic.decisions.length > 0 ? `
              <div style="margin-bottom: 12px;">
                <strong style="color: #555;">Decisions:</strong>
                <ul style="margin: 8px 0; padding-left: 20px; color: #666;">
                  ${topic.decisions.map(decision => `<li style="margin-bottom: 4px;">${decision}</li>`).join('')}
                </ul>
              </div>
            ` : ''}

            ${topic.action_items.length > 0 ? `
              <div>
                <strong style="color: #555;">Action Items:</strong>
                <ul style="margin: 8px 0; padding-left: 20px; color: #666;">
                  ${topic.action_items.map(item => `
                    <li style="margin-bottom: 4px;">
                      ${item.description}
                      ${item.assignee ? ` (${item.assignee})` : ''}
                      ${item.priority ? ` - <span style="color: ${item.priority === 'high' ? '#e74c3c' : item.priority === 'medium' ? '#f39c12' : '#95a5a6'};">${item.priority.toUpperCase()}</span>` : ''}
                    </li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
        `
      })
      html += `
        </div>
      `
    }

    // Notable Quotes
    if (detailedNotes && detailedNotes.notable_quotes && detailedNotes.notable_quotes.length > 0) {
      html += `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #2D2042; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #60B5E5; padding-bottom: 10px;">💭 Notable Quotes</h2>
      `
      detailedNotes.notable_quotes.forEach(quote => {
        html += `
          <div style="background: #f8f8f8; padding: 15px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid #60B5E5;">
            <p style="margin: 0 0 8px 0; color: #333; font-style: italic;">"${quote.quote}"</p>
            <p style="margin: 0; color: #777; font-size: 14px;">— ${quote.speaker}</p>
          </div>
        `
      })
      html += `
        </div>
      `
    }

    // Open Questions
    if (detailedNotes && detailedNotes.open_questions && detailedNotes.open_questions.length > 0) {
      html += `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #2D2042; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #60B5E5; padding-bottom: 10px;">❓ Open Questions</h2>
          <ul style="list-style: none; padding: 0;">
      `
      detailedNotes.open_questions.forEach(question => {
        html += `
          <li style="background: #f8f8f8; padding: 12px 15px; margin-bottom: 10px; border-radius: 6px; border-left: 4px solid #f39c12;">
            ${question}
          </li>
        `
      })
      html += `
          </ul>
        </div>
      `
    }

    // Parking Lot
    if (detailedNotes && detailedNotes.parking_lot && detailedNotes.parking_lot.length > 0) {
      html += `
        <div style="margin-bottom: 30px;">
          <h2 style="color: #2D2042; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #60B5E5; padding-bottom: 10px;">🅿️ Parking Lot</h2>
          <ul style="list-style: none; padding: 0;">
      `
      detailedNotes.parking_lot.forEach(item => {
        html += `
          <li style="background: #f8f8f8; padding: 12px 15px; margin-bottom: 10px; border-radius: 6px; border-left: 4px solid #95a5a6;">
            ${item}
          </li>
        `
      })
      html += `
          </ul>
        </div>
      `
    }

    // Footer
    html += `
          <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e0e0e0; text-align: center; color: #999; font-size: 14px;">
            <p style="margin: 5px 0;">Generated with Aileron Meeting Agent</p>
            <p style="margin: 5px 0;">🤖 Powered by AI • 🔒 Privacy-First</p>
          </div>
        </div>
      </div>
    `

    return html
  }

  return (
    <div className="email-preview-overlay" onClick={onClose}>
      <div className="email-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="email-preview-header">
          <h3>📧 Email Preview</h3>
          <button onClick={onClose} className="btn-close" title="Close preview">
            ✕
          </button>
        </div>

        <div className="email-preview-meta">
          <div className="email-meta-row">
            <strong>To:</strong>
            <span>
              {recipients.length === 0 ? (
                <em style={{ color: '#999' }}>No recipients selected</em>
              ) : (
                recipients.map(r => r.name).join(', ')
              )}
            </span>
          </div>
          <div className="email-meta-row">
            <strong>Subject:</strong>
            <span>{subjectLine}</span>
          </div>
        </div>

        <div className="email-preview-body">
          <div dangerouslySetInnerHTML={{ __html: generateEmailHTML() }} />
        </div>

        <div className="email-preview-actions">
          {onSend && recipients.length > 0 && (
            <button onClick={onSend} className="btn btn-primary">
              📤 Send Email
            </button>
          )}
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

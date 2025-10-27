/**
 * Email Generation Utility
 *
 * Generates HTML and plain text email bodies for meeting summaries
 * Phase 5: Email Distribution
 *
 * Extracted from EmailPreview component for reuse in send functionality
 */

import type { SpeakerMapping, ActionItem, DetailedNotes } from '../types/meetingSummary'

export interface EmailContent {
  summary: string
  speakers: SpeakerMapping[]
  actionItems: ActionItem[]
  keyDecisions: string[]
  detailedNotes: DetailedNotes | null
}

/**
 * Generate HTML email body with Aileron branding
 */
export function generateEmailHTML(content: EmailContent): string {
  // Aileron logo as base64 data URI (1KB PNG)
  const aileronLogoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAA51JREFUeNrsWc1vElEQf6XEpl4kYtWYJt3+AY1w60VL/TpYE+DglY+zB+DoqXLwKvTgwVMX07PFRE8mluqlBxuoPTSxiS6JMTFas1VD1daPGZwldLOwbz9YnoZJXnZT3qO/387Mb2YWxgY2sIF1syFRgCQev4vBJQkrBEuBtQqreH/ujOopEQAS4dimADDF4GwKLosG+2uwZnnI+F0iIcFlhWOrDCttcHaxw370TkF/xsh8LjkkxbsPgAd0f4uZnOHxtGtEkhb26oEHTPZLnhCh3JAsHMno88Zkf80rjyQt7g9RXmhWhtUtmRd6ToTiPWXjaMsrpEizHcjI8LnshUdibpwDsBg+k7BysPK0UHbTvF845NAjVZJIOxYHoGW36pjfAQnJAQmtRpRJLLrVoDwQvtXL0MqI1Gv5+pAf4hChBk/6HzwS5eyrVGGJWKgdeSp2wnqEJzdq1K6XRCbCo1YLVOgqHL2U90Qs1I72kPLEK/4eeEPWTXSY9PN2Ae5uViempAtaQTwLa4PuK5vK04pdIjz5UTcYexW7cn1sKlwHwK3KDqQkGrYycI+TZRw+r/kthBVv7Zh34gEzA9AKeVkGIqiey9hwWsmRKBPPFG3C9HF6w+7c0TMDbwToxYRsRbVigpHAHKm2FV7uZM8I5AXMvyxJfBpyRuUi4sLc4RaBbNsDzQGBIndBRFV4/+TRcr8I/Nj5yF7fu4Mi84Y8gV4I60l09AjFIB7Mn7p8LeA1gU9rz9nO2jP2dXurNUkiFqwX3JUdSBRI0uLhu0sRjtqB73MnnYLf3Vhn6st1uL5gP/cabHj0KDs+fZ4Fp8/lH2Qvmo66fh0JVIISMMe3GSzMVzvKDuI+tnnzRvT3/n4TPNro+ASCb5JAMpZ7LepnFC3+LNSOBQvgI9ReRDUBOfi8y44Ex7Sn3yTitGmc0TTZxtxhBFpTuxm66vsvbPgejl9PsLHIlYKb3S8CKgCAHHWVXHMHhUiIcklqA64XiRqBX6XOtan/4chSxO02PkdKtQLg1O3i7QC6fCR4orXhoNFge2/rzXuMabjH7rPTDzQKtdyH2u2ezyP0hHJAIn/y0tzi8MhI7MurLdDyD4YHf33/phDgjbZQUbtJpKeDFRJKxP+6+/TVrmfTNMqK+TqI5g6zIqiIRKJTi8Lze0eJCWY+g7mDR3ZloYlwFsBKp9ohEpF/MqwOqRbNHSrJqOu9VRcz+58KG9jA+md/BBgAghtDH9U4XqYAAAAASUVORK5CYII='

  let html = `
    <div style="font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; color: #333;">
      <!-- Header with Aileron Logo (Table-based for email client compatibility) -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #2D2042; border-radius: 8px 8px 0 0;">
        <tr>
          <td style="padding: 30px; text-align: center;">
            <img src="${aileronLogoBase64}" alt="Aileron" width="50" height="50" style="display: block; margin: 0 auto 15px auto;" />
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Meeting Summary</h1>
          </td>
        </tr>
      </table>

      <!-- Content -->
      <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
  `

  // Summary
  html += `
    <div style="margin-bottom: 30px;">
      <h2 style="color: #2D2042; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #60B5E5; padding-bottom: 10px;">📄 Summary</h2>
      <p style="line-height: 1.6; color: #555;">${content.summary.replace(/\n/g, '<br>')}</p>
    </div>
  `

  // Speaker Identification (filter out Unknown speakers - typically the recording announcement)
  const knownSpeakers = content.speakers.filter(s => !s.name.toLowerCase().includes('unknown'))
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
  if (content.actionItems.length > 0) {
    html += `
      <div style="margin-bottom: 30px;">
        <h2 style="color: #2D2042; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #60B5E5; padding-bottom: 10px;">✅ Action Items (${content.actionItems.length})</h2>
        <div style="display: grid; gap: 15px;">
    `
    content.actionItems.forEach((item, i) => {
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
  if (content.keyDecisions.length > 0) {
    html += `
      <div style="margin-bottom: 30px;">
        <h2 style="color: #2D2042; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #60B5E5; padding-bottom: 10px;">🎯 Key Decisions (${content.keyDecisions.length})</h2>
        <ul style="list-style: none; padding: 0;">
    `
    content.keyDecisions.forEach(decision => {
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
  if (content.detailedNotes && content.detailedNotes.discussion_by_topic && content.detailedNotes.discussion_by_topic.length > 0) {
    html += `
      <div style="margin-bottom: 30px;">
        <h2 style="color: #2D2042; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #60B5E5; padding-bottom: 10px;">💬 Discussion by Topic</h2>
    `
    content.detailedNotes.discussion_by_topic.forEach((topic, index) => {
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
  if (content.detailedNotes && content.detailedNotes.notable_quotes && content.detailedNotes.notable_quotes.length > 0) {
    html += `
      <div style="margin-bottom: 30px;">
        <h2 style="color: #2D2042; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #60B5E5; padding-bottom: 10px;">💭 Notable Quotes</h2>
    `
    content.detailedNotes.notable_quotes.forEach(quote => {
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
  if (content.detailedNotes && content.detailedNotes.open_questions && content.detailedNotes.open_questions.length > 0) {
    html += `
      <div style="margin-bottom: 30px;">
        <h2 style="color: #2D2042; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #60B5E5; padding-bottom: 10px;">❓ Open Questions</h2>
        <ul style="list-style: none; padding: 0;">
    `
    content.detailedNotes.open_questions.forEach(question => {
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
  if (content.detailedNotes && content.detailedNotes.parking_lot && content.detailedNotes.parking_lot.length > 0) {
    html += `
      <div style="margin-bottom: 30px;">
        <h2 style="color: #2D2042; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #60B5E5; padding-bottom: 10px;">🅿️ Parking Lot</h2>
        <ul style="list-style: none; padding: 0;">
    `
    content.detailedNotes.parking_lot.forEach(item => {
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

/**
 * Generate plain text email body (fallback for clients that don't support HTML)
 */
export function generatePlainTextEmail(content: EmailContent): string {
  let text = 'MEETING SUMMARY\n'
  text += '='.repeat(50) + '\n\n'

  // Summary
  text += '📄 SUMMARY\n'
  text += '-'.repeat(50) + '\n'
  text += content.summary + '\n\n'

  // Participants
  const knownSpeakers = content.speakers.filter(s => !s.name.toLowerCase().includes('unknown'))
  if (knownSpeakers.length > 0) {
    text += `👥 PARTICIPANTS (${knownSpeakers.length})\n`
    text += '-'.repeat(50) + '\n'
    knownSpeakers.forEach(speaker => {
      text += `• ${speaker.name}`
      if (speaker.email) {
        text += ` (${speaker.email})`
      }
      text += '\n'
    })
    text += '\n'
  }

  // Action Items
  if (content.actionItems.length > 0) {
    text += `✅ ACTION ITEMS (${content.actionItems.length})\n`
    text += '-'.repeat(50) + '\n'
    content.actionItems.forEach((item, index) => {
      text += `${index + 1}. [${item.priority.toUpperCase()}] ${item.description}\n`
      if (item.assignee) {
        text += `   Assignee: ${item.assignee}\n`
      }
      if (item.dueDate) {
        text += `   Due: ${new Date(item.dueDate).toLocaleDateString()}\n`
      }
    })
    text += '\n'
  }

  // Key Decisions
  if (content.keyDecisions.length > 0) {
    text += `🎯 KEY DECISIONS (${content.keyDecisions.length})\n`
    text += '-'.repeat(50) + '\n'
    content.keyDecisions.forEach((decision, index) => {
      text += `${index + 1}. ${decision}\n`
    })
    text += '\n'
  }

  // Discussion by Topic
  if (content.detailedNotes && content.detailedNotes.discussion_by_topic && content.detailedNotes.discussion_by_topic.length > 0) {
    text += '💬 DISCUSSION BY TOPIC\n'
    text += '-'.repeat(50) + '\n'
    content.detailedNotes.discussion_by_topic.forEach((topic, index) => {
      text += `\n${topic.topic}\n`
      text += '~'.repeat(topic.topic.length) + '\n'

      if (topic.key_points.length > 0) {
        text += '\nKey Points:\n'
        topic.key_points.forEach(point => {
          text += `  • ${point}\n`
        })
      }

      if (topic.decisions.length > 0) {
        text += '\nDecisions:\n'
        topic.decisions.forEach(decision => {
          text += `  • ${decision}\n`
        })
      }

      if (topic.action_items.length > 0) {
        text += '\nAction Items:\n'
        topic.action_items.forEach(item => {
          text += `  • ${item.description}`
          if (item.assignee) text += ` (${item.assignee})`
          if (item.priority) text += ` [${item.priority.toUpperCase()}]`
          text += '\n'
        })
      }

      text += '\n'
    })
  }

  // Notable Quotes
  if (content.detailedNotes && content.detailedNotes.notable_quotes && content.detailedNotes.notable_quotes.length > 0) {
    text += '💭 NOTABLE QUOTES\n'
    text += '-'.repeat(50) + '\n'
    content.detailedNotes.notable_quotes.forEach(quote => {
      text += `"${quote.quote}"\n`
      text += `— ${quote.speaker}\n\n`
    })
  }

  // Open Questions
  if (content.detailedNotes && content.detailedNotes.open_questions && content.detailedNotes.open_questions.length > 0) {
    text += '❓ OPEN QUESTIONS\n'
    text += '-'.repeat(50) + '\n'
    content.detailedNotes.open_questions.forEach((question, index) => {
      text += `${index + 1}. ${question}\n`
    })
    text += '\n'
  }

  // Parking Lot
  if (content.detailedNotes && content.detailedNotes.parking_lot && content.detailedNotes.parking_lot.length > 0) {
    text += '🅿️ PARKING LOT\n'
    text += '-'.repeat(50) + '\n'
    content.detailedNotes.parking_lot.forEach((item, index) => {
      text += `${index + 1}. ${item}\n`
    })
    text += '\n'
  }

  // Footer
  text += '-'.repeat(50) + '\n'
  text += 'Generated with Aileron Meeting Agent\n'
  text += '🤖 Powered by AI • 🔒 Privacy-First\n'

  return text
}

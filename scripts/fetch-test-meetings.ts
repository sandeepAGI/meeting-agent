/**
 * Fetch Test Meetings Script
 *
 * Fetches real meetings from Microsoft Graph API to use as test data
 * for validating keyword extraction and email search functionality.
 *
 * Usage:
 *   npx ts-node scripts/fetch-test-meetings.ts
 *
 * Output:
 *   tests/fixtures/real-meetings.json
 */

import { Client } from '@microsoft/microsoft-graph-client'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import * as msal from '@azure/msal-node'

interface MeetingData {
  id: string
  subject: string
  startTime: string
  endTime: string
  organizer: {
    name: string
    email: string
  }
  attendees: Array<{
    name: string
    email: string
    type: string
  }>
  location?: string
  isOnlineMeeting: boolean
}

interface TestMeetingsOutput {
  fetchedAt: string
  totalMeetings: number
  categories: {
    technical: MeetingData[]
    business: MeetingData[]
    generic: MeetingData[]
    edgeCases: MeetingData[]
  }
}

async function getGraphClient(): Promise<Client> {
  // Load environment variables
  const clientId = process.env.AZURE_CLIENT_ID
  const tenantId = process.env.AZURE_TENANT_ID || 'common'

  if (!clientId) {
    throw new Error('AZURE_CLIENT_ID not configured in .env')
  }

  // Use device code flow for CLI auth
  const msalConfig = {
    auth: {
      clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`
    }
  }

  const pca = new msal.PublicClientApplication(msalConfig)

  const deviceCodeRequest = {
    scopes: ['User.Read', 'Calendars.Read'],
    deviceCodeCallback: (response: any) => {
      console.log(response.message)
    }
  }

  try {
    const response = await pca.acquireTokenByDeviceCode(deviceCodeRequest)

    return Client.init({
      authProvider: (done) => {
        done(null, response!.accessToken)
      }
    })
  } catch (error) {
    console.error('Authentication failed:', error)
    throw error
  }
}

function categorizeMeeting(subject: string): keyof TestMeetingsOutput['categories'] {
  const lower = subject.toLowerCase()

  // Technical keywords
  const technicalTerms = [
    'api', 'database', 'architecture', 'code', 'deployment', 'bug',
    'frontend', 'backend', 'devops', 'ci/cd', 'testing', 'qa',
    'infrastructure', 'migration', 'refactor', 'design', 'technical'
  ]

  // Business keywords
  const businessTerms = [
    'budget', 'planning', 'strategy', 'roadmap', 'okr', 'quarterly',
    'revenue', 'forecast', 'business', 'finance', 'sales', 'marketing',
    'product', 'launch', 'metrics', 'kpi', 'review'
  ]

  // Generic/social keywords
  const genericTerms = [
    'sync', 'catch', 'chat', 'coffee', 'lunch', 'team', 'standup',
    '1:1', '1-1', 'weekly', 'daily', 'monthly', 'check-in', 'touchbase'
  ]

  // Check for matches
  const hasTechnical = technicalTerms.some(term => lower.includes(term))
  const hasBusiness = businessTerms.some(term => lower.includes(term))
  const hasGeneric = genericTerms.some(term => lower.includes(term))

  // Edge cases: very short, only stop words, or unusual
  if (subject.length < 5 || !subject.trim() || /^(re:|fwd:)/i.test(subject)) {
    return 'edgeCases'
  }

  // Prioritize categorization
  if (hasTechnical) return 'technical'
  if (hasBusiness) return 'business'
  if (hasGeneric) return 'generic'

  return 'edgeCases'
}

async function fetchMeetings(graphClient: Client, daysBack: number = 30): Promise<MeetingData[]> {
  const startDateTime = new Date()
  startDateTime.setDate(startDateTime.getDate() - daysBack)

  const endDateTime = new Date()

  console.log(`Fetching meetings from ${startDateTime.toISOString()} to ${endDateTime.toISOString()}`)

  try {
    const response = await graphClient
      .api('/me/calendarview')
      .query({
        startDateTime: startDateTime.toISOString(),
        endDateTime: endDateTime.toISOString()
      })
      .select('id,subject,start,end,organizer,attendees,location,isOnlineMeeting')
      .orderby('start/dateTime desc')
      .top(100)
      .get()

    const meetings: MeetingData[] = response.value.map((event: any) => ({
      id: event.id,
      subject: event.subject || '(No subject)',
      startTime: event.start.dateTime,
      endTime: event.end.dateTime,
      organizer: {
        name: event.organizer?.emailAddress?.name || 'Unknown',
        email: event.organizer?.emailAddress?.address || ''
      },
      attendees: (event.attendees || []).map((a: any) => ({
        name: a.emailAddress?.name || 'Unknown',
        email: a.emailAddress?.address || '',
        type: a.type || 'required'
      })),
      location: event.location?.displayName,
      isOnlineMeeting: event.isOnlineMeeting || false
    }))

    console.log(`Fetched ${meetings.length} meetings`)
    return meetings
  } catch (error) {
    console.error('Failed to fetch meetings:', error)
    throw error
  }
}

function categorizeMeetings(meetings: MeetingData[]): TestMeetingsOutput['categories'] {
  const categories: TestMeetingsOutput['categories'] = {
    technical: [],
    business: [],
    generic: [],
    edgeCases: []
  }

  for (const meeting of meetings) {
    const category = categorizeMeeting(meeting.subject)
    categories[category].push(meeting)
  }

  return categories
}

async function main() {
  console.log('=== Fetch Test Meetings ===\n')

  // 1. Authenticate and get Graph client
  console.log('Step 1: Authenticating with Microsoft Graph...')
  const graphClient = await getGraphClient()
  console.log('✅ Authenticated\n')

  // 2. Fetch meetings
  console.log('Step 2: Fetching meetings from calendar...')
  const meetings = await fetchMeetings(graphClient, 30)
  console.log(`✅ Fetched ${meetings.length} meetings\n`)

  // 3. Categorize meetings
  console.log('Step 3: Categorizing meetings...')
  const categories = categorizeMeetings(meetings)
  console.log(`✅ Categorized:
  - Technical: ${categories.technical.length}
  - Business: ${categories.business.length}
  - Generic: ${categories.generic.length}
  - Edge Cases: ${categories.edgeCases.length}\n`)

  // 4. Create output
  const output: TestMeetingsOutput = {
    fetchedAt: new Date().toISOString(),
    totalMeetings: meetings.length,
    categories
  }

  // 5. Save to file
  console.log('Step 4: Saving to tests/fixtures/real-meetings.json...')
  const fixturesDir = join(__dirname, '..', 'tests', 'fixtures')
  mkdirSync(fixturesDir, { recursive: true })

  const outputPath = join(fixturesDir, 'real-meetings.json')
  writeFileSync(outputPath, JSON.stringify(output, null, 2))
  console.log(`✅ Saved to ${outputPath}\n`)

  // 6. Print summary
  console.log('=== Summary ===')
  console.log(`Total Meetings: ${meetings.length}`)
  console.log('\nSample Titles by Category:')

  console.log('\nTechnical:')
  categories.technical.slice(0, 5).forEach(m => console.log(`  - ${m.subject}`))

  console.log('\nBusiness:')
  categories.business.slice(0, 5).forEach(m => console.log(`  - ${m.subject}`))

  console.log('\nGeneric:')
  categories.generic.slice(0, 5).forEach(m => console.log(`  - ${m.subject}`))

  console.log('\nEdge Cases:')
  categories.edgeCases.slice(0, 5).forEach(m => console.log(`  - ${m.subject}`))

  console.log('\n✅ Done! Use this data for testing keyword extraction.')
}

// Run
main().catch(error => {
  console.error('Error:', error)
  process.exit(1)
})

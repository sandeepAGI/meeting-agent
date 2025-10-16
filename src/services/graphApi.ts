/**
 * Microsoft Graph API Service
 *
 * Handles calendar and meeting operations using Microsoft Graph API.
 *
 * Features:
 * - Fetch today's calendar events
 * - Extract meeting attendees and metadata
 * - Filter for online meetings only
 *
 * Architecture:
 * - Uses @microsoft/microsoft-graph-client for API calls
 * - Requires valid access token from M365AuthService
 * - Returns structured meeting data with attendees
 */

import { Client } from '@microsoft/microsoft-graph-client'
import { Event, Attendee } from '@microsoft/microsoft-graph-types'

export interface MeetingAttendee {
  name: string
  email: string
  type: 'required' | 'optional' | 'organizer'
}

export interface MeetingInfo {
  id: string
  subject: string
  start: Date
  end: Date
  organizer: {
    name: string
    email: string
  }
  attendees: MeetingAttendee[]
  isOnlineMeeting: boolean
  onlineMeetingUrl?: string
  location?: string
}

/**
 * GraphApiService
 *
 * Provides methods to interact with Microsoft Graph API for calendar operations.
 */
export class GraphApiService {
  private client: Client | null = null

  /**
   * Initialize Graph API client with access token
   */
  initialize(accessToken: string): void {
    this.client = Client.init({
      authProvider: (done) => {
        done(null, accessToken)
      }
    })
  }

  /**
   * Fetch today's calendar events
   */
  async getTodaysMeetings(): Promise<MeetingInfo[]> {
    if (!this.client) {
      throw new Error('Graph API client not initialized. Call initialize() first.')
    }

    // Get start and end of today in LOCAL timezone
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    try {
      // Fetch calendar events using calendar view API
      // Calendar view automatically expands recurring events and handles timezones better
      const response = await this.client
        .api('/me/calendarview')
        .query({
          startDateTime: startOfDay.toISOString(),
          endDateTime: endOfDay.toISOString()
        })
        .select([
          'id',
          'subject',
          'start',
          'end',
          'organizer',
          'attendees',
          'isOnlineMeeting',
          'onlineMeetingUrl',
          'onlineMeeting',
          'location'
        ])
        .orderby('start/dateTime')
        .top(50)
        .get()

      const events: Event[] = response.value || []

      // Transform Graph API events to MeetingInfo
      const meetings: MeetingInfo[] = events.map((event) => this.transformEvent(event))

      return meetings
    } catch (error) {
      console.error('[GraphAPI] Failed to fetch calendar events:', error)
      throw new Error(`Failed to fetch calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Fetch a specific calendar event by ID
   */
  async getMeetingById(eventId: string): Promise<MeetingInfo | null> {
    if (!this.client) {
      throw new Error('Graph API client not initialized.')
    }

    try {
      const event: Event = await this.client
        .api(`/me/calendar/events/${eventId}`)
        .select([
          'id',
          'subject',
          'start',
          'end',
          'organizer',
          'attendees',
          'isOnlineMeeting',
          'onlineMeetingUrl',
          'onlineMeeting',
          'location'
        ])
        .get()

      return this.transformEvent(event)
    } catch (error) {
      console.error(`[GraphAPI] Failed to fetch event ${eventId}:`, error)
      return null
    }
  }

  /**
   * Transform Graph API Event to MeetingInfo
   */
  private transformEvent(event: Event): MeetingInfo {
    // Parse start and end times
    // Graph API returns dateTime in UTC format without 'Z' suffix
    // We need to append 'Z' to ensure JavaScript treats it as UTC
    const start = event.start?.dateTime
      ? new Date(event.start.dateTime + 'Z')
      : new Date()
    const end = event.end?.dateTime
      ? new Date(event.end.dateTime + 'Z')
      : new Date(start.getTime() + 3600000) // Default 1 hour

    // Extract organizer
    const organizer = {
      name: event.organizer?.emailAddress?.name || 'Unknown',
      email: event.organizer?.emailAddress?.address || ''
    }

    // Extract attendees
    const attendees: MeetingAttendee[] = (event.attendees || [])
      .map((attendee: Attendee) => {
        // Determine attendee type
        let type: 'required' | 'optional' | 'organizer' = 'required'
        const attendeeType = attendee.type
        if (attendeeType === 'optional') {
          type = 'optional'
        } else if (attendeeType === 'resource') {
          type = 'organizer'
        }

        return {
          name: attendee.emailAddress?.name || 'Unknown',
          email: attendee.emailAddress?.address || '',
          type
        }
      })
      .filter((attendee: MeetingAttendee) => attendee.email !== '') // Remove invalid entries

    // Check if this is an online meeting
    const isOnlineMeeting = event.isOnlineMeeting || false
    const onlineMeetingUrl = event.onlineMeetingUrl || event.onlineMeeting?.joinUrl || undefined

    // Extract location
    const location = event.location?.displayName ?? undefined

    return {
      id: event.id || '',
      subject: event.subject || 'No Subject',
      start,
      end,
      organizer,
      attendees,
      isOnlineMeeting,
      onlineMeetingUrl,
      location
    }
  }

  /**
   * Get upcoming meetings (starting within next 15 minutes)
   */
  async getUpcomingMeetings(minutesAhead: number = 15): Promise<MeetingInfo[]> {
    if (!this.client) {
      throw new Error('Graph API client not initialized.')
    }

    const now = new Date()
    const futureTime = new Date(now.getTime() + minutesAhead * 60000)

    try {
      const response = await this.client
        .api('/me/calendar/events')
        .select([
          'id',
          'subject',
          'start',
          'end',
          'organizer',
          'attendees',
          'isOnlineMeeting',
          'onlineMeetingUrl',
          'onlineMeeting',
          'location'
        ])
        .filter(
          `start/dateTime ge '${now.toISOString()}' and start/dateTime le '${futureTime.toISOString()}'`
        )
        .orderby('start/dateTime')
        .top(10)
        .get()

      const events: Event[] = response.value || []
      return events.map((event) => this.transformEvent(event))
    } catch (error) {
      console.error('[GraphAPI] Failed to fetch upcoming meetings:', error)
      throw new Error('Failed to fetch upcoming meetings')
    }
  }

  /**
   * Get the initialized Graph API client (for EmailContextService)
   */
  getClient(): Client | null {
    return this.client
  }

  /**
   * Fetch calendar events for a specific date range
   */
  async getMeetingsByDateRange(startDate: Date, endDate: Date): Promise<MeetingInfo[]> {
    if (!this.client) {
      throw new Error('Graph API client not initialized. Call initialize() first.')
    }

    try {
      const response = await this.client
        .api('/me/calendarview')
        .query({
          startDateTime: startDate.toISOString(),
          endDateTime: endDate.toISOString()
        })
        .select([
          'id',
          'subject',
          'start',
          'end',
          'organizer',
          'attendees',
          'isOnlineMeeting',
          'onlineMeetingUrl',
          'onlineMeeting',
          'location'
        ])
        .orderby('start/dateTime')
        .top(50)
        .get()

      const events: Event[] = response.value || []
      const meetings: MeetingInfo[] = events.map((event) => this.transformEvent(event))

      return meetings
    } catch (error) {
      console.error('[GraphAPI] Failed to fetch calendar events:', error)
      throw new Error(`Failed to fetch calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}

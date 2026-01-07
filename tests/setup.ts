/**
 * Jest setup file for React Testing Library
 */

import '@testing-library/jest-dom'
import React from 'react'

// Make React available globally for JSX
;(global as any).React = React

// Mock window.electronAPI for tests
global.window = {
  electronAPI: {
    updateMeetingSubject: jest.fn(),
    updateMeetingDateTime: jest.fn(),
    deleteMeetingAttendee: jest.fn(),
    getMeetingById: jest.fn(),
    database: {
      getMeetingById: jest.fn()
    }
  }
} as any

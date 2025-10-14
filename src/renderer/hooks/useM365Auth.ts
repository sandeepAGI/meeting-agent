/**
 * React hook for Microsoft 365 authentication
 *
 * Provides authentication state and actions for M365 login/logout.
 */

import { useState, useEffect } from 'react'

export interface M365AuthState {
  isAuthenticated: boolean
  user: {
    name: string
    email: string
    id: string
  } | null
  error: string | null
  isLoading: boolean
}

export function useM365Auth() {
  const [state, setState] = useState<M365AuthState>({
    isAuthenticated: false,
    user: null,
    error: null,
    isLoading: true
  })

  // Initialize auth state on mount
  useEffect(() => {
    async function initAuth() {
      try {
        const result = await window.electronAPI.m365Auth.getState()

        if (result.success && result.authState) {
          setState({
            isAuthenticated: result.authState.isAuthenticated,
            user: result.authState.user,
            error: null,
            isLoading: false
          })
        } else {
          setState(prev => ({
            ...prev,
            error: result.error || null,
            isLoading: false
          }))
        }
      } catch (error) {
        console.error('[useM365Auth] Init failed:', error)
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to initialize auth',
          isLoading: false
        }))
      }
    }

    initAuth()
  }, [])

  // Login action
  const login = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await window.electronAPI.m365Auth.login()

      if (result.success && result.authState) {
        setState({
          isAuthenticated: result.authState.isAuthenticated,
          user: result.authState.user,
          error: null,
          isLoading: false
        })
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || 'Login failed',
          isLoading: false
        }))
      }
    } catch (error) {
      console.error('[useM365Auth] Login failed:', error)
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false
      }))
    }
  }

  // Logout action
  const logout = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await window.electronAPI.m365Auth.logout()

      if (result.success && result.authState) {
        setState({
          isAuthenticated: result.authState.isAuthenticated,
          user: result.authState.user,
          error: null,
          isLoading: false
        })
      } else {
        setState(prev => ({
          ...prev,
          error: result.error || 'Logout failed',
          isLoading: false
        }))
      }
    } catch (error) {
      console.error('[useM365Auth] Logout failed:', error)
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Logout failed',
        isLoading: false
      }))
    }
  }

  return {
    state,
    actions: {
      login,
      logout
    }
  }
}

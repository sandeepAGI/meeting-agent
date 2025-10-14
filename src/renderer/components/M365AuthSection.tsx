/**
 * M365 Authentication Section Component
 *
 * Displays authentication status and provides login/logout functionality.
 */

import { useM365Auth } from '../hooks/useM365Auth'

export function M365AuthSection() {
  const { state, actions } = useM365Auth()

  if (state.isLoading) {
    return (
      <div className="m365-auth-section">
        <h3>Microsoft 365 Authentication</h3>
        <p className="auth-loading">Checking authentication status...</p>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="m365-auth-section">
        <h3>Microsoft 365 Authentication</h3>
        <div className="error-message">{state.error}</div>
        <p className="auth-hint">
          Make sure AZURE_CLIENT_ID and AZURE_TENANT_ID are set in your .env file.
        </p>
      </div>
    )
  }

  return (
    <div className="m365-auth-section">
      <h3>Microsoft 365 Authentication</h3>

      {state.isAuthenticated && state.user ? (
        <div className="auth-status authenticated">
          <div className="user-info">
            <div className="user-avatar">{state.user.name.charAt(0).toUpperCase()}</div>
            <div className="user-details">
              <p className="user-name">{state.user.name}</p>
              <p className="user-email">{state.user.email}</p>
            </div>
          </div>

          <button
            className="auth-button logout-button"
            onClick={actions.logout}
            disabled={state.isLoading}
          >
            {state.isLoading ? 'Logging out...' : 'Sign Out'}
          </button>
        </div>
      ) : (
        <div className="auth-status unauthenticated">
          <p className="auth-description">
            Sign in with your Microsoft 365 account to access calendar and email features.
          </p>

          <button
            className="auth-button login-button"
            onClick={actions.login}
            disabled={state.isLoading}
          >
            {state.isLoading ? 'Signing in...' : 'Sign in with Microsoft 365'}
          </button>

          <p className="auth-permissions">
            <strong>Permissions requested:</strong>
            <br />
            • Read your profile
            <br />
            • Read calendar events
            <br />
            • Send emails
          </p>
        </div>
      )}
    </div>
  )
}

# Changelog

All notable changes to Meeting Agent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - Phase 7 Part 2: Gmail Integration (In Progress)

#### [0.6.5.0] - 2026-01-08

##### Added
- **GmailApiService** (Task 2.2): Complete Gmail API email sending implementation
  - RFC 2822 compliant MIME message construction
  - Base64url encoding for Gmail API compatibility
  - Support for To, CC, and BCC recipients
  - HTML email content type
  - Email data validation (format, required fields)
  - Gmail API integration for sending emails
  - Comprehensive error handling with detailed logging
- **GoogleAuthService** (Task 2.1): Complete Google OAuth2 authentication implementation
  - OAuth2 client initialization with Google Cloud credentials
  - Authorization URL generation for user consent flow
  - Authorization code exchange for access/refresh tokens
  - Token storage in macOS Keychain for secure persistence
  - Automatic token refresh when expired
  - Authentication status checking
  - Logout functionality with keychain cleanup
  - Comprehensive error handling and logging throughout
- New dependencies: `googleapis` (Google API client), `keytar` (keychain storage)
- Unit tests: `google-auth.test.ts` with 20 test cases (TDD approach)
- TypeScript interfaces: `GoogleTokens`, `GoogleCredentials`

##### Technical Details
- Uses `googleapis` library for OAuth2 flow
- Stores tokens securely in macOS Keychain via `keytar`
- Supports offline access with refresh token persistence
- Scopes: `gmail.send` (sending emails via Gmail API)
- Auto-refresh expired tokens before API calls
- All methods include comprehensive error handling with context
- Detailed logging for debugging authentication flow

## [0.6.4.0] - 2026-01-08

### Added - Phase 7 Part 1: Storage Management

##### Added
- **Storage Usage Dashboard** (Task 1.5): Added visual storage dashboard in Settings > Storage tab
  - Real-time display of audio storage usage with progress bar and quota visualization
  - Transcript and summary counts with oldest item age tracking
  - Manual "Run Cleanup Now" button for immediate retention policy enforcement
  - Color-coded progress bar (green < 70%, orange 70-90%, red > 90%)
  - Displays current retention policy settings for transcripts and summaries
- New IPC handlers for storage management:
  - `storage-get-usage`: Retrieves current storage statistics
  - `storage-run-cleanup-now`: Triggers immediate cleanup of old data
- Type definitions for storage API in `electron.d.ts`
- Preload bridge methods for storage operations
- Comprehensive CSS styling for storage dashboard with responsive grid layout

##### Technical Details
- Leverages existing database methods from Tasks 1.1-1.4 (job scheduler, retention cleanup, quota enforcement)
- Protected against division-by-zero errors in progress bar calculations
- Proper React hooks usage with ESLint directives for safe dependencies
- Error handling for failed storage operations
- Loading states and user feedback for cleanup operations

## [0.6.3.0] - 2026-01-07

### Changed - Phase 6 Completion
- All Phase 6 batches (2-6) completed and wired
- All 28 settings now functional throughout application
- 2 critical bugs fixed using TDD approach

## [0.6.2.5] - 2025-12-04

### Added - Phase 6 Batch 1
- Settings panel UI with 6 tabs
- Keychain integration for API keys
- Settings persistence to JSON file

---

## Version History Summary

- **0.6.4.0** (Current): Phase 7 Task 1.5 - Storage Dashboard
- **0.6.3.0**: Phase 6 Complete - All settings wired
- **0.6.2.5**: Phase 6 Batch 1 - Settings infrastructure
- **0.1.0**: Initial release with core functionality

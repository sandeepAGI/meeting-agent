# Gmail Integration Setup Guide

This guide walks you through setting up Gmail as your email provider in Meeting Agent.

---

## Prerequisites

- A Google account (personal Gmail or Google Workspace)
- Access to [Google Cloud Console](https://console.cloud.google.com)
- Meeting Agent version 0.6.5.0 or later

---

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the project dropdown at the top of the page
3. Click **"New Project"**
4. Enter a project name (e.g., "Meeting Agent")
5. Click **"Create"**
6. Wait for the project to be created (usually takes a few seconds)

---

## Step 2: Enable Gmail API

1. In the Google Cloud Console, ensure your new project is selected
2. Click the **hamburger menu** (☰) → **"APIs & Services"** → **"Library"**
3. Search for **"Gmail API"**
4. Click on **"Gmail API"** in the results
5. Click **"Enable"**
6. Wait for the API to be enabled

---

## Step 3: Configure OAuth Consent Screen

1. Click the **hamburger menu** (☰) → **"APIs & Services"** → **"OAuth consent screen"**
2. Select **"External"** user type (unless you have a Google Workspace account)
3. Click **"Create"**

### App Information:
- **App name**: Meeting Agent
- **User support email**: Your email address
- **Developer contact email**: Your email address
- Click **"Save and Continue"**

### Scopes:
- Click **"Add or Remove Scopes"**
- Search for **"Gmail API"**
- Select: **`https://www.googleapis.com/auth/gmail.send`** (Send email on your behalf)
- Click **"Update"**
- Click **"Save and Continue"**

### Test Users (Important!):
- Click **"Add Users"**
- Add your Gmail address (the one you'll use to send emails)
- Click **"Add"**
- Click **"Save and Continue"**

### Summary:
- Review your settings
- Click **"Back to Dashboard"**

---

## Step 4: Create OAuth2 Credentials

1. Click the **hamburger menu** (☰) → **"APIs & Services"** → **"Credentials"**
2. Click **"+ Create Credentials"** at the top
3. Select **"OAuth client ID"**
4. Application type: Select **"Desktop app"**
5. Name: Enter **"Meeting Agent Desktop"**
6. Click **"Create"**

### Download Credentials:
- A dialog will appear with your Client ID and Client Secret
- Click **"Download JSON"**
- Save the file to a secure location on your Mac
- Rename the file to something recognizable like `meeting-agent-gmail-credentials.json`
- **IMPORTANT**: Keep this file secure - it contains your OAuth2 credentials

---

## Step 5: Configure Meeting Agent

1. Open **Meeting Agent**
2. Click the **Settings** icon (⚙️)
3. Navigate to the **Email** tab (📧 icon)
4. In the **Email Provider** dropdown, select **"Gmail (Google API)"**
5. In the **Google Credentials Path** field, enter the **absolute path** to your downloaded credentials file
   - Example: `/Users/yourusername/Documents/meeting-agent-gmail-credentials.json`
   - **Tip**: You can drag the file from Finder into Terminal to get the path, then copy it
6. The settings will auto-save

---

## Step 6: First-Time Authentication

**Note**: The first time you send an email using Gmail, you'll need to authenticate.

### Authentication Flow:
1. Try to send a meeting summary email
2. Meeting Agent will open your default browser
3. Sign in with your Google account (the one you added as a test user)
4. You'll see a warning: **"Google hasn't verified this app"**
   - This is expected because your app is in testing mode
   - Click **"Advanced"** → **"Go to Meeting Agent (unsafe)"**
5. Review the permissions (Gmail send permission)
6. Click **"Allow"**
7. You'll see a confirmation: **"You may close this window"**
8. Return to Meeting Agent - your email will be sent!

### Token Storage:
- Meeting Agent stores your access and refresh tokens securely in **macOS Keychain**
- You won't need to authenticate again unless you:
  - Delete the tokens from Keychain
  - Revoke access via Google Account settings
  - The refresh token expires (usually doesn't happen)

---

## Verification Checklist

✅ Google Cloud project created
✅ Gmail API enabled
✅ OAuth consent screen configured
✅ Test user added (your Gmail address)
✅ OAuth2 credentials created and downloaded
✅ Credentials file saved to secure location
✅ Meeting Agent configured with credentials path
✅ Successfully authenticated via browser
✅ Email sent successfully via Gmail

---

## Troubleshooting

### "Google credentials path not configured"
- Ensure you've entered the **absolute path** to your credentials JSON file
- The path must start with `/` (e.g., `/Users/...`)
- Verify the file exists at that location

### "Not authenticated. Please login first"
- Click the link in the error message to start authentication
- Complete the OAuth flow in your browser
- Return to Meeting Agent and try sending again

### "Access blocked: Meeting Agent has not completed the Google verification process"
- This means you didn't add yourself as a test user in Step 3
- Go back to OAuth consent screen → Test users → Add your email
- Try authenticating again

### "Invalid grant" or "Token expired"
- Your tokens may have been revoked
- Go to Settings → Email tab
- The app will prompt you to re-authenticate on next email send

### "Error 400: redirect_uri_mismatch"
- Ensure you created a **Desktop app** OAuth client (not Web application)
- If you created the wrong type, delete it and create a new Desktop app client

### "Credentials file not found"
- Verify the path is correct and the file exists
- Check file permissions (should be readable by your user)
- Try using the full absolute path

---

## Security Best Practices

1. **Keep credentials secure**:
   - Don't commit the credentials JSON file to Git
   - Don't share the credentials file with others
   - Store it in a secure location (e.g., `~/Documents` or `~/.config`)

2. **Limit scope**:
   - Meeting Agent only requests `gmail.send` permission
   - It cannot read your emails, only send on your behalf

3. **Revoke access if needed**:
   - Go to [Google Account → Security → Third-party apps](https://myaccount.google.com/permissions)
   - Find "Meeting Agent" and click "Remove Access"

4. **Rotate credentials periodically**:
   - If you suspect credentials were compromised, delete the OAuth client
   - Create a new one and update Meeting Agent

---

## Switching Back to Microsoft 365

If you want to switch back to M365:

1. Open Settings → Email tab
2. Change provider to **"Microsoft 365 (Graph API)"**
3. The credentials path field will hide
4. Meeting Agent will use your Azure credentials from the API Keys tab

---

## Advanced: Publishing Your App (Optional)

If you want to distribute Meeting Agent to others without the "unverified app" warning:

1. Complete Google's app verification process
2. This requires:
   - Privacy policy URL
   - Terms of service URL
   - App homepage URL
   - YouTube demo video
   - Security assessment (for sensitive scopes)
3. Verification can take 4-6 weeks
4. See: [Google OAuth Verification](https://support.google.com/cloud/answer/9110914)

**For personal use, verification is not required** - just add yourself as a test user.

---

## Support

- **Gmail Setup Issues**: Check [Google Cloud Console Support](https://cloud.google.com/support)
- **Meeting Agent Issues**: Open an issue at [GitHub Repository](https://github.com/yourusername/meeting-agent/issues)
- **OAuth Flow Questions**: See [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)

---

**Last Updated**: January 8, 2026
**Meeting Agent Version**: 0.6.5.0

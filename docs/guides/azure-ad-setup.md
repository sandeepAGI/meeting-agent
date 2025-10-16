# Azure AD Application Registration Guide

This guide will walk you through setting up a Microsoft Azure AD application for Meeting Agent to enable M365 authentication and Graph API access.

## Prerequisites

- Microsoft 365 account (personal or work/school)
- Access to Azure Portal (https://portal.azure.com)
- Admin consent may be required for work/school accounts (depending on tenant settings)

---

## Step 1: Register Application in Azure AD

### 1.1. Navigate to Azure Portal

1. Go to https://portal.azure.com
2. Sign in with your Microsoft account
3. Search for **"Azure Active Directory"** or **"Microsoft Entra ID"** in the search bar
4. Click on **App registrations** in the left sidebar

### 1.2. Create New Registration

1. Click **"+ New registration"** button
2. Fill in the application details:
   - **Name**: `Meeting Agent` (or your preferred name)
   - **Supported account types**:
     - Choose **"Accounts in any organizational directory and personal Microsoft accounts"** for multi-tenant support
     - OR choose **"Accounts in this organizational directory only"** for single tenant
   - **Redirect URI**: **Skip for now** (we'll add it in the next step)
3. Click **"Register"**

### 1.3. Note Your Application IDs

After registration, you'll see the application overview page. **Copy these values** - you'll need them later:

- **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Directory (tenant) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

---

## Step 2: Configure API Permissions

### 2.1. Add Microsoft Graph Permissions

1. In your app registration, click **"API permissions"** in the left sidebar
2. Click **"+ Add a permission"**
3. Select **"Microsoft Graph"**
4. Choose **"Delegated permissions"** (not Application permissions)
5. Add the following permissions:

| Permission | Purpose | Admin Consent Required |
|------------|---------|----------------------|
| `User.Read` | Read user profile | No |
| `Calendars.Read` | Read calendar events | No |
| `Calendars.ReadWrite` | Create/update calendar events | No |
| `Mail.Read` | Read emails (for email context) | No |
| `Mail.Send` | Send emails | No |
| `offline_access` | Refresh tokens | No |

6. Click **"Add permissions"**

### 2.2. Grant Admin Consent (Optional)

If you're using a work/school account and your tenant requires admin consent:

1. Click **"Grant admin consent for [Your Organization]"**
2. Confirm the action
3. Wait for all permissions to show "Granted" status

**Note**: For personal Microsoft accounts, admin consent is not required.

---

## Step 3: Configure Authentication Settings

### 3.1. Enable Public Client Flow

1. Click **"Authentication"** in the left sidebar
2. Scroll down to **"Advanced settings"**
3. Under **"Allow public client flows"**, toggle **"Enable the following mobile and desktop flows"** to **Yes**
4. Click **"Save"** at the top

### 3.2. Add Redirect URIs

MSAL Node for Electron uses a **dynamic loopback server** that automatically selects an available port. You need to add the loopback redirect URI:

1. Under **"Platform configurations"**, click **"Add a platform"**
2. Select **"Mobile and desktop applications"**
3. Check the box for **"http://localhost"** or add a custom URI:
   - `http://localhost` (recommended - MSAL will append a port dynamically)
4. Click **"Configure"**

**Why this works**: MSAL Node starts a temporary HTTP server on an available localhost port (e.g., `http://localhost:54321`) for the OAuth callback. The `http://localhost` redirect URI without a port allows any port to be used.

---

## Step 4: Configure Meeting Agent

### 4.1. Create `.env` File

In your Meeting Agent project root, create a `.env` file (or copy from `.env.example`):

```bash
# Microsoft Graph API
AZURE_CLIENT_ID=your_application_client_id_here
AZURE_TENANT_ID=your_directory_tenant_id_here

# Hugging Face (for pyannote.audio speaker diarization)
HUGGINGFACE_TOKEN=hf_xxx

# Anthropic Claude API (Phase 3)
ANTHROPIC_API_KEY=sk-ant-xxx
```

### 4.2. Add Your Azure Credentials

Replace the placeholders with the values you copied from Step 1.3:

```bash
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**For multi-tenant applications**, you can use `common` instead of the specific tenant ID:

```bash
AZURE_TENANT_ID=common
```

---

## Step 5: Test Authentication

### 5.1. Start Meeting Agent

```bash
npm run dev
```

### 5.2. Sign In

1. Click **"Initialize Audio"** to start the app
2. Scroll down to the **"Microsoft 365 Authentication"** section
3. Click **"Sign in with Microsoft 365"**
4. A browser window will open asking you to sign in
5. Enter your Microsoft account credentials
6. Review and accept the requested permissions
7. You should be redirected back to the app with a success message

### 5.3. Verify Authentication

After successful login, you should see:
- Your name and email displayed
- A "Sign Out" button
- No error messages

---

## Troubleshooting

### Error: "AADSTS7000215: Invalid client secret is provided"

**Solution**: This error occurs when using a client secret. Meeting Agent uses Public Client Flow (no client secret required). Make sure you enabled public client flow in Step 3.1.

### Error: "AADSTS50011: The reply URL does not match"

**Solution**: The redirect URI is not configured correctly in Azure AD.

1. Go to Azure AD → App registrations → Your app → Authentication
2. Under "Platform configurations", ensure you have added **"Mobile and desktop applications"** platform
3. Add `http://localhost` as a redirect URI (without a port number)
4. Make sure **"Allow public client flows"** is enabled

### Error: "AADSTS65001: The user or administrator has not consented"

**Solution**: Missing permissions or consent required.

1. Go to Azure AD → App registrations → Your app → API permissions
2. Verify all required permissions are added (Step 2.1)
3. If using work/school account, grant admin consent (Step 2.2)

### Error: "Azure credentials not configured"

**Solution**: The `.env` file is missing or not loaded correctly.

1. Verify `.env` file exists in project root
2. Check that `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` are set (no `AZURE_REDIRECT_URI` needed)
3. Restart the application (`npm run dev`)

### Error: "redirect_uri_not_supported"

**Solution**: This error occurs if you have an old version of the code that tries to set a redirect URI.

1. Make sure your code is up to date
2. MSAL Node uses a dynamic loopback server - no redirect URI should be specified in the code
3. In Azure AD, add `http://localhost` (without port) under **Mobile and desktop applications** platform

### Browser doesn't open during login

**Solution**: MSAL Node should open the browser automatically. If it doesn't:

1. Check if you have a default browser set
2. Try manually opening the URL shown in the console
3. On macOS, you may need to grant Meeting Agent permission to open URLs

---

## Security Best Practices

### 1. Keep Client ID Private

While the Client ID is not a secret (it's used in public client flows), avoid committing it to public repositories.

### 2. Use Environment Variables

Always store credentials in `.env` file, never hardcode them in source code.

### 3. Never Commit `.env`

Ensure `.env` is listed in `.gitignore`:

```bash
# .gitignore
.env
.env.local
```

### 4. Rotate Credentials Periodically

If you suspect your credentials have been compromised:

1. Go to Azure AD → App registrations → Your app
2. Delete the app registration
3. Create a new registration following this guide
4. Update your `.env` file with the new credentials

---

## Multi-Tenant vs Single-Tenant

### Single-Tenant (Recommended for Personal Use)

- **Tenant ID**: Use your specific Directory (tenant) ID
- **Users**: Only users from your organization can sign in
- **Setup**: Simpler, more secure

### Multi-Tenant (For Public Distribution)

- **Tenant ID**: Use `common`
- **Users**: Anyone with a Microsoft account can sign in
- **Setup**: Requires additional consent flow handling

**Meeting Agent default**: Single-tenant with option to use `common` for multi-tenant.

---

## Next Steps

Once authentication is set up:

1. **Phase 2.2**: Implement calendar event fetching
2. **Phase 2.3**: Implement email sending via Graph API
3. **Phase 3**: Integrate Claude API for AI summarization

---

## Additional Resources

- [Microsoft Identity Platform Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [Microsoft Graph API Reference](https://docs.microsoft.com/en-us/graph/api/overview)
- [MSAL Node Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-node)
- [Azure AD App Registration Tutorial](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)

---

**Last Updated**: 2025-10-13
**Meeting Agent Version**: 0.2.0 (Phase 2.1)

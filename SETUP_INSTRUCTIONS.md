# Setup Instructions - Get Your App Running

## Problem: Google Drive Not Working

Your `.env` file still has placeholder values that need to be replaced with real Google API credentials.

## CRITICAL INFORMATION

**Google Cloud Console Email:** SimplyLilibet@gmail.com
**Project Number:** 56819
**Organization:** None

## Quick Fix - Get Google Drive Working

### Step 1: Go to Google Cloud Console

1. Visit [console.cloud.google.com](https://console.cloud.google.com)
2. **Sign in with:** SimplyLilibet@gmail.com

### Step 2: Select Your Existing Project

1. Click the project dropdown at the top
2. Select your project (Project Number: 56819)
3. If you don't see it, make sure you're signed in with SimplyLilibet@gmail.com

### Step 3: Enable the Required APIs

1. In the left menu, go to **APIs & Services** > **Library**
2. Search for "Google Drive API" and click on it
3. Click **"Enable"**
4. Go back to Library
5. Search for "Google Picker API" and click on it
6. Click **"Enable"**

### Step 4: Create OAuth 2.0 Client ID

1. Go to **APIs & Services** > **Credentials**
2. Click **"Create Credentials"** > **"OAuth client ID"**
3. You'll be prompted to configure the consent screen first:
   - Click **"Configure Consent Screen"**
   - Choose **"External"** user type
   - Click **"Create"**

4. Fill in the OAuth consent screen:
   - **App name**: MandaStrong
   - **User support email**: Your email
   - **Developer contact email**: Your email
   - Click **"Save and Continue"**

5. On the Scopes page:
   - Click **"Add or Remove Scopes"**
   - Search for and add: `https://www.googleapis.com/auth/drive.readonly`
   - Search for and add: `https://www.googleapis.com/auth/photoslibrary.readonly`
   - Click **"Update"**
   - Click **"Save and Continue"**

6. On the Test users page:
   - Click **"Add Users"**
   - Add all three email accounts:
     - mandastrong1@gmail.com (or whatever the actual email is)
     - mandastrongfilmstudios@gmail.com
     - woolleya129@gmail.com
   - Click **"Save and Continue"**

7. Click **"Back to Dashboard"**

### Step 5: Create the OAuth Client ID

1. Go to **APIs & Services** > **Credentials** again
2. Click **"Create Credentials"** > **"OAuth client ID"**
3. Choose **"Web application"**
4. Name it "MandaStrong Web Client"
5. Under **"Authorized JavaScript origins"**, click **"Add URI"**:
   - Add: `http://localhost:5173`
   - If you have a production URL, add that too: `https://yourdomain.com`
6. Click **"Create"**
7. A popup will show your **Client ID** - **COPY THIS!**
8. Click "OK"

### Step 6: Create an API Key

1. Still in **APIs & Services** > **Credentials**
2. Click **"Create Credentials"** > **"API Key"**
3. A popup will show your **API Key** - **COPY THIS!**
4. Click **"Restrict Key"** (recommended for security):
   - Under "API restrictions", select **"Restrict key"**
   - Check:
     - **Google Drive API**
     - **Google Picker API**
   - Click **"Save"**

### Step 7: Update Your .env File

Open your `.env` file and replace the placeholder values:

```
VITE_SUPABASE_URL=https://jlvjctzacmzhonsozhvx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsdmpjdHphY216aG9uc296aHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMTMzOTAsImV4cCI6MjA4MDY4OTM5MH0.69IcZiX0mzbp9N_qAO-HKHAbyjZ_1NEhowiQPeHkuHE

VITE_GOOGLE_CLIENT_ID=paste-your-client-id-here
VITE_GOOGLE_API_KEY=paste-your-api-key-here
```

**Replace:**
- `paste-your-client-id-here` with the Client ID from Step 5
- `paste-your-api-key-here` with the API Key from Step 6

### Step 8: Restart Your App

After updating the `.env` file:
1. Stop the development server (Ctrl+C)
2. Start it again
3. Google Drive should now work!

## File Upload Limits

The app now supports uploading files up to **5GB** in size, which is suitable for large video files and media assets.

## Testing Google Drive Integration

1. Sign in to the app with one of your team emails
2. Go to Page 11 (Editor Dashboard)
3. Select "Google Drive" from the upload dropdown
4. Click "Connect Google Drive"
5. You should see a Google sign-in popup
6. Sign in and grant permissions
7. Browse and select files from your Google Drive

## Common Issues

### "Google Drive is still loading"
- Wait 5-10 seconds for the scripts to load
- Refresh the page and try again

### "Access blocked: This app's request is invalid"
- Make sure you added your email as a test user in the OAuth consent screen
- Check that your JavaScript origins match exactly (including the port number)

### "Invalid Client ID"
- Double-check that you copied the entire Client ID from Google Cloud Console
- Make sure there are no extra spaces or characters in the `.env` file

### Still not working?
- Open the browser console (F12) and look for error messages
- Check that both APIs are enabled (Drive API and Picker API)
- Verify the API key has the correct restrictions

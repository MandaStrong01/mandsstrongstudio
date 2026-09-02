# QUICK START - Fix Google Drive in 5 Minutes

## YOU NEED TO DO THIS ONLY ONCE

---

## STEP 1: Open Google Cloud Console

**Click this link:** https://console.cloud.google.com

Sign in with your Google account (any of your Gmail accounts)

---

## STEP 2: Create a Project

1. Click the **project dropdown** at the top of the page
2. Click **"New Project"**
3. Name it: **MandaStrong**
4. Click **"Create"**
5. Wait 10 seconds, then select your new project

---

## STEP 3: Enable APIs (Do This Twice)

### First API:
1. Click the **menu** (three lines at top left)
2. Go to: **APIs & Services** → **Library**
3. Search for: **Google Drive API**
4. Click on it
5. Click **"Enable"**

### Second API:
1. Click **"Library"** again (at the top)
2. Search for: **Google Picker API**
3. Click on it
4. Click **"Enable"**

---

## STEP 4: Set Up OAuth Consent Screen

1. Go to: **APIs & Services** → **OAuth consent screen**
2. Choose: **"External"**
3. Click **"Create"**

### Fill in the form:
- **App name:** MandaStrong
- **User support email:** Pick your email from dropdown
- **Developer contact email:** Type your email
- Click **"Save and Continue"**

### Add Scopes:
1. Click **"Add or Remove Scopes"**
2. Find and check these two boxes:
   - `.../auth/drive.readonly`
   - `.../auth/photoslibrary.readonly`
3. Click **"Update"**
4. Click **"Save and Continue"**

### Add Test Users:
1. Click **"Add Users"**
2. Add these emails (one per line):
   ```
   mandastrong1@gmail.com
   mandastrongfilmstudios@gmail.com
   woolleya129@gmail.com
   ```
3. Click **"Add"**
4. Click **"Save and Continue"**
5. Click **"Back to Dashboard"**

---

## STEP 5: Create Client ID

1. Go to: **APIs & Services** → **Credentials**
2. Click **"Create Credentials"** (at top)
3. Choose: **"OAuth client ID"**
4. Application type: **"Web application"**
5. Name: **MandaStrong Web Client**

### Add Authorized JavaScript origins:
1. Click **"Add URI"**
2. Type: `http://localhost:5173`
3. Click **"Add URI"** again
4. Type your production URL if you have one

6. Click **"Create"**

### IMPORTANT - Copy Your Client ID:
A popup appears with your **Client ID**

**→ COPY THE ENTIRE CLIENT ID AND SAVE IT SOMEWHERE**

It looks like: `123456789-abc123.apps.googleusercontent.com`

Click "OK"

---

## STEP 6: Create API Key

1. Still in **Credentials** page
2. Click **"Create Credentials"** (at top)
3. Choose: **"API Key"**

### IMPORTANT - Copy Your API Key:
A popup appears with your **API Key**

**→ COPY THE ENTIRE API KEY AND SAVE IT SOMEWHERE**

It looks like: `AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q`

4. Click **"Restrict Key"**
5. Under "API restrictions":
   - Select **"Restrict key"**
   - Check: **Google Drive API**
   - Check: **Google Picker API**
6. Click **"Save"**

---

## STEP 7: Update Your .env File

Open the file called `.env` in your project

You will see this:

```
VITE_SUPABASE_URL=https://jlvjctzacmzhonsozhvx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-google-api-key
```

**REPLACE THE LAST TWO LINES:**

```
VITE_GOOGLE_CLIENT_ID=PASTE-YOUR-CLIENT-ID-HERE
VITE_GOOGLE_API_KEY=PASTE-YOUR-API-KEY-HERE
```

Save the file.

---

## STEP 8: Restart Your App

1. Stop the app (press Ctrl+C in the terminal)
2. Start it again: `npm run dev`
3. Go to your app in the browser
4. Go to Page 11 (Editor Dashboard)
5. Try the Google Drive button

**IT SHOULD WORK NOW!**

---

## If It Still Doesn't Work

Check these:

1. Did you enable BOTH APIs? (Drive API and Picker API)
2. Did you add your email as a test user?
3. Did you add `http://localhost:5173` as an authorized JavaScript origin?
4. Did you copy the ENTIRE Client ID and API Key (no spaces before/after)?
5. Did you save the .env file?
6. Did you restart the app?

---

## File Upload Size

Your app now supports files up to **5GB** (5 gigabytes).

This is enough for large video files.

---

## Questions?

The detailed guide with more info is in: **GOOGLE_DRIVE_SETUP.md**

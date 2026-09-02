# START HERE - GOOGLE DRIVE FIX

## THE PROBLEM

Google Drive is greyed out because you need to add 2 codes to your `.env` file.

---

## IMPORTANT: USE THE RIGHT EMAIL

**Sign in to Google Cloud Console with:** SimplyLilibet@gmail.com
**Your Project Number is:** 56819

---

## THE SOLUTION

### PART 1: Get Your Codes from Google

1. **Go to this website:**
   ```
   https://console.cloud.google.com
   ```
   **USE EMAIL:** SimplyLilibet@gmail.com

2. **Select your existing project:**
   - You should see Project Number: 56819
   - If you don't see it, click the project dropdown and select it

3. **Turn on 2 features:**
   - Go to: APIs & Services → Library
   - Search: "Google Drive API" → Click Enable
   - Search: "Google Picker API" → Click Enable

4. **Set up permissions:**
   - Go to: APIs & Services → OAuth consent screen
   - Click: External
   - Fill in: App name (MandaStrong), your email
   - Click: Add or Remove Scopes
   - Check: drive.readonly and photoslibrary.readonly
   - Click: Add Users
   - Add emails: mandastrong1@gmail.com, mandastrongfilmstudios@gmail.com, woolleya129@gmail.com
   - Click: Save and Continue

5. **Get CODE 1 (Client ID):**
   - Go to: APIs & Services → Credentials
   - Click: Create Credentials → OAuth client ID
   - Type: Web application
   - Add URI: http://localhost:5173
   - Click: Create
   - **COPY THE CLIENT ID** (looks like: 123456789-abc.apps.googleusercontent.com)

6. **Get CODE 2 (API Key):**
   - Click: Create Credentials → API Key
   - **COPY THE API KEY** (looks like: AIzaSyABC123...)
   - Click: Restrict Key
   - Check: Google Drive API and Google Picker API
   - Click: Save

---

### PART 2: Add Codes to Your App

1. **Open the file called `.env`**

2. **Find these 2 lines:**
   ```
   VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   VITE_GOOGLE_API_KEY=your-google-api-key
   ```

3. **Replace with your real codes:**
   ```
   VITE_GOOGLE_CLIENT_ID=paste-your-client-id-here
   VITE_GOOGLE_API_KEY=paste-your-api-key-here
   ```

4. **Save the file**

5. **Restart your app:**
   - Stop it (Ctrl+C)
   - Start it again: `npm run dev`

---

## WHAT YOU GET

After this setup, ALL users can:
- Import from their own Google Photos
- Import from their own Google Drive
- Upload files up to 5GB
- Share everything with the team

Each person signs into the app with their MandaStrong email, then connects their own Google account.

---

## NEED MORE HELP?

See **QUICK_START_GUIDE.md** for detailed step-by-step instructions with screenshots descriptions.

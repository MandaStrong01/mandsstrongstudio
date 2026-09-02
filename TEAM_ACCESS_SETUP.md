# Team Access Setup - MandaStrong Studios

## Overview

Your application now has a shared team system where multiple accounts can access the same photos, videos, and files. The "MandaStrong Studios" team has been created with full access for all authorized accounts.

## Authorized Team Members

The following accounts have been granted access to the shared MandaStrong Studios team:

1. **mandastrong1** (Owner)
2. **mandastrongfilmstudios** (Admin)
3. **woolleya129@gmail.com** (Admin)

## How It Works

### Shared Access
- When any authorized team member signs in and uploads files, those files are automatically associated with the MandaStrong Studios team
- All team members can view, access, and manage files uploaded by any other team member
- Files appear in the Media Box for all team members, not just the uploader

### Upload from Anywhere
Team members can upload files from:
- **Google Photos** - Direct access to your Google Photos library
- **Google Drive** - Browse and import from Google Drive
- **Direct URL** - Import files from any web URL
- **Local Files** - Drag and drop or browse local files
- **Chromebook Integration** - Native file picker includes Google Photos

### Security
- Only authenticated team members can access shared files
- Row Level Security policies ensure data is protected
- Each account must sign in to access team resources
- Files are stored securely in Supabase storage

## Getting Started

### For Each Team Member:

1. **Sign Up or Sign In to MandaStrong**
   - Navigate to the application
   - Use one of the authorized email addresses to create an account or sign in
   - The system will automatically recognize you as a team member

2. **Connect Your Google Account** (One-time setup per person)
   - After signing in to the MandaStrong app, go to any upload page
   - Select "Google Drive" or "Google Photos" as your upload source
   - Click "Connect Google Drive" or access the file picker
   - **You'll be prompted to sign in with YOUR Google account** (can be the same email or different)
   - Grant permissions to access your Google Drive and Google Photos
   - This connects YOUR personal Google account to your MandaStrong account
   - Each team member must do this separately with their own Google account

3. **Upload Files**
   - Once connected, you can browse your own Google Photos and Google Drive
   - Choose your preferred upload method (Google Photos, Google Drive, URL, or local files)
   - Select files and import them
   - Files will automatically be shared with the entire team

4. **Access Shared Files**
   - All uploaded files appear in the Media Box for the entire team
   - You can view and manage files uploaded by any team member
   - Changes are visible to the entire team in real-time

## Team Roles

- **Owner (mandastrong1)**: Full access to all team resources and settings
- **Admin (mandastrongfilmstudios, woolleya129@gmail.com)**: Can upload, manage files, and add/remove team members
- **Member**: Can view and upload files (can be added later if needed)

## Important Notes

### Two Separate Sign-Ins Required:

1. **MandaStrong Account**: Sign in with one of the authorized team emails
   - mandastrong1
   - mandastrongfilmstudios
   - woolleya129@gmail.com

2. **Google Account** (separate): Each person connects their own Google account
   - This gives access to YOUR personal Google Photos and Google Drive
   - Each team member must authorize their own Google account
   - Google permissions are personal - you access your own Google files
   - Files you import from Google are then shared with the team

### How It Works:
- The team is already set up and ready to use
- All team members see the same uploaded files and projects
- Storage is shared across the team
- But each person accesses their OWN Google Photos/Drive through their personal Google connection

## Google Connection Setup

Each team member needs to set up Google access separately:

### Setting Up Google Drive/Photos Access:

1. **First Time Setup** (do this AFTER signing into MandaStrong):
   - Go to Page 11 (Editor Dashboard) or any upload page
   - Select "Google Drive" from the upload source dropdown
   - Click "Connect Google Drive"
   - A Google sign-in window will appear
   - Sign in with YOUR Google account (the one with your photos/files)
   - Click "Allow" to grant permissions
   - You can now browse your Google Photos and Drive files

2. **What Permissions Are Needed**:
   - Read-only access to your Google Drive
   - Read-only access to your Google Photos Library
   - The app can only READ files, not modify or delete them

3. **Privacy & Security**:
   - Each person's Google connection is private to them
   - You can only see YOUR own Google files when browsing
   - Once you import/upload files to MandaStrong, those become shared with the team
   - Your Google credentials are never stored in the database
   - The connection is secure and handled by Google's OAuth system

### All Three Accounts Must Do This:

- **mandastrong1** → connects their Google account → can import from their Google Photos/Drive
- **mandastrongfilmstudios** → connects their Google account → can import from their Google Photos/Drive
- **woolleya129@gmail.com** → connects their Google account → can import from their Google Photos/Drive

## Support

If you encounter any issues:
1. Verify you're signed in to MandaStrong with one of the authorized email addresses
2. Make sure you've completed the Google connection setup (separate step)
3. Check that you granted all required permissions when connecting Google
4. Check that your internet connection is stable
5. Refresh the page if files don't appear immediately
6. Check the browser console for any error messages
7. See GOOGLE_DRIVE_SETUP.md for detailed Google API setup instructions

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const gapi: any;
declare const google: any;

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/photoslibrary.readonly';

let tokenClient: any;
let accessToken: string | null = null;
let pickerInited = false;
let gisInited = false;

export async function initializeGoogleDrive(): Promise<boolean> {
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'your-google-client-id.apps.googleusercontent.com') {
    return false;
  }

  return new Promise((resolve) => {
    const script1 = document.createElement('script');
    script1.src = 'https://apis.google.com/js/api.js';
    script1.async = true;
    script1.defer = true;
    script1.onload = () => {
      try {
        gapi.load('picker', () => {
          pickerInited = true;
          if (gisInited) resolve(true);
        });
      } catch (error) {
        console.error('Google Picker initialization failed:', error);
        resolve(false);
      }
    };
    script1.onerror = () => {
      console.error('Failed to load Google API script');
      resolve(false);
    };
    document.head.appendChild(script1);

    const script2 = document.createElement('script');
    script2.src = 'https://accounts.google.com/gsi/client';
    script2.async = true;
    script2.defer = true;
    script2.onload = () => {
      try {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: SCOPES,
          callback: '',
        });
        gisInited = true;
        if (pickerInited) resolve(true);
      } catch (error) {
        console.error('Google Identity Services initialization failed:', error);
        resolve(false);
      }
    };
    script2.onerror = () => {
      console.error('Failed to load Google Identity Services script');
      resolve(false);
    };
    document.head.appendChild(script2);
  });
}

export function openGooglePicker(callback: (files: any[]) => void) {
  if (!pickerInited || !gisInited) {
    alert('Google Drive is not available. Please use the regular upload feature.');
    return;
  }

  try {
    tokenClient.callback = async (response: any) => {
      if (response.error !== undefined) {
        console.error('Google auth error:', response.error);
        alert('Failed to authenticate with Google Drive. Please try again.');
        return;
      }
      accessToken = response.access_token;
      createPicker(callback);
    };

    if (accessToken === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      tokenClient.requestAccessToken({ prompt: '' });
    }
  } catch (error) {
    console.error('Error opening Google Picker:', error);
    alert('Failed to open Google Drive. Please use the regular upload feature.');
  }
}

function createPicker(callback: (files: any[]) => void) {
  const photosView = new google.picker.DocsView(google.picker.ViewId.PHOTOS)
    .setIncludeFolders(true);

  const imagesView = new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES_AND_VIDEOS)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(false);

  const docsView = new google.picker.DocsView(google.picker.ViewId.DOCS)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(false);

  const picker = new google.picker.PickerBuilder()
    .enableFeature(google.picker.Feature.NAV_HIDDEN)
    .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
    .setAppId(GOOGLE_CLIENT_ID)
    .setOAuthToken(accessToken!)
    .addView(photosView)
    .addView(imagesView)
    .addView(docsView)
    .setDeveloperKey(GOOGLE_API_KEY)
    .setCallback((data: any) => {
      if (data.action === google.picker.Action.PICKED) {
        callback(data.docs);
      }
    })
    .build();

  picker.setVisible(true);
}

export async function downloadGoogleDriveFile(fileId: string, _fileName: string, _mimeType: string): Promise<Blob> {
  if (!accessToken) {
    throw new Error('Not authenticated with Google Drive');
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to download file from Google Drive');
  }

  return await response.blob();
}

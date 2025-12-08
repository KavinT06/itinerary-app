# Gemini API Key Setup Guide

## Problem
Your current Gemini API key was reported as leaked and has been disabled by Google.

## Solution: Get a New API Key

### Step 1: Go to Google AI Studio
1. Open https://aistudio.google.com/apikey
2. Click "Create API Key" button
3. Select your Google Cloud Project (or create a new one)
4. Copy the new API key

### Step 2: Update Your Local .env.local
Edit your `.env.local` file:
```
MONGODB_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_new_api_key_here
```

### Step 3: Update Vercel Environment Variables
1. Go to https://vercel.com/dashboard
2. Select your project (itinerary-app)
3. Go to Settings → Environment Variables
4. Find or create `GEMINI_API_KEY`
5. Paste your new API key
6. Make sure "Production" is selected
7. Click Save
8. Redeploy your project

### Step 4: Test
After redeploying, visit:
- `https://superitineraryapp.vercel.app/api/test` - Connection test
- Then try generating a trip

## Important Security Notes
- ❌ Never commit API keys to GitHub
- ❌ Never hardcode API keys in your source code
- ✅ Always use environment variables
- ✅ Rotate keys if they appear to be leaked

## If It Still Fails
Check the Vercel logs:
1. Go to Vercel Dashboard → Your Project
2. Click "Deployments"
3. Click the latest deployment
4. Go to "Logs" tab
5. Look for `[GEMINI]` messages

## API Key Quotas
- Free tier: 60 requests per minute
- If you exceed this, you'll get rate limit errors
- Upgrade your plan in Google Cloud Console if needed

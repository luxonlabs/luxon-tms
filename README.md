# Luxon TMS - AI-Powered Load Management

A simple TMS with AI rate confirmation parsing, built for Vercel + Supabase.

## Features

- 🤖 **AI Import**: Upload PDF rate confirmations → Auto-extract load details
- 📊 **Load Dashboard**: Track loads, revenue, and RPM
- 🔐 **Password Protection**: Simple single-user authentication
- 💾 **Cloud Database**: Supabase for persistent storage
- 🚀 **Free Hosting**: Vercel's free tier

## Quick Deploy

### 1. Set Up Supabase (5 minutes)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (any region)
3. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
4. Go to **Settings > API** and copy:
   - Project URL (e.g., `https://xxxxx.supabase.co`)
   - Anon public key (starts with `eyJ...`)

### 2. Deploy to Vercel (5 minutes)

**Option A: GitHub Deploy (Recommended)**

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) and sign up with GitHub
3. Click "Import Project" → Select your repo
4. Add Environment Variables:
   - `ANTHROPIC_API_KEY`: Your Claude API key
   - `APP_PASSWORD`: Your login password (e.g., `milian2024`)
5. Click "Deploy"

**Option B: Vercel CLI**

```bash
npm install -g vercel
cd tms-ai-parser
vercel login
vercel --prod
```

Then add env vars in Vercel dashboard.

### 3. Configure Frontend

After deploying, edit `public/index.html` and update these lines:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_KEY = 'your-anon-key';
```

Or for Vercel env vars, update the code to:

```javascript
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY;
```

### 4. Get Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up (free $5 credit)
3. Create an API key
4. Add to Vercel env vars as `ANTHROPIC_API_KEY`

## Cost Breakdown

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Vercel | $0 | Free tier (100GB bandwidth) |
| Supabase | $0 | Free tier (500MB DB) |
| Claude API | ~$1-5 | $0.036 per rate conf parsed |
| **Total** | **$1-5/mo** | Scales to ~150 loads/mo |

## Usage

1. Go to your Vercel URL (e.g., `luxon-tms.vercel.app`)
2. Enter your password
3. Click **AI Import** → Upload PDF → Load auto-fills
4. Or click **Add Load** for manual entry

## Project Structure

```
tms-ai-parser/
├── api/
│   └── parse-rateconf.js    # Serverless API for Claude parsing
├── public/
│   └── index.html           # TMS frontend (single file)
├── vercel.json              # Vercel config
├── package.json             # Dependencies
├── supabase-schema.sql      # Database schema
└── README.md                # This file
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Claude API key from console.anthropic.com | Yes |
| `APP_PASSWORD` | Login password (default: `milian2024`) | Yes |

## Demo Mode

If you don't configure Supabase, the TMS runs in "demo mode" using localStorage. Data persists in your browser but isn't synced to cloud.

## Next Steps (Phase 2)

- [ ] Add user authentication (Supabase Auth)
- [ ] Buy custom domain
- [ ] Add more status workflows
- [ ] Broker database integration
- [ ] Lane rate analytics

---

Built with ❤️ for Milian Xpress

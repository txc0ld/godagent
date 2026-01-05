# God Agent - Deployment Guide

Deploy God Agent as a hosted web application for anyone to use.

## Quick Deploy Options

### 1. Railway (Recommended - Easiest)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/godagent)

**Manual Steps:**
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub and select `txc0ld/godagent`
4. Add environment variable: `ANTHROPIC_API_KEY=your-key-here`
5. Click Deploy

Railway will automatically:
- Build the Docker image
- Deploy the application
- Provide a public URL (e.g., `godagent-production.up.railway.app`)

**Cost:** ~$5/month for starter tier

---

### 2. Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/txc0ld/godagent)

**Manual Steps:**
1. Go to [render.com](https://render.com)
2. Click "New" → "Web Service"
3. Connect GitHub and select `txc0ld/godagent`
4. Configure:
   - **Build Command:** (uses Dockerfile automatically)
   - **Environment:** Add `ANTHROPIC_API_KEY`
5. Deploy

**Cost:** Free tier available, ~$7/month for starter

---

### 3. Fly.io

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy (from project root)
fly launch --name godagent

# Set secrets
fly secrets set ANTHROPIC_API_KEY=your-key-here

# Deploy
fly deploy
```

**Cost:** Free tier available, ~$5/month for small app

---

### 4. DigitalOcean App Platform

1. Go to [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
2. Click "Create App" → "GitHub"
3. Select `txc0ld/godagent`
4. Configure:
   - **Type:** Web Service
   - **Dockerfile Path:** `./Dockerfile`
   - **Port:** 4200
5. Add environment variable: `ANTHROPIC_API_KEY`
6. Deploy

**Cost:** ~$5/month for basic

---

### 5. Self-Hosted (Docker)

```bash
# Clone the repository
git clone https://github.com/txc0ld/godagent.git
cd godagent

# Create .env file
echo "ANTHROPIC_API_KEY=your-key-here" > .env

# Build and run
docker-compose up -d

# Access at http://localhost:4200
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | **Yes** | Your Anthropic API key (get at [console.anthropic.com](https://console.anthropic.com)) |
| `PORT` | No | Server port (default: 4200) |
| `NODE_ENV` | No | Set to `production` for deployed apps |
| `EMBEDDING_API_URL` | No | Custom embedding server URL |
| `ALLOWED_ORIGIN` | No | CORS allowed origin for API |

---

## Post-Deployment

Once deployed, users can:

1. **Visit your URL** (e.g., `https://godagent.up.railway.app`)
2. **Complete the Setup Wizard** - Enter their own Anthropic API key
3. **Start using God Agent!**

### User Experience Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. User visits your hosted URL                              │
│                         ↓                                    │
│  2. Setup Wizard appears (if not configured)                 │
│     - User enters their Anthropic API key                    │
│     - Validates connection                                   │
│                         ↓                                    │
│  3. Main interface loads                                     │
│     - Chat with AI                                           │
│     - View orchestration panel                               │
│     - Create projects                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Multi-Tenant Considerations

The default deployment stores API keys **per-session** in the browser. Each user configures their own API key.

For a true multi-tenant setup where you provide the API key:

1. Set `ANTHROPIC_API_KEY` as an environment variable
2. Modify `frontend/server/index.ts` to use env var instead of user-provided key
3. Remove the setup wizard requirement

---

## Monitoring & Health

All deployments include a health check endpoint:

```
GET /api/health

Response:
{
  "status": "healthy",
  "timestamp": "2025-01-05T12:00:00.000Z",
  "version": "2.0.0",
  "environment": "production",
  "configured": true
}
```

---

## Scaling

For high traffic:

1. **Increase replicas** - Railway/Render support horizontal scaling
2. **Add caching** - Redis for session/response caching
3. **Use CDN** - Cloudflare for static assets
4. **Upgrade plan** - More CPU/RAM for faster responses

---

## Security Notes

- API keys are stored locally in the browser (localStorage)
- HTTPS is enforced on all cloud platforms
- Rate limiting is enabled (60 requests/minute)
- Input sanitization prevents injection attacks

---

## Troubleshooting

### "Connection refused" errors
- Check if `ANTHROPIC_API_KEY` is set correctly
- Verify the health endpoint: `curl https://your-app.com/api/health`

### Slow responses
- Claude API can take 5-30 seconds for complex queries
- Consider upgrading to a faster model (Claude Haiku 4.5)

### Build failures
- Ensure Node.js 22+ is available
- Check Docker build logs for specific errors

---

## Support

- **Issues:** [github.com/txc0ld/godagent/issues](https://github.com/txc0ld/godagent/issues)
- **Documentation:** [github.com/txc0ld/godagent#readme](https://github.com/txc0ld/godagent#readme)


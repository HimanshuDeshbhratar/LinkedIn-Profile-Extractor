# LinkedIn Profile API

A **MERN stack** hosted API that accepts a LinkedIn profile URL and returns structured JSON by reverse-engineering LinkedIn's internal **Voyager API** — direct HTTP calls to REST and GraphQL endpoints, **no browser automation**.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)]()
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)]()
[![MongoDB](https://img.shields.io/badge/MongoDB-Cache-47A248?logo=mongodb&logoColor=white)]()

## Live Demo

> No public deployment URL has been configured yet. Deploy using [Render](#deployment) or Railway, then add the verified HTTPS URL here.

```
GET https://your-app.onrender.com/api/profile?url=https://www.linkedin.com/in/williamhgates
```

## Features

- Accept LinkedIn profile URLs and return clean structured JSON
- Extracts: name, headline, location, about, experience, education, skills, certifications, languages, profile images
- Multi-endpoint Voyager strategy (REST dash + GraphQL + legacy profileView)
- MongoDB response caching with TTL
- React demo UI with card view and raw JSON export
- Rate limiting and optional API key protection
- HTTPS-ready deployment configs included

---

## Architecture

```
Client Request
     │
     ▼
Express API (/api/profile)
     │
     ├── MongoDB Cache (hit → return)
     │
     └── LinkedIn Voyager Client (miss)
              │
              ├── REST  /identity/dash/profiles          → resolve URN, top card
              ├── REST  /identity/profiles/{id}/profileView → experience, education
              ├── REST  /identity/profiles/{id}/skills      → skills list
              ├── REST  /identity/dash/profiles/{urn}       → full dash profile
              └── GQL   /graphql?queryId=voyagerIdentity…   → profile components
                     │
                     ▼
              Profile Parser → Clean JSON Schema
```

---

## Response Schema

```json
{
  "success": true,
  "meta": {
    "profileUrl": "https://www.linkedin.com/in/williamhgates",
    "vanityName": "williamhgates",
    "fetchedAt": "2026-08-29T08:51:00.000Z",
    "cached": false,
    "source": "linkedin-voyager-api",
    "schemaVersion": "1.0.0"
  },
  "data": {
    "identity": {
      "vanityName": "williamhgates",
      "profileUrn": "urn:li:fsd_profile:...",
      "fullName": "Bill Gates",
      "firstName": "Bill",
      "lastName": "Gates",
      "headline": "Co-chair, Bill & Melinda Gates Foundation",
      "location": { "full": "Seattle, Washington, United States", "city": "Seattle", "country": "United States" },
      "industry": "Philanthropy",
      "summary": "…",
      "profileUrl": "https://www.linkedin.com/in/williamhgates/",
      "connectionDegree": "2nd",
      "isPremium": false
    },
    "media": {
      "profilePhoto": { "primary": "https://…", "variants": [{ "url": "…", "width": 800 }] },
      "backgroundPhoto": { "primary": "https://…", "variants": [] }
    },
    "experience": [
      {
        "title": "Co-chair",
        "company": { "name": "Bill & Melinda Gates Foundation", "logo": "https://…" },
        "location": "Seattle, WA",
        "duration": { "start": "2000-01", "end": null, "isCurrent": true }
      }
    ],
    "education": [],
    "skills": [{ "name": "Leadership", "endorsements": 100 }],
    "certifications": [],
    "languages": [],
    "volunteer": [],
    "honors": [],
    "stats": { "experienceCount": 5, "educationCount": 1, "skillCount": 20, "certificationCount": 0, "languageCount": 1 }
  }
}
```

---

## API Documentation

### `GET /api/profile`

Fetch a LinkedIn profile as structured JSON.

| Parameter | Location | Required | Description |
|-----------|----------|----------|-------------|
| `url` | query | Yes | LinkedIn profile URL or vanity name |
| `refresh` | query | No | Set `true` to bypass cache |

**Example:**

```bash
curl "http://localhost:5000/api/profile?url=https://www.linkedin.com/in/williamhgates"
```

### `POST /api/profile`

```bash
curl -X POST http://localhost:5000/api/profile \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.linkedin.com/in/williamhgates"}'
```

### `GET /api/health`

Unauthenticated liveness check. It deliberately does **not** call LinkedIn, so platform probes cannot consume the configured session. Use `GET /api/health/linkedin` manually to check it.

### `GET /api/docs`

Machine-readable API documentation.

### Authentication

Set `API_KEY` in environment. It is required when `NODE_ENV=production`; pass it via header:

```bash
curl -H "X-API-Key: your-api-key" "http://localhost:5000/api/profile?url=..."
```

---

## Setup Instructions

### Prerequisites

- **Node.js 18+**
- **MongoDB** (optional — enables caching; API works without it)
- **LinkedIn account** with valid session cookies

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/linkedin-profile-api.git
cd linkedin-profile-api
npm run install:all
```

### 2. Extract LinkedIn cookies

Use the full cookie string (`LI_COOKIE`) for local testing. `li_at` and `JSESSIONID` are the required authentication values; other cookies may be needed by a particular LinkedIn session, but copying them does not make a cloud-hosted request look like the browser session.

| Cookie | Required | Purpose |
|--------|----------|---------|
| `li_at` | Yes | Session authentication token |
| `JSESSIONID` | Yes | CSRF token (must start with `ajax:`) |
| `bcookie` | **Strongly recommended** | Browser fingerprint |
| `bscookie` | **Strongly recommended** | Secure browser fingerprint |
| `lidc` | **Strongly recommended** | Datacenter/routing cookie |

**How to extract (recommended method):**

1. Log in to [linkedin.com](https://www.linkedin.com) and visit `/feed/`
2. Open DevTools → **Network** tab → filter by `voyager`
3. Click any request to `www.linkedin.com/voyager/api/...`
4. In **Request Headers**, find `cookie:` and copy the **entire value**
5. Paste it as `LI_COOKIE` in your `.env` or deployment environment variables

**Alternative (Application tab):**

1. DevTools → **Application** → **Cookies** → `https://www.linkedin.com`
2. Manually copy `li_at`, `JSESSIONID`, `bcookie`, `bscookie`, `lidc` into:
   ```env
   LI_COOKIE=li_at=...; JSESSIONID="ajax:..."; bcookie="..."; bscookie="..."; lidc="..."
   ```

> **Important:** Reusing a browser session from a cloud/datacenter IP can trigger LinkedIn account protection and sign the browser out. Stop using that cookie immediately if it happens and rotate it in LinkedIn; do not keep retrying. This project serializes requests and avoids an automatic `/me` preflight, but it cannot guarantee LinkedIn will accept a repurposed browser session.

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
LI_COOKIE=li_at=AQED...; JSESSIONID="ajax:1234..."; bcookie="v=2&..."; bscookie="v=1&..."; lidc="b=..."
MONGODB_URI=mongodb://127.0.0.1:27017/linkedin-profile-api
PORT=5000
LINKEDIN_REQUEST_DELAY_MS=1500
```

Test your cookies before fetching profiles:

```bash
curl http://localhost:5000/api/health/linkedin
```

Live authenticated requests are disabled by default. Set `LINKEDIN_ENABLE_LIVE_REQUESTS=true` only if you explicitly accept the LinkedIn account-session risk described below. This is a safety switch, not a way to bypass LinkedIn protections.

### 4. Run locally

**Terminal 1 — Backend:**
```bash
npm run dev:backend
```

**Terminal 2 — Frontend:**
```bash
npm run dev:frontend
```

Open **http://localhost:5173** for the UI, or hit the API directly at **http://localhost:5000/api/profile?url=...**

---

## Approach

This project reverse-engineers LinkedIn's **Voyager API** — the same internal REST/GraphQL layer that powers linkedin.com. Key findings:

1. **Authentication** uses session cookies (`li_at` + `JSESSIONID`), not OAuth. The CSRF token header must mirror the `JSESSIONID` cookie value (without quotes).

2. **Profile resolution** starts at the dash REST endpoint:
   ```
   GET /voyager/api/identity/dash/profiles
     ?q=memberIdentity&memberIdentity={vanity}&decorationId=WebTopCardCore-16
   ```

3. **Rich profile sections** come from multiple sources:
   - GraphQL queries (`/voyager/api/graphql?queryId=voyagerIdentityDashProfileComponents.*`)
   - Legacy `profileView` endpoint (experience, education, languages)
   - Dedicated skills endpoint with pagination

4. **Responses** use LinkedIn's normalized JSON format with an `included` array of referenced entities. The parser resolves URNs and maps `$type` fields into our clean schema.

5. **No browser** is used at runtime. Cookies are configured once via environment variables.

6. **QueryId rotation:** LinkedIn rotates GraphQL `queryId` hashes on deploys. Run `node backend/scripts/discover-query-ids.js` to find current values and update `backend/src/linkedin/constants.js`.

> **Finding:** Live testing confirmed that server-side reuse of a browser's LinkedIn session cookie is detected and penalized by LinkedIn within a small number of requests, regardless of request pacing — session invalidation occurred on the 2nd–3rd authenticated profile lookup even with 1.5s+ serialized delays. This is documented in detail under Known Limitations.

---

## Known Limitations

| Limitation | Details |
|------------|---------|
| **Session reuse risk (confirmed in testing)** | Reusing a browser's `li_at` session from a server — even fully serialized with 1.5s+ delays between requests — triggered LinkedIn's session-invalidation and account-protection systems within 2–3 profile lookups on the developer's own account during testing (redirect/302 on the first legacy `profileView` call, followed by `401` and a forced logout of the active browser session on the next). This confirms the constraint is inherent to server-side reuse of browser session cookies, not a pacing or header-configuration issue that can be tuned away. |
| **Legacy endpoint fragility** | The `identity/profiles/{id}/profileView` endpoint appears to be actively deprecated/gated by LinkedIn and can redirect even with a session that independently passes an authenticated `/me` check. The newer `identity/dash/profiles` resolution path is comparatively more stable and is used as a fallback. |
| **Cloud deployment IP mismatch** | LinkedIn may reject or flag cookies used from datacenter IPs (Render, Railway, AWS) even faster than from a residential IP, since server-origin traffic on a browser session is itself a strong automation signal regardless of network reputation. |
| **Session cookies expire** | `li_at` / `JSESSIONID` expire after weeks under normal use, and near-immediately once LinkedIn's automation detection flags the session — as observed above. Cookies must be re-extracted from an active browser session after this happens. |
| **Rate limiting** | LinkedIn may return HTTP 429 independent of the session-invalidation behavior above. Requests are serialized and the delay can be increased with `LINKEDIN_REQUEST_DELAY_MS`, though this does not prevent detection based on the origin/fingerprint mismatch itself. |
| **Recommended testing setup** | Because of the above, testing should be done against a secondary/non-primary LinkedIn account, not the developer's main account, to avoid restricting a real profile. |
| **Private profiles** | Only returns data visible to the authenticated account. |
| **GraphQL queryId drift** | Enable with `LINKEDIN_USE_GRAPHQL=true` only if needed; hashes rotate on LinkedIn deploys. |
| **Terms of Service** | Reverse-engineering may violate LinkedIn ToS. Educational use only. |
---

## Deployment

### Render (recommended)

1. Push to GitHub
2. Connect repo on [render.com](https://render.com)
3. Use the included `render.yaml` or create a **Web Service**:
   - **Build:** `npm run install:all && npm run build`
   - **Start:** `npm start`
4. Set `LI_COOKIE` (or `LI_AT` and `JSESSIONID`) and a strong `API_KEY`. `MONGODB_URI` is optional; use a managed MongoDB provider if caching is needed.
5. Render provides HTTPS automatically

### Railway

1. Connect GitHub repo on [railway.app](https://railway.app)
2. Add MongoDB plugin
3. Set env vars and deploy

### Docker (optional)

```bash
docker build -t linkedin-profile-api .
docker run -p 5000:5000 --env-file backend/.env linkedin-profile-api
```

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── index.js              # Express server
│   │   ├── routes/               # API routes
│   │   ├── linkedin/
│   │   │   ├── client.js         # Voyager HTTP client
│   │   │   ├── profileParser.js  # Response normalizer
│   │   │   ├── profileService.js # Orchestration
│   │   │   ├── constants.js      # Endpoints & queryIds
│   │   │   └── utils.js          # URL/URN helpers
│   │   ├── db/                   # MongoDB cache & logs
│   │   └── middleware/           # Auth, errors, rate limit
│   └── scripts/
│       └── discover-query-ids.js # QueryId discovery tool
├── frontend/                     # React + Vite demo UI
├── render.yaml                   # Render deployment config
└── README.md
```

---

## License

MIT — for educational purposes. Use responsibly.

## DigitallyDefined Migration Notes

### Supabase Service Role Key
The SUPABASE_SERVICE_ROLE_KEY for project dijjjlppdljpcgyoakdnq must be obtained from:
Supabase Dashboard -> Project Settings -> API -> service_role key

Set it in:
- digitallydefined-backend-clean/.env (SUPABASE_SERVICE_ROLE_KEY)
- Vercel environment variables for the deployment

### Vercel Deployment — Environment Variables
Add these env vars to the Vercel project for digitallydefined-backend-clean:

| Variable | Value |
|----------|-------|
| `OMNIROUTE_BASE_URL` | `https://ai.digitallydefined.online/v1` |
| `OMNIROUTE_API_KEY` | Your OmniRoute JWT key |
| `OMNIROUTE_MODEL` | `auto` |
| `VERTEX_PROJECT_ID` | Your GCP Vertex AI project ID |
| `VERTEX_LOCATION` | `us-central1` |
| `VERTEX_MODEL` | `gemini-1.5-flash` |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase Dashboard -> Project Settings -> API |

> **Note:** Never commit real API keys. Use Vercel dashboard environment variables or `.env` files (which are gitignored).


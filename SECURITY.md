# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| main | yes |

## Reporting a vulnerability

If you discover a security issue, please report it privately to the repository owner. Do not open a public issue with exploit details.

## Known safeguards (v2)

- `/api/firecrawl/get` accepts only `https://api.firecrawl.dev/v2/...` URLs in the `next` parameter.
- API keys are not forwarded to third-party domains by the proxy.
- CORS is limited to configured origins (`CORS_ORIGINS`).
- Browser keys are not persisted in `localStorage` by default; optional session-only storage.

## Deployment recommendations

- Run the local proxy only on `127.0.0.1`.
- Keep `FIRECRAWL_API_KEY` and `OPENAI_API_KEY` in environment variables, not in git.
- Review `logs/firecrawl_credits.log` for unexpected usage spikes.

# n8n outreach generate API

Internal endpoint for on-demand PDF generation from a listing URL. StayPacks generates STR reports, lease appraisals, and sales brochures; n8n handles SMS/email outreach.

## Endpoint

`POST /api/delivery/generate`

### Auth

`Authorization: Bearer <DELIVERY_CRON_SECRET>` or `?secret=<DELIVERY_CRON_SECRET>`

### Request

```json
{
  "tenant_slug": "havenly",
  "listing_url": "https://www.realestate.com.au/property-...",
  "deliverables": ["str", "lease_appraisal", "sales_brochure"],
  "templates": {
    "str": "refined-detailed",
    "lease_appraisal": "refined-lease-appraisal",
    "sales_brochure": "sales-brochure-refined-2pg"
  },
  "agent_profile_ids": ["uuid-of-agent-1"]
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `tenant_slug` | yes | Delivery tenant slug |
| `listing_url` | yes | REA/Domain/agency URL |
| `address` | no | Hint only; scraped address wins |
| `deliverables` | no | Default: all three types |
| `templates` | no | Per-type template overrides |
| `agent_profile_ids` | no | Max 2 agency `agent_profiles` UUIDs |
| `skip_ledger` | no | Default `true` (no cron dedupe) |

STR templates must be detailed variants (`refined-detailed`, `haven-properties-str`, etc.). Light variants are rejected.

### Response

```json
{
  "listing_id": "uuid",
  "address": "3/264 Kingsford Smith Dr, Hamilton QLD",
  "agents": [
    {
      "name": "Jane Smith",
      "email": "jane@agency.com",
      "phone": "0412345678",
      "role_title": "Sales Agent",
      "photo_url": "https://..."
    }
  ],
  "agent_source": "listing",
  "listing": {
    "hero_image_url": "https://...",
    "bedrooms": 2,
    "display_price": "$1.2M"
  },
  "artifacts": [
    {
      "type": "str",
      "pdf_url": "https://...",
      "pdf_filename": "havenly-property-str-report-....pdf",
      "public_url": "https://staypack.app/...",
      "report_id": "uuid"
    }
  ],
  "warnings": [],
  "errors": []
}
```

- `agent_source`: `profile` (override IDs), `listing` (scraped agents), or `brand` (tenant fallback)
- Partial success: `artifacts` may be non-empty while `errors` lists failed deliverables
- HTTP 502 when every deliverable fails; 200 when at least one artifact succeeds

## n8n workflow

1. HTTP Request → `POST /api/delivery/generate`
2. Use `agents[0].phone` / `agents[0].email` for recipient
3. Loop `artifacts` → download each `pdf_url` for email attachments
4. Optional SMS with `public_url` from an artifact

## Manual test

```bash
node scripts/run-outreach-generate.mjs \
  --url "https://www.realestate.com.au/property-..." \
  --tenant havenly
```

Requires `DELIVERY_CRON_SECRET` and `SITE_URL` in `.env`.

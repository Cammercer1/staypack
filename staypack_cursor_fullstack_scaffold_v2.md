# StayPack Cursor Build Brief

Build **StayPack** as a full-stack SaaS MVP for real estate agencies.

StayPack creates branded short-term rental potential reports that agents can include in sales packs, open homes and buyer follow-up.

This build must **not use n8n**. The app should handle the full flow itself:

```txt
Agency signs in
→ Adds brand/settings
→ Creates a new report from a listing URL
→ App scrapes listing data/images
→ User reviews/edits extracted property details
→ App calls Airbtics for STR estimate
→ App generates buyer-facing copy
→ User previews/edits report
→ App publishes shareable report page
→ App generates PDF with Browserless
→ Report appears in agency library
```

---

## Recommended frontend framework

Use:

```txt
Next.js App Router
TypeScript
Tailwind CSS
shadcn/ui
React Hook Form
Zod
Supabase SSR client
```

### Why Next.js

Use Next.js instead of plain Vite/React because this product needs:

```txt
Server-rendered public report pages
Protected dashboard pages
Server-side API routes for secrets
Browserless PDF rendering routes
Scraping routes
Airbtics routes
OpenAI routes
Supabase auth with cookies
Dynamic report URLs
Print-optimised report pages
```

A pure frontend app would push too much sensitive logic into the browser or force you to build a separate backend too early.

### Backend position

Use **Supabase as the backend platform**:

```txt
Supabase Auth
Supabase Postgres
Supabase Storage
Supabase Row Level Security
Supabase Realtime later if useful
```

Use **Next.js server route handlers** as the secure app server for:

```txt
Airbtics calls
OpenAI calls
Browserless calls
Scraping/parsing
PDF generation
Geocoding
Publishing reports
```

Do not call third-party APIs directly from the browser.

Later, if desired, some route handlers can move into Supabase Edge Functions. For the MVP, keep them in Next.js because scraping/parsing/PDF orchestration will be easier with Node packages.

---

## Hosting and infrastructure

Use:

```txt
Hosting: Netlify
Domain: staypack.app
DNS: Cloudflare
Database/Auth/Storage: Supabase
PDF generation: Browserless
STR data: Airbtics
AI copy: OpenAI
Geocoding: Google Maps Geocoding API or Mapbox
```

MVP URLs:

```txt
https://staypack.app
https://app.staypack.app/dashboard
https://reports.staypack.app/[agencySlug]/[reportSlug]
https://reports.staypack.app/[agencySlug]/[reportSlug]/print
```

Start with path-based tenancy:

```txt
reports.staypack.app/raywhite-sunshine-coast/abc123
```

Do **not** build wildcard agency subdomains in the MVP.

Later:

```txt
raywhite-sunshine-coast.staypack.app/reports/abc123
```

---

## Product sections

Build these main areas.

```txt
/auth
/onboarding
/dashboard
/reports
/reports/new
/reports/[id]
/settings
/settings/brand
/settings/agents
/settings/billing placeholder
```

Public report pages:

```txt
/[agencySlug]/[reportSlug]
/[agencySlug]/[reportSlug]/print
```

If using separate subdomain routing later, these same routes can sit on `reports.staypack.app`.

---

## MVP user roles

Use three roles:

```txt
owner
admin
member
```

For MVP:

```txt
owner and admin can edit agency settings
owner, admin and member can create reports
owner and admin can delete/archive reports
published reports are public if status = published
```

---

## Key app states

Reports should have statuses:

```txt
draft
scraped
estimated
generated
published
failed
archived
```

---

## Core product rules

1. Do not use n8n.
2. Use Supabase as source of truth.
3. Keep all API keys server-side.
4. Never expose Airbtics, OpenAI, Browserless, Google or Supabase service role keys to the client.
5. Always refer to STR revenue as an estimate.
6. Use “estimated gross STR revenue” or “estimated gross short-term rental revenue”.
7. Do not call revenue “profit”.
8. Do not imply guaranteed income, yield or return.
9. Show a disclaimer on every report.
10. Let users review and edit scraped data before publishing.
11. Store original data, user overrides and final report JSON.
12. Use the final report JSON for rendering published reports, so old reports remain stable.
13. Browserless is required for PDF generation and should also be used as a fallback for JS-heavy scraping.
14. Scraping should be resilient, not perfect.
15. If scraping misses data, the user can manually enter it.

---

## Main data flow

```txt
1. User creates report
2. User enters listing URL
3. App creates draft report row
4. Server scrapes listing URL
5. Server parses listing details/images
6. User reviews/edits listing details
7. Server geocodes address if needed
8. Server calls Airbtics
9. User reviews estimate and optional overrides
10. Server generates copy via OpenAI
11. User previews/edits final report
12. User publishes report
13. Server generates QR code
14. Server renders PDF via Browserless
15. Server stores PDF in Supabase Storage
16. Report appears in library
```

---

## Database schema

Create Supabase tables.

### agencies

```sql
create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  website_url text,
  email text,
  phone text,
  logo_url text,
  primary_colour text not null default '#111111',
  secondary_colour text not null default '#FFFFFF',
  accent_colour text not null default '#F4F4F5',
  font_family text not null default 'Inter',
  default_report_title text not null default 'Short-Term Rental Potential Report',
  default_cta text not null default 'Speak with the agent for the full buyer pack and property details.',
  default_disclaimer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### agency_members

```sql
create table public.agency_members (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (agency_id, user_id)
);
```

### agent_profiles

```sql
create table public.agent_profiles (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  role_title text,
  photo_url text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### scrape_jobs

```sql
create table public.scrape_jobs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  report_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  source_url text not null,
  status text not null check (status in ('pending', 'success', 'failed')),
  method text,
  parser_name text,
  raw_html_storage_path text,
  extracted_json jsonb,
  warnings text[] default '{}',
  error_message text,
  created_at timestamptz not null default now()
);
```

### reports

```sql
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  agent_profile_id uuid references public.agent_profiles(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,

  status text not null default 'draft'
    check (status in ('draft', 'scraped', 'estimated', 'generated', 'published', 'failed', 'archived')),

  listing_url text,
  property_address text,
  suburb text,
  state text,
  postcode text,
  country text default 'Australia',
  latitude numeric,
  longitude numeric,

  property_type text,
  bedrooms numeric,
  bathrooms numeric,
  car_spaces numeric,
  accommodates numeric,

  listing_title text,
  listing_description text,
  display_price text,

  hero_image_url text,
  selected_image_urls text[] default '{}',

  public_slug text,
  public_url text,
  qr_code_url text,
  pdf_url text,

  scraped_listing_json jsonb,
  raw_airbtics_json jsonb,
  original_estimate_json jsonb,
  user_overrides_json jsonb,
  final_estimate_json jsonb,
  ai_copy_json jsonb,
  final_report_json jsonb,

  error_message text,

  generated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (agency_id, public_slug)
);
```

### report_events

```sql
create table public.report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  event_type text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
```

---

## Storage buckets

Create these Supabase Storage buckets:

```txt
agency-assets
agent-assets
report-assets
report-pdfs
scrape-html
```

Usage:

```txt
agency-assets: logos
agent-assets: agent photos
report-assets: uploaded property images and QR codes
report-pdfs: generated PDFs
scrape-html: raw HTML snapshots for debugging
```

---

## RLS

Enable RLS on all tables.

Add helper functions.

```sql
create or replace function public.is_agency_member(target_agency_id uuid)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1
    from public.agency_members
    where agency_id = target_agency_id
    and user_id = auth.uid()
  );
$$;
```

```sql
create or replace function public.is_agency_admin(target_agency_id uuid)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1
    from public.agency_members
    where agency_id = target_agency_id
    and user_id = auth.uid()
    and role in ('owner', 'admin')
  );
$$;
```

Policies:

```txt
Users can select agencies they belong to.
Users can update agencies where they are owner/admin.
Users can select reports for agencies they belong to.
Users can insert reports for agencies they belong to.
Users can update reports for agencies they belong to.
Users can select agent profiles for agencies they belong to.
Owner/admin can update agent profiles.
Public report pages can read published reports only through a safe server route.
```

For public report pages, prefer fetching through a server component or route handler using service role and explicitly checking:

```txt
status = published
agency.slug = agencySlug
report.public_slug = reportSlug
```

Do not expose broad public table policies unless needed.

---

## Environment variables

Create `.env.example`:

```txt
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_REPORTS_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=

AIRBTICS_API_KEY=
AIRBTICS_BASE_URL=

BROWSERLESS_API_KEY=
BROWSERLESS_BASE_URL=

GOOGLE_MAPS_API_KEY=

QR_CODE_BASE_URL=http://localhost:3000

APP_ENV=development
```

---

## Suggested folder structure

```txt
app/
  (auth)/
    login/
    signup/
    callback/
  (app)/
    dashboard/
    onboarding/
    reports/
      page.tsx
      new/
        page.tsx
      [id]/
        page.tsx
    settings/
      page.tsx
      brand/
        page.tsx
      agents/
        page.tsx
  (public)/
    [agencySlug]/
      [reportSlug]/
        page.tsx
        print/
          page.tsx
  api/
    agencies/
    agents/
    listings/
      scrape/
        route.ts
    airbtics/
      estimate/
        route.ts
    reports/
      route.ts
      [id]/
        route.ts
        generate-copy/
          route.ts
        publish/
          route.ts
        generate-pdf/
          route.ts
        duplicate/
          route.ts

components/
  app-shell/
  forms/
  reports/
    ReportPreview.tsx
    ReportPageOne.tsx
    ReportPageTwo.tsx
    MetricCard.tsx
    AgentCard.tsx
    ReportDisclaimer.tsx
    ImageSelector.tsx
  settings/
  ui/

lib/
  supabase/
    client.ts
    server.ts
    admin.ts
  auth/
    requireUser.ts
    requireAgency.ts
  scraping/
    index.ts
    fetchStaticHtml.ts
    fetchRenderedHtml.ts
    parsers/
      openGraph.ts
      jsonLd.ts
      rayWhite.ts
      generic.ts
  airbtics/
    client.ts
    normalise.ts
  browserless/
    pdf.ts
    renderedHtml.ts
  openai/
    generateReportCopy.ts
  reports/
    buildFinalReportJson.ts
    formatters.ts
    slugs.ts
    qr.ts
  validation/
    schemas.ts
```

---

## UI pages

### `/onboarding`

Purpose: create first agency profile.

Fields:

```txt
Agency name
Agency slug
Website
Main email
Main phone
Logo upload
Primary colour
Secondary colour
Accent colour
Default report title
Default CTA
Default disclaimer
```

After submit:

```txt
Create agency
Create agency_members row with current user as owner
Redirect to dashboard
```

---

### `/dashboard`

Default app page.

Show:

```txt
Create new report button
Recent reports
Draft/generated/published counts
Quick links to settings and library
```

Primary CTA:

```txt
Create new report
```

---

### `/reports`

Report library.

Columns/cards:

```txt
Property address
Suburb/state
Hero image thumbnail
Status
Estimated annual STR revenue
Created date
Published date
Agent
Actions
```

Actions:

```txt
Open
Copy public link
Download PDF
Duplicate
Archive
```

Filters:

```txt
Status
Agent
Suburb
Date range
```

---

### `/reports/new`

Step-based wizard.

#### Step 1: Enter listing URL

Fields:

```txt
Listing URL
Optional address
Optional beds/baths/cars
```

CTA:

```txt
Scrape listing
```

Call:

```txt
POST /api/listings/scrape
```

Create draft report early so every action has a report ID.

---

#### Step 2: Review scraped listing

Show editable fields:

```txt
Address
Suburb
State
Postcode
Property type
Bedrooms
Bathrooms
Car spaces
Accommodates
Title
Short description
Full description
Display price
Rental appraisal min/max
Agent name
Agent email
Agent phone
Office name
```

Show image selector:

```txt
Hero image
Supporting images
Upload fallback images
```

CTA:

```txt
Save and estimate STR
```

---

#### Step 3: STR estimate

Call:

```txt
POST /api/airbtics/estimate
```

Show returned metrics:

```txt
Annual revenue
Monthly revenue
Weekly revenue
Average nightly rate
Occupancy
Booked nights
Comparable radius
```

Allow overrides:

```txt
Use Airbtics estimate
Manually adjust estimate
```

Save:

```txt
original_estimate_json
user_overrides_json
final_estimate_json
raw_airbtics_json
```

CTA:

```txt
Generate report copy
```

---

#### Step 4: Generate copy

Call:

```txt
POST /api/reports/[id]/generate-copy
```

Show generated fields and allow editing:

```txt
Heading
Blurb
Key metrics line
Property appeal points
Supporting factors
Buyer checks
Methodology note
Disclaimer
Confidence notes internal only
```

CTA:

```txt
Preview report
```

---

#### Step 5: Preview and publish

Show exact report preview.

Buttons:

```txt
Save draft
Generate PDF preview
Publish report
```

On publish:

```txt
POST /api/reports/[id]/publish
```

Then:

```txt
POST /api/reports/[id]/generate-pdf
```

Return:

```txt
Public report URL
PDF URL
```

---

### `/settings/brand`

Agency branding settings.

Fields:

```txt
Agency name
Slug
Website
Phone
Email
Logo
Primary colour
Secondary colour
Accent colour
Font
Default report title
Default CTA
Default disclaimer
```

Preview card showing report header style.

---

### `/settings/agents`

Agent profiles.

Fields:

```txt
Name
Role title
Email
Phone
Photo
Default agent toggle
```

Reports can be assigned to an agent profile.

---

## API routes

### `POST /api/listings/scrape`

Input:

```json
{
  "report_id": "uuid",
  "listing_url": "https://example.com/property"
}
```

Behaviour:

```txt
1. Require authenticated user.
2. Check user can access report agency.
3. Try static HTML fetch.
4. Parse with available parsers.
5. If insufficient data, use Browserless rendered HTML fallback.
6. Parse again.
7. Save scrape job.
8. Update report.scraped_listing_json.
9. Update report status to scraped if successful.
10. Return extracted listing data and warnings.
```

Output:

```json
{
  "scrape_job_id": "uuid",
  "method": "static_fetch|browserless_rendered",
  "parser_name": "open_graph|json_ld|ray_white|generic",
  "listing": {
    "title": "",
    "address": "",
    "suburb": "",
    "state": "",
    "postcode": "",
    "property_type": "",
    "bedrooms": 2,
    "bathrooms": 1,
    "car_spaces": 1,
    "description": "",
    "display_price": "",
    "images": [],
    "agents": []
  },
  "warnings": []
}
```

---

### `POST /api/airbtics/estimate`

Input:

```json
{
  "report_id": "uuid",
  "address": "",
  "latitude": null,
  "longitude": null,
  "bedrooms": 2,
  "bathrooms": 1,
  "accommodates": 4
}
```

Behaviour:

```txt
1. Require authenticated user.
2. Check report access.
3. Geocode address if lat/lng missing.
4. Call Airbtics server-side.
5. Normalise response.
6. Calculate monthly, weekly and booked nights.
7. Save raw and normalised data.
8. Update status to estimated.
```

Output:

```json
{
  "annual_revenue": 72000,
  "monthly_revenue": 6000,
  "weekly_revenue": 1385,
  "nightly_rate": 285,
  "occupancy_rate": 69,
  "booked_nights": 252,
  "radius_m": 500,
  "raw": {}
}
```

---

### `POST /api/reports/[id]/generate-copy`

Input: report ID.

Behaviour:

```txt
1. Require authenticated user.
2. Check report access.
3. Load agency, agent, scraped listing, final estimate.
4. Build strict OpenAI prompt.
5. Request valid JSON only.
6. Validate with Zod.
7. Save ai_copy_json.
8. Build final_report_json.
9. Update status to generated.
```

Output shape:

```json
{
  "sales_pack_heading": "",
  "sales_pack_blurb": "",
  "key_metrics_line": "",
  "property_appeal_points": [],
  "performance_supporting_factors": [],
  "buyer_checks": [],
  "methodology_note": "",
  "disclaimer": "",
  "confidence_notes": ""
}
```

---

### `POST /api/reports/[id]/publish`

Behaviour:

```txt
1. Require authenticated user.
2. Check report access.
3. Ensure final_report_json exists.
4. Generate public slug if missing.
5. Generate public URL.
6. Generate QR code PNG/SVG.
7. Store QR code in Supabase Storage.
8. Set status to published.
9. Set published_at.
```

---

### `POST /api/reports/[id]/generate-pdf`

Behaviour:

```txt
1. Require authenticated user.
2. Check report access.
3. Build print URL:
   `${REPORTS_URL}/${agencySlug}/${reportSlug}/print`
4. Call Browserless PDF API.
5. Use A4 format.
6. Use printBackground true.
7. Use preferCSSPageSize true.
8. Save PDF bytes to `report-pdfs`.
9. Update `reports.pdf_url`.
10. Return PDF URL.
```

---

## Scraping implementation

Create parser pipeline:

```txt
parseListing(html, url)
```

It should try parsers in order:

```txt
1. JSON-LD parser
2. Ray White embedded JSON parser
3. OpenGraph/meta parser
4. Generic text parser
```

Return:

```ts
type ParsedListing = {
  title?: string;
  address?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  carSpaces?: number;
  description?: string;
  displayPrice?: string;
  images: string[];
  agents: {
    name?: string;
    email?: string;
    phone?: string;
  }[];
  rentalAppraisal?: {
    weeklyMin?: number;
    weeklyMax?: number;
    weeklyMidpoint?: number;
  };
  outgoings?: {
    bodyCorporateWeekly?: number;
    councilRatesQuarterly?: number;
    waterRatesQuarterly?: number;
  };
  confidence: "low" | "medium" | "high";
  warnings: string[];
};
```

### Static fetch

Use normal fetch with reasonable headers:

```txt
User-Agent: browser-like
Accept-Language: en-AU,en;q=0.9
```

Do not hammer sites. Use a timeout.

### Browserless fallback

Use Browserless if:

```txt
Static fetch fails
HTML is too small
No title/description/images found
Known JS-heavy site
```

Create:

```txt
lib/browserless/renderedHtml.ts
```

It should:

```txt
Call Browserless content API or function API
Return rendered HTML
Timeout safely
Log errors
```

### Manual override is essential

Scraping will be imperfect. The UX must assume the user reviews and fixes data before report generation.

---

## Airbtics implementation

Create:

```txt
lib/airbtics/client.ts
lib/airbtics/normalise.ts
```

Input:

```txt
latitude
longitude
bedrooms
bathrooms
accommodates
```

Normalised output:

```ts
type StrEstimate = {
  annualRevenue: number | null;
  monthlyRevenue: number | null;
  weeklyRevenue: number | null;
  nightlyRate: number | null;
  occupancyRate: number | null;
  bookedNights: number | null;
  radiusM: number | null;
  raw: unknown;
};
```

Default accommodates:

```txt
If user enters accommodates, use that.
Else bedrooms * 2.
Minimum 2.
Maximum 10 for MVP.
```

---

## OpenAI report copy prompt

Create:

```txt
lib/openai/generateReportCopy.ts
```

System prompt:

```txt
You are a real estate sales pack copywriter for Australian property agents.

Write clear, useful, buyer-facing copy for a short-term rental potential report.

Rules:
- Use Australian English.
- Be commercially useful but conservative.
- Do not use hype.
- Do not guarantee income.
- Do not call revenue profit.
- Use "estimated gross short-term rental revenue".
- Do not invent amenities, distances, approvals, regulations, tax treatment or returns.
- Use only the supplied property data.
- Do not mention Airbtics.
- Do not mention OpenAI.
- If long-term rental data is available, compare carefully before costs.
- If long-term rental data is missing, do not mention uplift.
- Output valid JSON only.
```

Expected JSON:

```json
{
  "sales_pack_heading": "",
  "sales_pack_blurb": "",
  "key_metrics_line": "",
  "property_appeal_points": [],
  "performance_supporting_factors": [],
  "buyer_checks": [],
  "methodology_note": "",
  "disclaimer": "",
  "confidence_notes": ""
}
```

Validate output with Zod. If validation fails, retry once with a repair prompt.

---

## Final report JSON

Create:

```txt
lib/reports/buildFinalReportJson.ts
```

Final JSON shape:

```json
{
  "version": "standard_2_page_v1",
  "generated_at": "",
  "agency": {
    "name": "",
    "logo_url": "",
    "primary_colour": "",
    "secondary_colour": "",
    "accent_colour": "",
    "website_url": "",
    "phone": "",
    "email": ""
  },
  "agent": {
    "name": "",
    "role_title": "",
    "phone": "",
    "email": "",
    "photo_url": ""
  },
  "property": {
    "address": "",
    "suburb": "",
    "state": "",
    "postcode": "",
    "summary": "",
    "property_type": "",
    "bedrooms": 2,
    "bathrooms": 1,
    "car_spaces": 1,
    "accommodates": 4,
    "listing_url": "",
    "hero_image_url": "",
    "selected_image_urls": []
  },
  "str": {
    "annual_revenue": 72000,
    "monthly_revenue": 6000,
    "weekly_revenue": 1385,
    "nightly_rate": 285,
    "occupancy_rate": 69,
    "booked_nights": 252,
    "radius_m": 500
  },
  "ltr": {
    "weekly_min": null,
    "weekly_max": null,
    "weekly_midpoint": null,
    "annual_midpoint": null,
    "difference_before_costs": null
  },
  "copy": {
    "heading": "",
    "blurb": "",
    "key_metrics_line": "",
    "appeal_points": [],
    "supporting_factors": [],
    "buyer_checks": [],
    "methodology_note": "",
    "disclaimer": "",
    "cta": ""
  },
  "assets": {
    "qr_code_url": "",
    "pdf_url": ""
  }
}
```

Render reports from this JSON.

---

## Report design

Build a polished two-page A4 report.

### Page 1: Buyer-facing snapshot

Content:

```txt
Agency logo
Report title
Generated date
Hero image
Property address
Property summary
Main annual estimated gross STR revenue
Metric cards:
  Annual revenue
  Monthly revenue
  Average nightly rate
  Occupancy
Buyer-facing blurb
Key appeal points
Agent card
QR code
Short disclaimer
```

### Page 2: Context and assumptions

Content:

```txt
STR vs LTR comparison if LTR appraisal exists
Performance breakdown:
  Average nightly rate
  Occupancy
  Booked nights
  Estimated gross revenue
Factors that may support performance
Things buyers should check
Methodology note
Full disclaimer
Agent CTA
```

### Print CSS

```css
@page {
  size: A4;
  margin: 0;
}

html,
body {
  width: 210mm;
  margin: 0;
  padding: 0;
  background: #f4f4f5;
}

.report-page {
  width: 210mm;
  height: 297mm;
  page-break-after: always;
  overflow: hidden;
  background: #ffffff;
}

@media print {
  body {
    background: #ffffff;
  }

  .no-print {
    display: none !important;
  }
}
```

For screen preview, centre the pages on a neutral background.

---

## Browserless PDF

Create:

```txt
lib/browserless/pdf.ts
```

Expected PDF options:

```json
{
  "options": {
    "format": "A4",
    "printBackground": true,
    "preferCSSPageSize": true,
    "margin": {
      "top": "0px",
      "right": "0px",
      "bottom": "0px",
      "left": "0px"
    }
  }
}
```

The route should call Browserless server-side only.

Do not use client-side `window.print()` for final PDFs.

---

## Components to build first

```txt
AgencyLogoUploader
BrandColourPicker
AgentProfileForm
ReportWizard
ListingUrlStep
ScrapedListingReviewStep
ImageSelector
StrEstimateStep
GeneratedCopyEditor
ReportPreview
ReportPageOne
ReportPageTwo
MetricCard
AgentCard
ReportLibrary
StatusBadge
CopyLinkButton
DownloadPdfButton
```

---

## Install packages

Use these packages unless there is a better reason not to.

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install zod react-hook-form @hookform/resolvers
npm install cheerio
npm install qrcode
npm install slugify
npm install date-fns
npm install clsx tailwind-merge
npm install lucide-react
npm install openai
```

For shadcn/ui:

```bash
npx shadcn@latest init
```

Add common components:

```bash
npx shadcn@latest add button card input label textarea select tabs table badge dialog dropdown-menu toast separator
```

---

## First build milestone

Build this first, before polishing.

```txt
1. Supabase auth works.
2. User can create agency in onboarding.
3. User can edit brand settings.
4. User can create a draft report.
5. User can paste listing URL.
6. App can scrape at least basic meta data and images.
7. User can review/edit property details.
8. App can save report.
9. Report library shows saved report.
10. Public report page renders from final_report_json.
```

---

## Second milestone

```txt
1. Airbtics estimate route works.
2. User can review/override estimate.
3. OpenAI copy generation works.
4. Two-page report preview renders.
5. Publish flow creates public URL.
6. QR code is generated and stored.
```

---

## Third milestone

```txt
1. Browserless PDF route works.
2. PDF is stored in Supabase Storage.
3. Report library has Download PDF button.
4. Public report page has clean share link.
5. Print route produces consistent A4 output.
```

---

## Acceptance criteria

The MVP is acceptable when:

```txt
A new agency can sign up.
The agency can add logo, colours and contact details.
The agency can create a report from a listing URL.
The app scrapes usable listing data or allows manual fallback.
The app calls Airbtics server-side.
The app generates conservative report copy.
The user can edit the generated copy.
The report renders as a branded two-page A4 design.
The report can be published as a public share link.
The PDF can be generated via Browserless.
The PDF is saved and downloadable.
The report appears in the library.
No API secrets are exposed client-side.
```

---

## What not to build yet

Do not build these in the first pass:

```txt
Stripe billing
Wildcard agency subdomains
Custom agency domains
Complex team permissions
Franchise hierarchy
Advanced analytics
Email sending
CRM integrations
Portal-specific deep scrapers for every site
AI chat interface
Mobile app
```

---

## Notes on compliance wording

Every report must include language similar to:

```txt
Estimate only. Actual performance may vary based on seasonality, furnishing, photography, pricing strategy, guest reviews, management quality, platform fees, cleaning, utilities, maintenance, insurance, local council requirements, strata or body corporate rules and market conditions. This report is not financial, legal or tax advice. Buyers should make their own enquiries before making an investment decision.
```

Short label near main metric:

```txt
Estimated gross STR revenue before costs.
```

Do not say:

```txt
Guaranteed income
Profit
Return
Passive income
Lucrative
Unlock
Proven
```

---

## Cursor instruction

Start by scaffolding the Next.js app with TypeScript, Tailwind and shadcn/ui.

Then create the Supabase schema SQL file, environment example, folder structure, auth helpers, agency onboarding flow, settings pages and report library.

After the basic app shell works, implement the report creation wizard and scraping route.

Keep code clean, typed and modular. Prioritise a working vertical slice over perfect design.

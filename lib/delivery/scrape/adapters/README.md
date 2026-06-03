# Partner discovery adapters

| ID | When to use |
|----|-------------|
| `generic_links` | Default — extracts Domain/REA/etc. links from partner index pages |
| `spfn_first_national_v1` | `surfersparadisefn.com.au` residential search (static fetch, `/buy-residential-real-estate/` slugs) |

Register new adapters in `index.ts`. Tenant config:

```json
{
  "adapter": "spfn_first_national_v1",
  "config": { "fetchMethod": "static_fetch", "maxPages": 2 }
}
```

Auto-infer helper: `inferPartnerAdapter(url)` (optional when creating tenants).

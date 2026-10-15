# Agency proposal designs

These files are reviewed onboarding configurations for `digital_proposal_assignments.defaults`.
The database row is the live source of truth; editing a JSON file alone does not update an account.
Validate with `assignmentSchema` before saving and increment the assignment version when revising a saved design.

`havenly.json` is assigned to Havenly Property (`55e0a778-9604-4725-975f-657cb83b17e2`).
Its Manrope font, blue `#009eca`, white background, charcoal `#212121` and square controls come from
https://www.havenlyproperty.com.au/ (reviewed 12 October 2026). Supporting blue and neutral tones are
adapted for proposal charts; dark button text keeps the bright blue readable.
The digital font is self-hosted in `public/fonts`, with its SIL Open Font License alongside it.

Design assignments affect new appraisals and editable previews. `applyAssignment` owns the cover title, subtitle, recipient line and comparison heading through
`defaults.content`. It preserves selected agents, page order/visibility, documents and links while
applying the account design and page definitions.
Published proposals retain the brand and data in their version snapshot until republished.

## Havenly management service (design version 2)

The service page is enabled between comparable listings and Next steps. Its copy, image and
experience statement live in the assignment and are frozen into each publication. No account
agents are added by this page. The blank legacy service placeholder becomes this configured page;
subsequent choices to hide it are preserved.

Source notes, reviewed 12 October 2026 (copy is adapted, not quoted):

- [Manage with us](https://www.havenlyproperty.com.au/pages/real-estate/manage-with-us): tailored short-, long- and hybrid-leasing strategies; bedroom photography.
- [About us](https://www.havenlyproperty.com.au/pages/real-estate/about-us): Gold Coast and Brisbane team, marketing, compliance and guest experience.
- [Guest experience](https://www.havenlyproperty.com.au/pages/real-estate/blog/17668/guest-experience-the-secret-to-stronger-short-term-rental-performance): bookings, turnovers, cleaning, maintenance, communication and thoughtful arrivals.
- [Shannyn Laird](https://www.havenlyproperty.com.au/pages/real-estate/agent/28576/shannyn-laird): **founder** has more than 15 years of property experience and held senior roles at an international short-term rental company; this is not Havenly's trading history.

The service renderer must be deployed before the version 2 assignment is used on another
environment. No database schema change is needed.

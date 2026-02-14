# Rebranding Design: SafeTasks -> Produzo

**Date:** 2026-02-14
**Status:** Approved

## Brand Identity

- **Name:** Produzo
- **Tagline:** Production OS
- **Full positioning:** "Produzo -- Production OS"
- **Version indicator:** Dropped (no more V3)

## Why Produzo

- "Eu produzo" = "I produce" in Portuguese -- empowering, action-oriented
- Works across languages (Portuguese, Spanish, Italian, English)
- No existing competitors with this name (verified via web search)
- Connects to Brazilian roots while feeling international
- Short (3 syllables), easy to spell, easy to say
- "Produzo -- Production OS" flows naturally

## Competitive Landscape (Verified)

### Brazilian Competitors
- ProFilme.NET (30+ years, budget/financial control)
- Sistema Jobb (video production management)
- 2Movie by Foconet (budget management, Netflix/Amazon templates)
- Esferas Software (production company management)

### International Competitors
- Yamdu (Germany, production management)
- StudioBinder (USA, production management leader)
- Celtx (Canada, pre-production/scriptwriting)
- Wrapbook (USA, production payroll/accounting)
- Dramatify (Sweden, call sheets/dashboards)
- Entertainment Partners (USA, enterprise)

### Names Checked and Rejected (38 total)
FilmFlow (taken - French tool), Slate (MovieSlate/GreenSlate), Clapper (taken), CineSync (Academy Award-winning tool), Lumeo (funded startup), Takeo (taken), SetFlow (taken), Cue (CueDB conflict), Prodeo (multiple companies), Framekit (5+ products), Scenera (funded company), Kinetic (saturated), Wrapt (content platform), Setly (Swedish company), Motio (BI company), Stagehand (Browserbase SDK), Rollio (enterprise AI), Lumen (Fortune 500), Capta (multiple companies), Prodly (VC-backed), Shootr (multiple apps), Filmhub (a16z-backed), Axion (saturated), Patchwork (saturated), Flixy (streaming devices), Filmo (AV rental software), Prodiq (multiple companies), Crewvo (fitness app), and others.

## Scope of Changes

### Frontend Files (~20 files)

1. `frontend/components/layout/Header.tsx` - Dashboard header logo text
2. `frontend/lib/seo.ts` - SITE_NAME constant, all page SEO titles/descriptions
3. `frontend/lib/structured-data.ts` - JSON-LD schema.org data
4. `frontend/components/public/PublicHeader.tsx` - Public landing page header
5. `frontend/app/[locale]/og/logo/route.tsx` - OG logo generator (letter "S" -> "P")
6. `frontend/messages/en.json` - English translations (auth titles, SEO, emails, copyright)
7. `frontend/messages/pt-br.json` - Portuguese translations (same scope)
8. `frontend/app/[locale]/opengraph-image.tsx` - OG image generation
9. `frontend/app/[locale]/twitter-image.tsx` - Twitter image generation
10. `frontend/app/[locale]/pricing/opengraph-image.tsx` - Pricing OG image
11. `frontend/app/[locale]/pricing/twitter-image.tsx` - Pricing Twitter image
12. `frontend/app/[locale]/onboarding/page.tsx` - Onboarding references
13. `frontend/app/[locale]/(dashboard)/settings/billing/plans/page.tsx` - Sales email

### Backend Files (~6 files)

14. `backend/app/core/config.py` - PROJECT_NAME, webhook URL example
15. `backend/app/main.py` - API title, description, contact, CORS
16. `backend/app/services/email_service.py` - Sender address, email templates
17. `backend/app/services/google_drive.py` - Frontend URL fallback
18. `backend/app/services/manual_refunds.py` - Sender address

### Configuration Files (~3 files)

19. `docker-compose.yml` - Service labels, env vars
20. `backend/.env.example` - Header comment, project name

### Documentation (~1 file)

21. `README.md` - Title, footer, all references

### Test Files (lower priority, ~15 files)

Various test files with mock URLs and example data containing safetasks references.

## What Does NOT Change

- **Tagline:** "Production OS" stays
- **Color scheme:** Slate-900 + Amber-300 stays
- **Icon:** Clapperboard (Lucide React) stays
- **Database name:** `safetasks` (internal, zero user impact, migration risk too high)
- **Functionality:** Zero behavior changes
- **Routes/URLs:** No route structure changes

## Email Address Migration

| Current | New |
|---------|-----|
| noreply@safetasks.app | noreply@produzo.app |
| support@safetasks.com | support@produzo.app |
| contact@safetasks.com | contact@produzo.app |
| privacy@safetasks.com | privacy@produzo.app |
| sales@safetasks.com | sales@produzo.app |
| dev@safetasks.com | dev@produzo.app |

## Domain Strategy

Priority order:
1. produzo.com
2. produzo.app
3. produzo.io

## Implementation Notes

- All changes are string replacements (no logic changes)
- Translation files (en.json, pt-br.json) have the most references
- SEO file (seo.ts) centralizes most page titles -- single source of truth
- OG logo generator needs letter change ("S" -> "P")
- CORS origins and webhook URLs need domain updates
- Test files can be updated incrementally

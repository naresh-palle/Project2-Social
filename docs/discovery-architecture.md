# CR8 Influencer Discovery — Architecture

Intelligence first: **DATA → NORMALIZATION → ANALYTICS → SEARCH → AI MATCHING → DEEP RESEARCH → CAMPAIGN DECISION**.

This document describes how discovery is layered onto the **existing** CR8 MongoDB catalog. No database is recreated, reset, or truncated.

## Existing architecture (reused)

| Piece | Location |
| --- | --- |
| FastAPI + Motor MongoDB | `backend/server.py` (`DB_NAME`, `users`) |
| Creators | `users` where `role: "influencer"` |
| Browse | `GET /api/creators` |
| NL search (legacy) | `POST /api/ai/search-creators` |
| Weighted match | `phase2_features.py` + `match_config` |
| Apify profile sync | `backend/apify_service.py` (`APIFY_TOKEN`) |
| LLM | `call_llm()` — Anthropic then Gemini |
| Brand UI | Marketplace `/marketplace`, `CreatorDetail`, `OwnerPanel` |

## New components

| Module | Role |
| --- | --- |
| `backend/discovery_engine.py` | Filter validation, Mongo query builder, scoring, embeddings, providers |
| `backend/discovery_features.py` | Discovery APIs, jobs, indexes (additive only) |
| `frontend/src/pages/Discover.jsx` | Brand Discover UI |
| `docs/discovery-architecture.md` | This file |

## Database reuse

**Read/write existing `users` documents only to add optional intelligence fields that already exist** (`platform_metrics`, `monthly_analytics`). Never delete or replace users.

### New collections (additive)

| Collection | Purpose |
| --- | --- |
| `creator_metric_snapshots` | Periodic follower/engagement snapshots |
| `creator_intelligence` | Scores, content tags, audience, embeddings, freshness |
| `saved_searches` | Brand-saved filter sets |
| `creator_shortlists` | Brand shortlists |
| `discovery_jobs` | Refresh / research / embedding jobs |
| `score_model_config` | Quality-score weights (`id: quality_v1`) |
| `match_feedback` | Shortlist / select / reject signals (ranking eval) |

No existing collection is dropped. Indexes are created with `create_index` only.

## Provider layer

```
Frontend → CR8 /api/creators/* → CatalogProvider (Mongo users)
                              → ApifyProvider (APIFY_TOKEN only, backend)
                              → FutureTikTokProvider / FutureFacebookProvider
```

Apify is never called from the browser. If `APIFY_TOKEN` is missing, refresh returns `data_source_not_configured` rather than fake profiles.

## Query flow

1. User filters or NL query
2. LLM (optional) → JSON intent
3. `validate_filters()` allowlist
4. `filters_to_mongo()` on `users`
5. Deterministic scoring / ranking
6. Paginated cards (no full analytics payload)

## AI usage

| Task | Engine |
| --- | --- |
| Numeric filters | Mongo indexes / query builder |
| NL → filters | LLM JSON **or** heuristic parser if no key |
| Match explanation | LLM constrained to stored facts |
| Deep research | LLM constrained to stored facts |
| Embeddings | Stable hashing trick in Mongo (no extra vector DB) |

LLMs never query Mongo directly and must not invent metrics. Missing values surface as `Data unavailable`.

## Environment

Existing only: `APIFY_TOKEN`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` / `EMERGENT_LLM_KEY`. No new secrets required.

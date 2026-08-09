# Basera technical delivery plan

**Status date:** 2026-08-08  
**Product:** anonymous, map-first area intelligence for India  
**Stack:** Next.js 16 App Router, React 19, TypeScript, Leaflet, Tailwind CSS 4, Vitest  
**Canonical plan:** this file supersedes `PLANS.md` and consolidates prior Basera planning and implementation chats.

## 1. Product contract

Basera lets a user select one Indian area, confirm or correct its boundary, enable research layers, and inspect attributable Current or Future evidence inside that boundary.

### Required behavior

- One confirmed area per workspace.
- Current and Future evidence remain separate in requests, state, maps, caches, and UI.
- Every mapped feature has a defensible geometry, source, fetch date, status, and geographic confidence.
- Non-spatial documents remain evidence-panel records; prose alone never becomes a marker.
- Official/public-agency sources take precedence. OpenStreetMap remains a clearly labelled community source.
- Empty, unavailable, failed, partial, and truncated results remain distinct.
- Inference must be cited, bounded, and visibly separate from fact.
- Third-party content uses permitted short-lived caches only. No durable user profile, area report, raw-source warehouse, or mass scraper.

### Explicit non-goals

- Property listings, broker leads, transaction workflow, or purchase recommendations.
- Price, rent, yield, appreciation, livability, or overall area scoring.
- Accounts, saved searches, saved reports, share snapshots, or PDF exports.
- Social-media evidence or sentiment.
- Parcel-title verification and private ownership disputes.
- CAPTCHA bypass, prohibited scraping, scheduled national crawling, or permanent third-party archives.
- Claims of uniform India-wide official coverage.
- Cross-area comparison before evidence normalization and source reliability are proven.

## 2. Current implementation baseline

### Implemented request flow

```text
GET /api/areas/search?q=<query>
  -> Nominatim search
  -> India-only Polygon/MultiPolygon candidates
  -> user confirms candidate

optional POST /api/areas/boundary
  -> validate user Polygon
  -> create user:boundary/<uuid>
  -> retain in process memory for 15 minutes

GET /api/areas/catalog?areaId=<id>&mode=current|future
  -> resolve canonical OSM or short-lived user boundary
  -> return configured layer availability

POST /api/layers/query
  body: { areaId, mode, layerIds }
  -> stream and cap body at 8 KiB
  -> resolve and validate India boundary server-side
  -> dispatch supported Current layers to Overpass
  -> classify inside/intersects geometry
  -> return independent LayerResult objects
```

### Existing contracts

- Area identifiers: `osm:relation/<id>`, `osm:way/<id>`, or `user:boundary/<uuid>`.
- GeoJSON coordinate order: `[longitude, latitude]`.
- India validation envelope: `[68.1, 6.0, 97.5, 37.1]`.
- User boundary limits: 5,000 vertices, maximum 5-degree bbox span, 300 KiB request, 15-minute TTL, 100 process-local entries.
- Layer query limits: 8 KiB request and at most 17 layer IDs.
- Nominatim: five results, 8-second timeout, 2 MB response cap, one-hour positive cache, five-minute negative cache, 200 entries.
- Overpass: 15-second timeout, 5 MB response cap, 1,000 total features, two concurrent upstream requests, 30-second cache, maximum 5-degree bbox width/height.
- Current OSM layers: transport, roads, healthcare, education, daily needs, emergency, parks, recreation, civic, utilities, water, land use, and industrial/waste.
- Unconfigured layers: flood, air quality, environmental clearances, and government plans.

### Completed work

- [x] Removed conflicting buyer/price/scoring implementation.
- [x] Reframed README and metadata around evidence-first area intelligence.
- [x] Recorded source, interpretation, retention, and containment policy.
- [x] Replaced full-GeoJSON layer requests with compact area identities.
- [x] Added server-side canonical boundary re-resolution and India checks.
- [x] Added streaming request cap and strict request shape.
- [x] Added user-drawn boundary creation and validation.
- [x] Added boundary provenance and confidence.
- [x] Added server-side `inside` versus `intersects` classification.
- [x] Added per-area catalogue route and canonical coverage enums.
- [x] Added browser-memory layer response caching and abort handling.
- [x] Added OSM attribution, approximate relation-centre labels, and independent per-layer failure handling.
- [x] Stabilized lint and type safety across legacy map, service, route, and test code.
- [x] Scoped Turbopack and output tracing to the repository root using supported Next.js 16 configuration.
- [x] Added pinned CI gates for install, lint, typecheck, tests, build, and whitespace checks.
- [x] Fixed enclosing-polygon containment, boundary redraw, and exact-cap truncation regressions found during review.

### Current repository health

- `npm test`: 13 files, 65 tests passing.
- `npx tsc --noEmit`: passing.
- `npm run build` and `npm run build -- --webpack`: passing.
- `git diff --check`: passing.
- `npm run lint`: passing with no warnings.
- Next.js root detection is explicitly scoped to this repository.
- GitHub Actions now protects baseline verification on pull requests and pushes to `main`.
- Phase 0/1 changes: still uncommitted and require user review before commit.

## 3. Target server architecture

Keep route handlers thin. Provider-specific behavior belongs in connectors. Normalization and policy checks happen before UI serialization.

```text
Route parser
  -> AreaReferenceResolver
  -> AreaCatalogService
  -> ConnectorRegistry
       -> OSM connector
       -> official GIS/API connector
       -> document connector
       -> news connector
  -> EvidenceNormalizer
  -> GeographyPolicy
  -> CoverageAggregator
  -> LayerQueryResponse
```

### Proposed connector interface

```ts
interface LayerConnector {
  readonly id: string;
  readonly layers: readonly LayerId[];
  readonly modes: readonly ResearchMode[];
  readonly source: SourcePolicy;

  supports(context: ConnectorContext): Promise<ConnectorSupport>;
  query(context: ConnectorContext): Promise<ConnectorResult>;
}

interface ConnectorContext {
  readonly area: AreaSelection;
  readonly mode: ResearchMode;
  readonly layerId: LayerId;
  readonly signal: AbortSignal;
  readonly requestId: string;
  readonly now: Date;
}

interface ConnectorSupport {
  readonly availability: CoverageLevel;
  readonly health: ProviderHealth;
  readonly limitation?: string;
  readonly checkedAt: string;
}

type ProviderHealth =
  | 'unknown'
  | 'healthy'
  | 'degraded'
  | 'rate_limited'
  | 'disabled';
```

### Required source policy metadata

Every connector must declare:

- Source owner, canonical URL, and source type.
- Authority level and supported geography.
- Access method and response format.
- Terms/licence review state and required attribution.
- Request rate, concurrency budget, timeout, retry policy, and maximum response size.
- Permitted cache TTL and whether raw content may be retained temporarily.
- Data version, update cadence, known coverage gaps, and expected failure modes.
- Fixture provenance and live-smoke-test budget.

### Target response shape

`ConnectorResult.nonSpatialEvidence` exists in TypeScript but is not carried through `LayerResult` or `LayerQueryResponse`. Complete transport before document adapters ship.

```ts
interface LayerResult {
  readonly layerId: LayerId;
  readonly features: readonly ResearchFeature[];
  readonly evidence: readonly ResearchEvidence[];
  readonly coverage: LayerCoverage;
  readonly providerOutcomes: readonly ProviderOutcome[];
}

interface ProviderOutcome {
  readonly providerId: string;
  readonly state: 'success' | 'empty' | 'unavailable' | 'failed' | 'rate_limited';
  readonly checkedAt: string;
  readonly retryable: boolean;
  readonly detail?: string;
}
```

## 4. Execution order

```text
W1 Phase 1 closeout
  -> W2 Bengaluru official Current sources
    -> W3 Future documents and lifecycle
      -> W4 normalization and explanations
        -> W5 production reliability and market expansion
          -> W6 release certification
```

Later UI work must not outrun source contracts. A disabled card is not a completed layer.

## 5. W1 — Phase 1 closeout: trusted geography and query platform

**Goal:** make area identity, catalogue state, and multi-provider query dispatch reliable enough for official data.

### W1.1 Boundary-provider abstraction

- [ ] Create `BoundaryProvider` interface with `search`, `resolve`, provenance, authority, terms, and health metadata.
- [ ] Keep Nominatim as community fallback.
- [ ] Add official municipal/planning provider slots without hard-coding city data into UI.
- [ ] Define deterministic precedence: official compatible boundary, then verified OSM, then user correction.
- [ ] Preserve original provider geometry separately if display clipping/simplification is added.
- [ ] Return why a provider won and which alternatives failed.

**Likely files:** `src/server/boundaries/`, `src/server/connectors/nominatim.ts`, area routes, `src/types/research.ts`.

**Tests:** provider precedence, stale official source, provider disagreement, invalid geometry, India boundary rejection, fallback behavior.

**Acceptance:** boundary source and authority are visible and server-verified; official failure never silently becomes official-looking OSM data.

### W1.2 Search-intent contract

- [ ] Introduce explicit search kinds: locality, ward, village, town, PIN code, address, project, landmark, coordinates.
- [ ] Detect or require search kind instead of implying Nominatim free text guarantees all forms.
- [ ] Return normalized candidate type and provider support.
- [ ] Add query length, coordinate bounds, Unicode normalization, and empty-query validation.
- [ ] Document unsupported search forms per provider.

**Acceptance:** UI promises only forms with defined resolver behavior; ambiguous results require confirmation.

### W1.3 Durable short-lived area references

- [ ] Replace process-local `Map` for user boundaries before multi-instance deployment.
- [ ] Store geometry in shared TTL KV with opaque IDs, creation time, expiry, checksum, and schema version.
- [ ] Enforce 15-minute or policy-approved TTL at storage layer.
- [ ] Add atomic capacity/rate limits by anonymous session/IP-safe key.
- [ ] Never log complete user geometry unless required for a bounded security event.
- [ ] Preserve in-memory adapter for tests/local development.

**Tests:** expiry, missing reference, capacity, malformed stored value, multi-process read simulation, checksum mismatch.

### W1.4 Dynamic catalogue and source health

- [ ] Replace static `buildAreaCatalog` support checks with connector-registry support probes.
- [ ] Calculate availability per `(areaId, mode, layerId, provider)`.
- [ ] Include source-health age and limitation text.
- [ ] Cache catalogue probes briefly and invalidate when provider state changes.
- [ ] Never mark `available` before a permitted configured adapter exists.

**Acceptance:** catalogue state predicts real queryability; disabled, unknown, degraded, and rate-limited providers differ.

### W1.5 Multi-provider query orchestration

- [ ] Replace direct Overpass dispatch in `/api/layers/query` with registry orchestration.
- [ ] Pass one request `AbortSignal` through all connectors.
- [ ] Bound overall request time and per-provider time independently.
- [ ] Limit global and provider concurrency.
- [ ] Return partial layer results when one provider fails.
- [ ] Preserve stable requested-layer ordering.
- [ ] Carry `nonSpatialEvidence` and provider outcomes to response.
- [ ] Add structured internal errors; expose safe user messages only.

**Tests:** mixed success/failure, empty success, timeout, abort, duplicate layer IDs, unsupported Future layer, provider rate limit, response ordering.

### W1.6 Catalogue and evidence UI completion

- [ ] Group layers into Planning, Transport, Civic, Social, Environment/Risk, Economy, and Public Evidence.
- [ ] Add category and individual toggles.
- [ ] Add legends, feature counts, provider state, coverage text, source/date/status filters.
- [ ] Render non-spatial evidence separately from map features.
- [ ] Preserve keyboard access and visible focus.
- [ ] Add responsive drawer/bottom-sheet layout without losing provenance.
- [ ] Keep cached results keyed by area identity, mode, sorted unique layers, and source revision.

**Acceptance:** user can explain why a layer is empty, partial, unavailable, or failed without reading developer logs.

## 6. W2 — Bengaluru/Karnataka official Current evidence

**Goal:** prove deep official evidence in one market before broader claims.

### W2.0 Mandatory source-discovery spike

No connector code until candidate source is documented.

- [ ] Identify source owner and authoritative status.
- [ ] Record access method: API, OGC service, downloadable structured file, HTML, PDF, or manual-only portal.
- [ ] Record terms, licence, attribution, robots/CAPTCHA constraints, request limits, permitted TTL, and update schedule.
- [ ] Record geometry type, coordinate system, geography granularity, dataset year/version, language, and known gaps.
- [ ] Capture one sanitized real-response fixture when permitted.
- [ ] Define exact empty, failed, rate-limited, and stale behaviors.
- [ ] Reject sources requiring prohibited scraping or unverifiable georeferencing.

**Artifact:** `docs/sources/<provider-id>.md` plus launch-matrix entry.

### W2.1 Planning and zoning vertical

- [ ] Integrate official master/development plan GIS or defensibly georeferenced notified maps.
- [ ] Model land-use class, zoning rule reference, FAR/FSI source, reservation/special-zone status, plan version, and effective date.
- [ ] Treat document-only policy as area-wide evidence.
- [ ] Never convert raster colour or prose into exact zoning without validated methodology and confidence.

### W2.2 Transport and works vertical

- [ ] Integrate responsible metro, rail, road, bus, airport, flyover, underpass, widening, cycle, or parking authority data.
- [ ] Preserve route/station/work geometry supplied by source.
- [ ] Separate operational infrastructure from proposed/under-construction records.
- [ ] Use OSM only as supplementary Current context.

### W2.3 Civic and social infrastructure vertical

- [ ] Integrate authoritative water, sewerage, drainage, electricity, waste, public-realm, school, hospital, police, fire, park, market, and cultural-facility records where accessible.
- [ ] Resolve addresses conservatively; unresolved city-wide announcements remain non-spatial.
- [ ] Preserve facility authority, type, operating status, observation date, and update source.

### W2.4 Environment and hazard vertical

- [ ] Evaluate Bhuvan, CWC, NDMA, CPCB, state pollution boards, and relevant local authorities.
- [ ] Distinguish observation, model, forecast, regulatory zone, and historical event.
- [ ] Record dataset scale/resolution and observation window.
- [ ] Never substitute OSM density, centroid weather, or generic elevation for official flood/air-quality evidence.

### W2.5 Environmental approvals and economy vertical

- [ ] Integrate PARIVESH records only when location is defensible.
- [ ] Integrate official SEZ, industrial authority, public project, institution, or technology-park evidence.
- [ ] Keep city/state policy documents as area-wide evidence unless specific geometry exists.

### W2 acceptance gate

- [ ] One validated official Current layer each for Planning, Transport, Civic, and Environment in representative Bengaluru areas.
- [ ] Every connector has source documentation, replay fixture, error cases, attribution, TTL, and modest live smoke test.
- [ ] Boundary clipping/containment is verified.
- [ ] Failure of one official provider leaves OSM and other layers usable.
- [ ] UI never claims equivalent depth outside validated launch markets.

## 7. W3 — Future plans and document evidence

**Goal:** show credible future change without fabricating map precision or lifecycle state.

### W3.1 Approved-source registry

- [ ] Registry by country/state/city, authority, domain, source type, and permitted access method.
- [ ] Official sources first; formal company, research, and established-news sources supplementary.
- [ ] General search result remains discovery lead until publisher and claim are validated.

### W3.2 Safe document fetcher

- [ ] Allow only HTTPS and approved domains.
- [ ] Validate DNS/IP destination and every redirect against SSRF policy.
- [ ] Never forward user credentials or internal headers.
- [ ] Enforce connect/read/total timeout, byte limit, PDF page limit, MIME checks, decompression limit, and cancellation.
- [ ] Reject password-protected, malformed, or oversized documents safely.
- [ ] Delete temporary content at TTL expiry.
- [ ] Treat document text as untrusted data and isolate prompt instructions.

### W3.3 Schema-first extraction

- [ ] Extract project/reference ID, authority, title, location, lifecycle status, announcement/publication date, target date, excerpt, URL, language, and confidence.
- [ ] Require cited source span for every extracted claim.
- [ ] Reject unsupported enum values and source-less generated claims.
- [ ] Retain original text alongside translation.

### W3.4 Lifecycle reconciliation

Use dated evidence and preserve disagreement. Preferred precedence is not silent deletion:

```text
cancelled/completed
  > construction
  > tendered
  > funded
  > approved/notified
  > consultation
  > proposed
  > reported
```

- [ ] Keep older claims visible.
- [ ] Mark preferred claim and reason.
- [ ] Never infer completion from target date.
- [ ] Separate delayed from cancelled.

### W3.5 Geographic verification and UI

- [ ] Map only source geometry, coordinates, official-map overlap, or unambiguous resolved address.
- [ ] Keep unlocated evidence under “Applies to area / location not mappable.”
- [ ] Add Future timeline, status/date/source filters, lifecycle legend, and last verification time.
- [ ] Prove Current and Future state/cache isolation.

## 8. W4 — evidence normalization and bounded explanations

**Goal:** unify multi-source evidence without hiding uncertainty.

### W4.1 Normalized evidence graph

- [ ] Model display entity, source records, claim records, geometry decision, lifecycle history, and conflicts separately.
- [ ] Require source URL/type, publisher, fetched/published dates, licence/attribution, geographic confidence, evidence confidence, and schema version.
- [ ] Validate URLs, geometry, dates, enums, and excerpts at connector boundary.

### W4.2 Conservative deduplication

- [ ] Auto-merge only on strong identifiers or verified authority/name/type/geometry matches.
- [ ] Keep weak candidates separate.
- [ ] Retain all supporting sources and explain merge reason.
- [ ] Add deterministic collision and false-positive fixtures.

### W4.3 Citation enforcement and translation

- [ ] Every normalized claim references source and evidence span.
- [ ] Every generated explanation references normalized claim IDs.
- [ ] Block source-independent AI output.
- [ ] Store original language, translated language, model/version, and translation timestamp.

### W4.4 Impact-rule catalogue

- [ ] Use deterministic rules for possible positive, negative, mixed, or unclear impact language.
- [ ] Describe construction disruption separately from operational benefit.
- [ ] Never produce numeric property impact, recommendation, ranking, or overall score.
- [ ] Generate concise evidence-only summary with strengths, gaps, conflicts, and links.

## 9. W5 — production reliability, security, and expansion

### W5.1 Shared infrastructure

- [ ] Shared TTL cache/KV for area references, geocoding, boundaries, connector responses, document extracts, and source health.
- [ ] Distributed token-bucket/sliding-window rate limits per provider and application.
- [ ] Provider concurrency budgets and circuit breakers.
- [ ] Version cache keys by connector/schema/source revision.
- [ ] Prevent cache stampedes with single-flight locks.

### W5.2 Outbound and API security

- [ ] Global anonymous abuse limits.
- [ ] Strict body and response limits on every route/connector.
- [ ] SSRF-safe DNS/IP validation, domain allowlists, redirect checks, protocol checks, and credential stripping.
- [ ] Abort propagation and safe retry for idempotent transient failures only.
- [ ] Sanitize source text and tags before display.
- [ ] Privacy-safe logs: request ID, provider, duration, status, byte count, cache outcome; no durable query history or complete user geometry.

### W5.3 Observability

- [ ] Metrics for latency, success, empty, partial, failure, rate limit, timeout, truncation, cache hit, and circuit state.
- [ ] Structured logs with provider and layer correlation.
- [ ] Alerts based on sustained provider degradation, not one failed public request.
- [ ] Human-readable health state returned through catalogue/coverage.

### W5.4 Controlled market expansion

- [ ] Maintain launch matrix containing market, layer, provider, owner, coverage, mode, dataset date, TTL, access constraints, fixture, smoke test, code owner, and health.
- [ ] Validate connector contracts next in Pune, Hyderabad, and NCR.
- [ ] Advertise deep coverage only after market gate passes.
- [ ] Keep OSM-only locations labelled shallow/community coverage.

## 10. W6 — verification and release certification

### Unit tests

- [ ] Boundary provider precedence and disagreement.
- [ ] Geometry validation, containment, intersection, clipping, and approximation.
- [ ] Request parsing, limits, cancellation, and invalid stored references.
- [ ] Catalogue availability and provider-health classification.
- [ ] Lifecycle extraction and precedence.
- [ ] Evidence normalization, citations, translation metadata, deduplication, and conflicts.
- [ ] Cache expiry, single flight, rate limiting, circuit breaking, and partial failures.

### Connector replay tests

- [ ] Recorded permitted real-response fixtures for success, empty, malformed, stale, rate-limited, and upstream-error cases.
- [ ] Fixture provenance and capture date documented.
- [ ] No invented production records.

### Browser tests

- [ ] Search, candidate confirmation, cancellation, and area change.
- [ ] Boundary edit/draw, invalid polygon, expiry, and retry.
- [ ] Layer/category selection, cache reuse, abort, and stale-response rejection.
- [ ] Empty, unavailable, failed, partial, truncated, and rate-limited states.
- [ ] Feature selection, evidence attribution, crossing geometry, approximate centres, and non-spatial evidence.
- [ ] Current/Future separation.
- [ ] Desktop, tablet, mobile, keyboard, and screen-reader flows.

### Live smoke tests

- [ ] Small, named representative-area matrix with rate budget.
- [ ] Record date, provider, endpoint, expected shape, permitted variance, and known limits.
- [ ] Never make ordinary CI depend on unrestricted public-provider capacity.

### Release gates

Every delivery slice must satisfy:

```text
npm test
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

Also required:

- [ ] No fabricated or test-only production response.
- [ ] Visible source attribution and coverage limitation for every shipped layer.
- [ ] Accessibility: keyboard, focus, screen reader, contrast, motion, loading, and errors.
- [ ] Responsive map/evidence behavior.
- [ ] Performance budgets for initial load, map interaction, response size, and connector latency.
- [ ] README and this plan match actual live coverage.

## 11. Milestone exit criteria

### M1 — trusted query platform

- Boundary provider abstraction exists.
- Shared short-lived area references work.
- Dynamic catalogue and connector registry replace static/direct dispatch.
- Non-spatial evidence reaches UI.

### M2 — Bengaluru official Current launch

- Planning, Transport, Civic, and Environment each have one validated official connector.
- Source matrix, fixtures, attribution, limitations, and health reporting complete.

### M3 — Future evidence beta

- Approved document sources, safe fetch/extraction, lifecycle reconciliation, and Future UI pass curated fixtures.
- No fabricated coordinates or uncited claims.

### M4 — normalized explanations

- Multi-source deduplication/conflicts and citation enforcement are deterministic.
- Evidence-only summaries remain bounded and auditable.

### M5 — controlled India expansion

- Shared reliability/security infrastructure supports multiple replicas.
- Pune, Hyderabad, and NCR validation completed before broader market claims.

### M6 — production release

- Full automated, accessibility, responsive, performance, and live-smoke gates pass.
- Product copy accurately distinguishes deep, shallow, unavailable, and failed coverage.

## 12. Next implementation sequence

1. Complete connector and boundary-provider interfaces with tests first.
2. Add shared TTL area-reference adapter.
3. Replace static catalogue and direct Overpass dispatch with registry orchestration.
4. Carry non-spatial evidence/provider outcomes through API and UI.
5. Perform Bengaluru/Karnataka source-discovery spike.
6. Ship first official Planning connector, then Transport, Civic, and Environment verticals.

Do not start broad India expansion, Future AI extraction, or visual scoring before these dependencies pass their milestone gates.

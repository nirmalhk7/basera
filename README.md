<div align="center">
  <h1>🗺️ Basera</h1>
  <p><strong>Area intelligence for India</strong></p>
</div>

## Overview

**Basera** is an anonymous, map-first research tool for understanding one selected Indian area through source-attributed Current and Future evidence. Select a boundary, choose a layer, and inspect what a connected source actually returned inside that boundary.

Basera does not estimate prices or rent, recommend purchases, rank areas, produce livability scores, or present modelled measurements as official observations.

## Evidence model

- **Current** and **Future** evidence stay separate.
- Each feature exposes its source, fetched time, source type, geographic confidence, and coverage state.
- `available` means a source returned usable evidence; `partial` means capped, sparse, or incomplete coverage; `unavailable` means no permitted adapter or local coverage exists; `failed` means the configured source was attempted and failed.
- A successful empty result is shown as “nothing found”; it is not relabelled as a source failure.
- Facts and bounded interpretations are visibly separate. Prose without defensible geometry remains panel evidence, not a map marker.

## Sources and retention

Current production adapters use Nominatim/OpenStreetMap for area discovery and boundaries, Overpass/OpenStreetMap for map features, and CARTO/OSM tiles for basemap rendering. OSM is community-sourced and capped/partial; official planning, transit, environmental, and civic connectors are not live yet.

Official or public-agency sources come first. Formal companies, research institutions, and established news may supplement them. Social media is excluded. Provider terms, attribution, licences, robots rules, rate limits, CAPTCHA restrictions, and permitted cache TTLs apply.

Basera uses expiring technical caches for provider reliability. It does not retain profiles, saved areas, saved reports, durable query history, permanent third-party datasets, or scheduled national crawls.

## Boundary policy

Boundary precedence is official planning or administrative geometry first, verified OpenStreetMap community geometry second, and a user-drawn boundary only when neither is usable. Basera shows the boundary source and confidence and lets the user correct or replace it without creating a user profile.

Points must be inside the selected boundary. Lines and polygons that cross it are retained with an explicit `intersects` label; features wholly outside are excluded. Relation centres are approximate points and never exact footprints.

## ✨ Current capabilities

- Search and confirm Indian area boundaries with Nominatim attribution.
- Query 13 capped Current OpenStreetMap layers using a compact area identity.
- Keep source failures, unavailable layers, partial coverage, and successful empty results distinct.
- Inspect attributable map evidence without storing a permanent area profile.

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org) (App Router)
- **UI Library:** [React 19](https://react.dev)
- **Mapping Engine:** [Leaflet](https://leafletjs.com/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Testing:** Vitest & React Testing Library

## 🚀 Getting Started

### Prerequisites

Ensure you have Node.js (v20+) installed on your machine.

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd basera
   ```

2. Install dependencies:
   ```bash
   npm install
   # or yarn / pnpm / bun
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

## 📂 Project Structure

```text
src/
├── app/          # Next.js App Router pages and layouts
├── components/   # Reusable UI and map components (e.g., MapContainerWrapper)
├── services/     # External service integrations
├── data/         # Static datasets, GeoJSON files
├── types/        # TypeScript type definitions
└── utils/        # Helper functions
```

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

## 📝 License

This project is open-source and available under the standard MIT License.

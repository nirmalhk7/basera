# Agent Instructions for Basera

This file contains crucial context, constraints, and instructions for any AI agent working on the **Basera** repository. Please read and adhere to these guidelines before making changes.

## 1. Project Context
**Basera** is a high-performance, interactive geospatial mapping tool focused on the Indian subcontinent.
- **Core Functionality:** Terrain-style maps, live administrative border detection, demographic profiles, and climate telemetry.
- **Primary Tech Stack:** Next.js 15+ (App Router), React 19, Leaflet, Tailwind CSS v4, TypeScript.

## 2. Technical Guidelines
- **Mapping & GeoJSON:**
  - We use **Leaflet** for rendering maps. Do not introduce other heavy mapping libraries (like Mapbox GL JS or OpenLayers) unless explicitly requested.
  - Pay attention to GeoJSON processing. Offload heavy GeoJSON parsing/simplification to the server (API routes) if the datasets are too large for the client, or use efficient client-side chunking.
- **Styling & Aesthetics:**
  - Maintain a **Premium UI/UX**. Use the dark mode aesthetic (e.g., `bg-slate-950`), subtle glassmorphism, and smooth micro-animations.
  - Use Tailwind CSS v4 utility classes. Keep components responsive.
- **Component Architecture:**
  - Use Server Components where possible. Use `"use client"` only for components requiring interactivity (e.g., Map wrappers, interactive panels).
  - Keep map-related Leaflet code isolated in dynamic imports with `{ ssr: false }` since Leaflet relies heavily on the `window` object.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 3. Workflow Rules
- **No Placeholders:** If you are building UI components, make them functional and aesthetically pleasing immediately. Do not leave "TODO: Add content" placeholders.
- **Testing:** Ensure that tests (Vitest) pass before finalizing major features, specifically for geographic utilities and parsers.
- **Commiting:** After user confirmation of code correctness, commit the changes using `git commit` with a concise, descriptive message.

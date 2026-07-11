<div align="center">
  <h1>🗺️ Basera</h1>
  <p><strong>Interactive India Terrain & Geospatial Explorer</strong></p>
</div>

## Overview

**Basera** is a high-performance, interactive geospatial mapping tool focused on the Indian subcontinent. It provides a terrain-style map experience featuring live administrative border detection, dynamic demographic profiles, and climate telemetry. Built for speed, responsiveness, and premium visual aesthetics, Basera bridges the gap between complex GIS data and intuitive web interfaces.

## ✨ Key Features

- 🗺️ **Interactive Terrain Mapping:** High-quality, smooth, and responsive map rendering.
- 📍 **Administrative Border Detection:** Live detection and highlighting of Indian urban and regional jurisdictions.
- 📊 **Demographic Profiles:** Contextual data layers showcasing relevant demographic insights for selected regions.
- 🌦️ **Climate Telemetry:** Real-time or historical climate data integration.
- 🎨 **Premium UI/UX:** Built with modern design aesthetics, dark mode support, and fluid micro-animations.

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
├── services/     # API integrations, Overpass/Nominatim queries
├── data/         # Static datasets, GeoJSON files
├── types/        # TypeScript type definitions
└── utils/        # Helper functions
```

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

## 📝 License

This project is open-source and available under the standard MIT License.

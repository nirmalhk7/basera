import { RESEARCH_LAYERS } from "@/config/researchLayers";
import { probeConnectorSupport } from "@/server/connectors/registry";
import type { AreaCatalogEntry, AreaSelection, ResearchMode } from "@/types/research";

export async function buildAreaCatalog(
  _area: AreaSelection,
  mode: ResearchMode,
  checkedAt = new Date().toISOString(),
): Promise<readonly AreaCatalogEntry[]> {
  return Promise.all(RESEARCH_LAYERS.map(async (layer) => {
    const supports = await probeConnectorSupport(_area, mode, layer.id);
    const active = supports[0];
    const supported = Boolean(active?.available);
    return {
      layerId: layer.id,
      mode,
      availability: supported ? "available" : "unavailable",
      providers: layer.sourceRequirements,
      limitation: supported
        ? active.limitation
        : "No live " + mode + " source adapter is configured for this layer.",
      checkedAt: active?.checkedAt ?? checkedAt,
      sourceAge: active ? `PT${Math.max(0, Math.floor((Date.now() - Date.parse(active.checkedAt)) / 1000))}S` : undefined,
      sourceHealth: active?.health ?? "disabled",
    };
  }));
}

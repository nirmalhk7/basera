import { getResearchLayer } from "@/config/researchLayers";
import { isSupportedLayerId, queryOverpassLayer, type CurrentOsmLayerId } from "@/server/connectors/overpass";
import type { AreaSelection, ConnectorResult, LayerCoverage, LayerId, ProviderOutcome, ResearchMode, SourceReference } from "@/types/research";

const OVERPASS: SourceReference = { name: "OpenStreetMap", url: "https://www.openstreetmap.org/" };
const PROVIDER_ID = "openstreetmap-overpass";
const CACHE_TTL_MS = 15_000;
const OVERALL_TIMEOUT_MS = 20_000;
const PROVIDER_TIMEOUT_MS = 16_000;
const MAX_GLOBAL_CONCURRENCY = 4;

export interface ConnectorSupport {
  readonly layerId: LayerId;
  readonly mode: ResearchMode;
  readonly providerId: string;
  readonly provider: SourceReference;
  readonly available: boolean;
  readonly health: 'unknown' | 'healthy' | 'degraded' | 'rate_limited' | 'disabled';
  readonly checkedAt: string;
  readonly limitation?: string;
}

type RegisteredConnector = {
  readonly id: string;
  readonly provider: SourceReference;
  supports(layerId: LayerId, mode: ResearchMode): boolean;
  probe(layerId: LayerId, mode: ResearchMode): Promise<ConnectorSupport>;
  query(area: AreaSelection, layerId: LayerId, signal: AbortSignal): Promise<ConnectorResult>;
};

function coverage(layerId: LayerId, features: number, truncated: boolean, timestamp?: string): LayerCoverage {
  const timestampText = timestamp ? ` OSM base timestamp: ${timestamp}.` : "";
  return {
    layerId,
    level: 'partial',
    message: features === 0
      ? `OpenStreetMap query succeeded but found nothing mapped for this layer inside the selected area.${timestampText}`
      : `Live OpenStreetMap query completed with ${features} feature${features === 1 ? '' : 's'}. Results are community-sourced${truncated ? ' and capped' : ''}; crossing lines and polygons are labelled intersects.${timestampText}`,
    sourcesChecked: [OVERPASS], sourcesSucceeded: [OVERPASS], generatedAt: new Date().toISOString(), truncated, retryable: false,
  };
}

const overpassConnector: RegisteredConnector = {
  id: PROVIDER_ID,
  provider: OVERPASS,
  supports: (layerId, mode) => mode === 'current' && isSupportedLayerId(layerId),
  async probe(layerId, mode) {
    const available = this.supports(layerId, mode);
    return { layerId, mode, providerId: PROVIDER_ID, provider: OVERPASS, available, health: available ? 'healthy' : 'disabled', checkedAt: new Date().toISOString(), limitation: available ? 'OpenStreetMap is community-sourced, capped, and may be sparse for this area.' : undefined };
  },
  async query(area, layerId, signal) {
    if (!isSupportedLayerId(layerId)) throw new Error('Layer is not supported by OpenStreetMap.');
    const result = await queryOverpassLayer(area, layerId as CurrentOsmLayerId, fetch, signal);
    return { features: result.features, coverage: coverage(layerId, result.features.length, result.truncated, result.osmBaseTimestamp), nonSpatialEvidence: [] };
  },
};

const connectors: readonly RegisteredConnector[] = [overpassConnector];
const supportCache = new Map<string, { expiresAt: number; value: readonly ConnectorSupport[] }>();

export async function probeConnectorSupport(area: Pick<AreaSelection, 'id'>, mode: ResearchMode, layerId: LayerId): Promise<readonly ConnectorSupport[]> {
  const key = `${area.id}:${mode}:${layerId}`;
  const cached = supportCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await Promise.all(connectors.filter((connector) => connector.supports(layerId, mode)).map((connector) => connector.probe(layerId, mode)));
  supportCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export function invalidateConnectorSupportCache(): void { supportCache.clear(); }

function unavailableResult(layerId: LayerId, mode: ResearchMode): ConnectorResult {
  const requirements = getResearchLayer(layerId)?.sourceRequirements ?? [];
  return { features: [], nonSpatialEvidence: [], coverage: { layerId, level: 'unavailable', message: `No live ${mode} source adapter is configured for this layer; no features were generated.`, sourcesChecked: requirements.flatMap((item) => item.url ? [{ name: item.name, url: item.url }] : []), sourcesSucceeded: [], generatedAt: new Date().toISOString(), truncated: false, retryable: false } };
}

function timeoutSignal(parent: AbortSignal, timeout: number): AbortSignal {
  return AbortSignal.any([parent, AbortSignal.timeout(timeout)]);
}

export async function orchestrateLayerQueries(area: AreaSelection, mode: ResearchMode, layerIds: readonly LayerId[], signal: AbortSignal): Promise<{ layers: readonly { layerId: LayerId; result: ConnectorResult }[]; providerOutcomes: readonly ProviderOutcome[] }> {
  const requested = [...new Set(layerIds)];
  const overallSignal = timeoutSignal(signal, OVERALL_TIMEOUT_MS);
  const outcomes: ProviderOutcome[] = [];
  const runLayer = async (layerId: LayerId, index: number): Promise<{ index: number; layerId: LayerId; result: ConnectorResult }> => {
    const connector = connectors.find((candidate) => candidate.supports(layerId, mode));
    if (!connector) return { index, layerId, result: unavailableResult(layerId, mode) };
    try {
      const providerSignal = timeoutSignal(overallSignal, PROVIDER_TIMEOUT_MS);
      const result = await connector.query(area, layerId, providerSignal);
      outcomes.push({ providerId: connector.id, provider: connector.provider, layerId, status: 'succeeded', message: 'Provider query completed.', retryable: false });
      return { index, layerId, result };
    } catch {
      const aborted = overallSignal.aborted;
      const timedOut = !signal.aborted && aborted;
      outcomes.push({ providerId: connector.id, provider: connector.provider, layerId, status: signal.aborted ? 'aborted' : timedOut ? 'timed_out' : 'failed', message: 'Provider query could not be completed.', retryable: !signal.aborted });
      const unavailable = unavailableResult(layerId, mode);
      return { index, layerId, result: { ...unavailable, coverage: { ...unavailable.coverage, level: 'failed' as const, message: 'A configured provider could not complete this layer. No fallback features were generated.', retryable: !signal.aborted } } };
    }
  };
  const completed: { index: number; layerId: LayerId; result: ConnectorResult }[] = [];
  for (let start = 0; start < requested.length; start += MAX_GLOBAL_CONCURRENCY) {
    completed.push(...await Promise.all(requested.slice(start, start + MAX_GLOBAL_CONCURRENCY).map((layerId, offset) => runLayer(layerId, start + offset))));
  }
  return { layers: completed.sort((a, b) => a.index - b.index).map(({ layerId, result }) => ({ layerId, result })), providerOutcomes: outcomes };
}

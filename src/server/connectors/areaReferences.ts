import { resolveNominatimArea } from "@/server/connectors/nominatim";
import {
  AreaReferenceError,
  AREA_REFERENCE_ID_PATTERN,
  AreaReferenceService,
} from "@/server/area-references/service";
import { InMemoryAreaReferenceStore, type AreaReferenceStore } from "@/server/area-references/store";
import type { AreaGeometry, AreaSelection } from "@/types/research";

export { AreaReferenceError } from "@/server/area-references/service";

let configuredStore: AreaReferenceStore | null = null;
const localStore = new InMemoryAreaReferenceStore();

/** Configure a shared, TTL-enforcing KV adapter during production startup. */
export function configureAreaReferenceStore(store: AreaReferenceStore | null): void {
  configuredStore = store;
}

function service(): AreaReferenceService {
  const store = configuredStore ?? (process.env.NODE_ENV === "production" ? null : localStore);
  if (!store) throw new AreaReferenceError("infrastructure_unavailable");
  return new AreaReferenceService({ store });
}

export async function createUserBoundaryReference(
  geometry: AreaGeometry,
  displayName: string | undefined,
  anonymousKey: string,
): Promise<{ area: AreaSelection; expiresAt: number }> {
  return service().create(geometry, displayName, anonymousKey);
}

export async function resolveAreaReference(areaId: string): Promise<AreaSelection | null> {
  if (AREA_REFERENCE_ID_PATTERN.test(areaId)) return service().resolve(areaId);
  return resolveNominatimArea(areaId);
}

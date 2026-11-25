import { INDIA_BBOX, isAreaGeometry } from "@/server/geo";
import type { AreaGeometry, AreaSelection, BoundingBox } from "@/types/research";

export type SearchKind = "locality" | "ward" | "village" | "town" | "pin" | "address" | "project" | "landmark" | "coordinates";
export type ProviderHealth = "unknown" | "healthy" | "degraded" | "unavailable" | "unconfigured";
export type ProviderProvenance = "official" | "community" | "user";

export interface BoundaryProviderMetadata {
  readonly id: string;
  readonly name: string;
  readonly provenance: ProviderProvenance;
  readonly authority: string;
  readonly termsUrl: string;
  readonly health: ProviderHealth;
  readonly supportedSearchKinds: readonly SearchKind[];
}

export interface BoundaryCandidate extends AreaSelection {
  readonly providerId: string;
  readonly kind: SearchKind;
  /** Retained unchanged when a separate display geometry is ever introduced. */
  readonly originalGeometry: AreaGeometry;
  readonly verified: boolean;
  /** Search is never a boundary selection: callers must request user confirmation. */
  readonly confirmationRequired: true;
}

export interface BoundaryProvider {
  readonly metadata: BoundaryProviderMetadata;
  search(intent: ValidSearchIntent): Promise<readonly BoundaryCandidate[]>;
  resolve(id: string): Promise<BoundaryCandidate | null>;
}

export interface ValidSearchIntent {
  readonly valid: true;
  readonly query: string;
  readonly kind: SearchKind;
  readonly coordinates?: readonly [longitude: number, latitude: number];
}

export interface InvalidSearchIntent {
  readonly valid: false;
  readonly code: "empty_query" | "query_too_short" | "query_too_long" | "unsupported_search_kind" | "invalid_coordinates" | "coordinates_outside_india";
  readonly error: string;
}

export type SearchIntent = ValidSearchIntent | InvalidSearchIntent;

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 160;
const SEARCH_KINDS: readonly SearchKind[] = ["locality", "ward", "village", "town", "pin", "address", "project", "landmark", "coordinates"];
const coordinatePattern = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;
const pinPattern = /^\d{6}$/;

function invalid(code: InvalidSearchIntent["code"], error: string): InvalidSearchIntent {
  return { valid: false, code, error };
}

function asSearchKind(value: string | null | undefined): SearchKind | null {
  if (!value) return null;
  return SEARCH_KINDS.includes(value as SearchKind) ? value as SearchKind : null;
}

function coordinatesWithinIndia(longitude: number, latitude: number): boolean {
  return longitude >= INDIA_BBOX[0] && longitude <= INDIA_BBOX[2] && latitude >= INDIA_BBOX[1] && latitude <= INDIA_BBOX[3];
}

export function parseSearchIntent(rawQuery: string | null | undefined, requestedKind?: string | null): SearchIntent {
  const query = (rawQuery ?? "").normalize("NFC").trim();
  if (!query) return invalid("empty_query", "q must not be empty.");
  if (query.length > MAX_QUERY_LENGTH) return invalid("query_too_long", `q must contain at most ${MAX_QUERY_LENGTH} characters.`);

  const requested = requestedKind === undefined || requestedKind === null || requestedKind === "" ? null : asSearchKind(requestedKind);
  if (requestedKind && !requested) return invalid("unsupported_search_kind", "kind must be a supported search kind.");
  const coordinateMatch = coordinatePattern.exec(query);
  const inferredKind: SearchKind = coordinateMatch ? "coordinates" : pinPattern.test(query) ? "pin" : "locality";
  const kind = requested ?? inferredKind;

  if (kind === "coordinates") {
    if (!coordinateMatch) return invalid("invalid_coordinates", "Coordinates must use latitude, longitude format.");
    const latitude = Number(coordinateMatch[1]);
    const longitude = Number(coordinateMatch[2]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return invalid("invalid_coordinates", "Coordinates are invalid.");
    }
    if (!coordinatesWithinIndia(longitude, latitude)) return invalid("coordinates_outside_india", "Coordinates must be within India.");
    return { valid: true, query, kind, coordinates: [longitude, latitude] };
  }

  if (query.length < MIN_QUERY_LENGTH) return invalid("query_too_short", `q must contain ${MIN_QUERY_LENGTH} to ${MAX_QUERY_LENGTH} characters.`);
  return { valid: true, query, kind };
}

export type BoundaryAlternative = {
  readonly providerId: string;
  readonly reason: "lower_precedence" | "stale_source" | "invalid_geometry" | "incompatible_boundary" | "unverified_osm_boundary" | "provider_failed";
};

export type BoundaryAttempt = {
  readonly providerId: string;
  readonly candidate?: BoundaryCandidate;
  readonly compatible: boolean;
  readonly failure?: Exclude<BoundaryAlternative["reason"], "lower_precedence" | "unverified_osm_boundary">;
};

export type BoundaryChoice = {
  readonly winner: BoundaryCandidate | null;
  readonly winnerReason: "compatible_official_boundary" | "verified_osm_boundary" | "user_correction" | null;
  readonly alternatives: readonly BoundaryAlternative[];
};

function isUsableCandidate(attempt: BoundaryAttempt): attempt is BoundaryAttempt & { candidate: BoundaryCandidate } {
  const candidate = attempt.candidate;
  return candidate !== undefined && attempt.compatible && isAreaGeometry(candidate.geometry);
}

export function chooseBoundary(attempts: readonly BoundaryAttempt[]): BoundaryChoice {
  const usable = attempts.filter(isUsableCandidate);
  const official = usable.find((attempt) => attempt.candidate.boundary?.sourceType === "official");
  const verifiedOsm = usable.find((attempt) => attempt.candidate.boundary?.sourceType === "community" && attempt.candidate.verified);
  const user = usable.find((attempt) => attempt.candidate.boundary?.sourceType === "user");
  const winner = official ?? verifiedOsm ?? user;
  const winnerReason = official ? "compatible_official_boundary" : verifiedOsm ? "verified_osm_boundary" : user ? "user_correction" : null;
  const alternatives = attempts.filter((attempt) => attempt !== winner).map((attempt): BoundaryAlternative => {
    if (attempt.failure) return { providerId: attempt.providerId, reason: attempt.failure };
    if (attempt.candidate && !isAreaGeometry(attempt.candidate.geometry)) {
      return { providerId: attempt.providerId, reason: "invalid_geometry" };
    }
    if (!attempt.compatible) return { providerId: attempt.providerId, reason: "incompatible_boundary" };
    if (attempt.candidate?.boundary?.sourceType === "community" && !attempt.candidate.verified) {
      return { providerId: attempt.providerId, reason: "unverified_osm_boundary" };
    }
    return { providerId: attempt.providerId, reason: "lower_precedence" };
  });
  return { winner: winner ? winner.candidate : null, winnerReason, alternatives };
}

export interface OfficialProviderSlot {
  readonly id: string;
  readonly authority: string;
  readonly provider?: BoundaryProvider;
}

/** Configuration-only slots keep city-specific official sources out of client/UI code. */
export function officialProviderSlots(slots: readonly OfficialProviderSlot[]): readonly OfficialProviderSlot[] {
  return slots;
}

export function toBoundaryCandidate(area: AreaSelection, providerId: string, kind: SearchKind, verified: boolean): BoundaryCandidate {
  const bbox: BoundingBox = area.bbox;
  return { ...area, providerId, kind, verified, confirmationRequired: true, originalGeometry: area.geometry, bbox };
}

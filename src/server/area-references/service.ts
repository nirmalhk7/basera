import { createHash, randomUUID } from "node:crypto";
import { bboxMatchesGeometry, canonicalAreaGeometry, isAreaGeometry, isValidBbox } from "@/server/geo";
import type { AreaGeometry, AreaSelection } from "@/types/research";
import { validateEditableAreaGeometry } from "@/utils/researchGeometry";
import type { AreaReferenceStore } from "./store";

export const AREA_REFERENCE_TTL_MS = 15 * 60 * 1_000;
export const AREA_REFERENCE_SCHEMA_VERSION = 1;
export const AREA_REFERENCE_ID_PATTERN = /^user:boundary\/[0-9a-f-]{36}$/;

const DEFAULT_CAPACITY = 100;
const DEFAULT_RATE_LIMIT = { limit: 10, windowMs: 15 * 60 * 1_000 };

type StoredAreaReference = {
  readonly version: typeof AREA_REFERENCE_SCHEMA_VERSION;
  readonly id: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly checksum: string;
  readonly area: AreaSelection;
};

export class AreaReferenceError extends Error {
  constructor(readonly code: "capacity_exceeded" | "rate_limited" | "infrastructure_unavailable") {
    super(code === "capacity_exceeded" ? "Area reference capacity is temporarily full."
      : code === "rate_limited" ? "Too many boundary creations."
        : "Shared area reference storage is not configured.");
  }
}

export class AreaReferenceService {
  private readonly now: () => number;
  private readonly capacity: number;
  private readonly rateLimit: { limit: number; windowMs: number };

  constructor(private readonly options: {
    store: AreaReferenceStore;
    now?: () => number;
    capacity?: number;
    rateLimit?: { limit: number; windowMs: number };
  }) {
    this.now = options.now ?? Date.now;
    this.capacity = options.capacity ?? DEFAULT_CAPACITY;
    this.rateLimit = options.rateLimit ?? DEFAULT_RATE_LIMIT;
  }

  async create(geometry: AreaGeometry, displayName: string | undefined, anonymousKey: string): Promise<{ area: AreaSelection; expiresAt: number }> {
    const validation = validateEditableAreaGeometry(geometry);
    if (!validation.valid) throw new Error(`Boundary geometry rejected: ${validation.reason}`);

    const createdAt = this.now();
    const expiresAt = createdAt + AREA_REFERENCE_TTL_MS;
    const id = `user:boundary/${randomUUID()}`;
    const name = displayName?.trim() || "User-drawn area";
    const area: AreaSelection = {
      id,
      name,
      displayName: name,
      countryCode: "in",
      source: { name: "User-drawn boundary", url: "https://github.com/nirmalhk7/basera" },
      boundary: { sourceType: "user", confidence: "low", editable: true },
      geometry: canonicalAreaGeometry(geometry),
      bbox: validation.bbox,
    };
    const reference: StoredAreaReference = {
      version: AREA_REFERENCE_SCHEMA_VERSION,
      id,
      createdAt,
      expiresAt,
      checksum: checksumFor(area),
      area,
    };
    const result = await this.options.store.reserveAndSet({
      key: storageKey(id),
      value: JSON.stringify(reference),
      ttlMs: AREA_REFERENCE_TTL_MS,
      expiresAt,
      capacity: this.capacity,
      anonymousKeyHash: hashAnonymousKey(anonymousKey),
      rateLimit: this.rateLimit,
    });
    if (result !== "stored") throw new AreaReferenceError(result);
    return { area, expiresAt };
  }

  async resolve(id: string): Promise<AreaSelection | null> {
    if (!AREA_REFERENCE_ID_PATTERN.test(id)) return null;
    const raw = await this.options.store.get(storageKey(id));
    if (!raw) return null;
    const reference = parseReference(raw, id);
    if (!reference || reference.expiresAt <= this.now()) return null;
    return { ...reference.area, geometry: canonicalAreaGeometry(reference.area.geometry) };
  }
}

export function storageKey(id: string): string { return `area-reference:${id}`; }

function hashAnonymousKey(key: string): string {
  return createHash("sha256").update(key || "anonymous").digest("hex");
}

function checksumFor(area: AreaSelection): string {
  return createHash("sha256").update(JSON.stringify(area)).digest("hex");
}

function parseReference(raw: string, requestedId: string): StoredAreaReference | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const reference = value as Partial<StoredAreaReference>;
    if (reference.version !== AREA_REFERENCE_SCHEMA_VERSION || reference.id !== requestedId ||
      !Number.isFinite(reference.createdAt) || !Number.isFinite(reference.expiresAt) ||
      typeof reference.checksum !== "string" || !isStoredArea(reference.area, requestedId)) return null;
    const createdAt = reference.createdAt;
    const expiresAt = reference.expiresAt;
    if (typeof createdAt !== "number" || typeof expiresAt !== "number" ||
      expiresAt !== createdAt + AREA_REFERENCE_TTL_MS) return null;
    if (reference.checksum !== checksumFor(reference.area)) return null;
    return reference as StoredAreaReference;
  } catch {
    return null;
  }
}

function isStoredArea(value: unknown, id: string): value is AreaSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const area = value as Partial<AreaSelection>;
  return area.id === id && typeof area.name === "string" && typeof area.displayName === "string" &&
    area.countryCode === "in" && isAreaGeometry(area.geometry) && isValidBbox(area.bbox) &&
    bboxMatchesGeometry(area.bbox, area.geometry) &&
    area.boundary?.sourceType === "user" && area.boundary.confidence === "low" && area.boundary.editable === true &&
    typeof area.source?.name === "string" && typeof area.source.url === "string";
}

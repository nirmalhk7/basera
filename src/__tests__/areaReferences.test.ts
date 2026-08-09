import { describe, expect, it, vi } from "vitest";
import { AreaReferenceService } from "@/server/area-references/service";
import { resolveAreaReference } from "@/server/connectors/areaReferences";
import {
  type AreaReferenceStore,
  InMemoryAreaReferenceStore,
} from "@/server/area-references/store";
import type { AreaGeometry } from "@/types/research";

const square: AreaGeometry = {
  type: "Polygon",
  coordinates: [[[77, 28], [78, 28], [78, 29], [77, 29], [77, 28]]],
};

function service(options: {
  now?: () => number;
  capacity?: number;
  rateLimit?: { limit: number; windowMs: number };
  store?: AreaReferenceStore;
} = {}) {
  const now = options.now ?? (() => 1_000);
  return new AreaReferenceService({
    store: options.store ?? new InMemoryAreaReferenceStore({ now }),
    now,
    capacity: options.capacity,
    rateLimit: options.rateLimit,
  });
}

describe("AreaReferenceService", () => {
  it("resolves an unexpired user boundary from its opaque reference", async () => {
    const references = service();
    const created = await references.create(square, "Edited area", "visitor-a");

    await expect(references.resolve(created.area.id)).resolves.toMatchObject({
      id: created.area.id,
      displayName: "Edited area",
      geometry: square,
    });
  });

  it("returns no area after the storage TTL expires", async () => {
    let time = 1_000;
    const references = service({ now: () => time });
    const created = await references.create(square, "", "visitor-a");
    time = created.expiresAt + 1;

    await expect(references.resolve(created.area.id)).resolves.toBeNull();
  });

  it("returns no area for a missing opaque reference", async () => {
    await expect(service().resolve("user:boundary/00000000-0000-4000-8000-000000000000")).resolves.toBeNull();
  });

  it("rejects creation when the shared store is at capacity", async () => {
    const store = new InMemoryAreaReferenceStore({ now: () => 1_000 });
    const first = service({ store, capacity: 1 });
    const second = service({ store, capacity: 1 });
    await first.create(square, "First", "visitor-a");

    await expect(second.create(square, "Second", "visitor-b")).rejects.toMatchObject({ code: "capacity_exceeded" });
  });

  it("shares references between independently constructed services using one adapter", async () => {
    const store = new InMemoryAreaReferenceStore({ now: () => 1_000 });
    const writer = service({ store });
    const reader = service({ store });
    const created = await writer.create(square, "Shared", "visitor-a");

    await expect(reader.resolve(created.area.id)).resolves.toMatchObject({ displayName: "Shared" });
  });

  it("fails closed for malformed stored values", async () => {
    const store = new StaticStore("not JSON");
    await expect(service({ store }).resolve("user:boundary/00000000-0000-4000-8000-000000000000")).resolves.toBeNull();
  });

  it("fails closed when a stored checksum does not match its geometry", async () => {
    const store = new CaptureStore();
    const references = service({ store });
    const created = await references.create(square, "Untampered", "visitor-a");
    store.value = store.value!.replace("Untampered", "Tampered!");

    await expect(references.resolve(created.area.id)).resolves.toBeNull();
  });

  it("fails closed when stored timestamps extend beyond the 15-minute policy TTL", async () => {
    const store = new CaptureStore();
    const references = service({ store });
    const created = await references.create(square, "Timed", "visitor-a");
    store.value = store.value!.replace('"expiresAt":901000', '"expiresAt":9001000');

    await expect(references.resolve(created.area.id)).resolves.toBeNull();
  });

  it("atomically rate limits the same anonymous key across service instances", async () => {
    const store = new InMemoryAreaReferenceStore({ now: () => 1_000 });
    const first = service({ store, rateLimit: { limit: 1, windowMs: 60_000 } });
    const second = service({ store, rateLimit: { limit: 1, windowMs: 60_000 } });
    await first.create(square, "First", "same-visitor");

    await expect(second.create(square, "Second", "same-visitor")).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("does not require user-boundary storage to reject an invalid canonical area ID", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      await expect(resolveAreaReference("osm:relation/0")).resolves.toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

class StaticStore implements AreaReferenceStore {
  constructor(private readonly raw: string) {}
  async get(): Promise<string> { return this.raw; }
  async reserveAndSet(): Promise<"stored"> { return "stored"; }
}

class CaptureStore implements AreaReferenceStore {
  value: string | null = null;
  async get(): Promise<string | null> { return this.value; }
  async reserveAndSet(input: { value: string }): Promise<"stored"> {
    this.value = input.value;
    return "stored";
  }
}

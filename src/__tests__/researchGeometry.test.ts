import { describe, expect, it } from 'vitest';
import type { AreaGeometry } from '@/types/research';
import {
  getAreaGeometryBounds,
  isPointStrictlyInsideAreaGeometry,
  isValidAreaGeometry,
  isValidLinearRing,
} from '@/utils/researchGeometry';

const square: AreaGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0],
    ],
  ],
};

describe('research geometry', () => {
  it('validates closed, non-degenerate rings and rejects malformed geometry', () => {
    expect(isValidLinearRing(square.coordinates[0])).toBe(true);
    expect(isValidAreaGeometry(square)).toBe(true);
    expect(
      isValidAreaGeometry({
        type: 'Polygon',
        coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4]]],
      }),
    ).toBe(false);
    expect(
      isValidAreaGeometry({
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 1], [2, 2], [0, 0]]],
      }),
    ).toBe(false);
  });

  it('computes bounds across all Polygon and MultiPolygon rings', () => {
    const geometry: AreaGeometry = {
      type: 'MultiPolygon',
      coordinates: [
        square.coordinates,
        [
          [
            [10, -3],
            [12, -3],
            [12, -1],
            [10, -1],
            [10, -3],
          ],
        ],
      ],
    };

    expect(getAreaGeometryBounds(geometry)).toEqual([0, -3, 12, 4]);
    expect(
      getAreaGeometryBounds({
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 1], [2, 2], [0, 0]]],
      }),
    ).toBeNull();
  });

  it('uses strict containment: boundaries and polygon holes are excluded', () => {
    const polygonWithHole: AreaGeometry = {
      type: 'Polygon',
      coordinates: [
        square.coordinates[0],
        [
          [1, 1],
          [3, 1],
          [3, 3],
          [1, 3],
          [1, 1],
        ],
      ],
    };

    expect(isPointStrictlyInsideAreaGeometry([0.5, 0.5], polygonWithHole)).toBe(true);
    expect(isPointStrictlyInsideAreaGeometry([2, 2], polygonWithHole)).toBe(false);
    expect(isPointStrictlyInsideAreaGeometry([1, 2], polygonWithHole)).toBe(false);
    expect(isPointStrictlyInsideAreaGeometry([0, 2], polygonWithHole)).toBe(false);
  });

  it('accepts a point within any MultiPolygon member only', () => {
    const multipolygon: AreaGeometry = {
      type: 'MultiPolygon',
      coordinates: [
        square.coordinates,
        [
          [
            [10, 10],
            [12, 10],
            [12, 12],
            [10, 12],
            [10, 10],
          ],
        ],
      ],
    };

    expect(isPointStrictlyInsideAreaGeometry([11, 11], multipolygon)).toBe(true);
    expect(isPointStrictlyInsideAreaGeometry([8, 8], multipolygon)).toBe(false);
  });
});

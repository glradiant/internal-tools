import { describe, it, expect } from 'vitest';
import { distToSegment, closestOnSegment, segmentAngleDeg, dimensionLabelData, polarToCartesian } from './geometry';

describe('distToSegment', () => {
  it('returns 0 for a point on the segment', () => {
    expect(distToSegment(5, 0, 0, 0, 10, 0)).toBe(0);
  });

  it('returns perpendicular distance for a point off segment', () => {
    expect(distToSegment(5, 3, 0, 0, 10, 0)).toBe(3);
  });

  it('returns distance to nearest endpoint when beyond segment', () => {
    expect(distToSegment(15, 0, 0, 0, 10, 0)).toBe(5);
  });

  it('handles zero-length segment', () => {
    expect(distToSegment(3, 4, 0, 0, 0, 0)).toBe(5);
  });
});

describe('closestOnSegment', () => {
  it('returns correct point on horizontal segment', () => {
    const result = closestOnSegment(5, 3, 0, 0, 10, 0);
    expect(result.x).toBe(5);
    expect(result.y).toBe(0);
    expect(result.t).toBe(0.5);
  });

  it('clamps to segment bounds', () => {
    const result = closestOnSegment(15, 0, 0, 0, 10, 0);
    expect(result.t).toBe(1);
    expect(result.x).toBe(10);
  });
});

describe('segmentAngleDeg', () => {
  it('returns 0 for rightward segment', () => {
    expect(segmentAngleDeg(0, 0, 10, 0)).toBe(0);
  });

  it('returns 90 for downward segment (SVG coords)', () => {
    expect(segmentAngleDeg(0, 0, 0, 10)).toBe(90);
  });

  it('returns -90 for upward segment (SVG coords)', () => {
    expect(segmentAngleDeg(0, 0, 0, -10)).toBe(-90);
  });
});

describe('dimensionLabelData', () => {
  it('returns null for zero-length segment', () => {
    expect(dimensionLabelData(5, 5, 5, 5, 20)).toBeNull();
  });

  it('calculates correct feet for horizontal segment', () => {
    const result = dimensionLabelData(0, 0, 200, 0, 20);
    expect(result.ft).toBe(10);
    expect(result.mx).toBe(100);
    expect(result.my).toBe(0);
  });

  it('computes outward normal', () => {
    const result = dimensionLabelData(0, 0, 100, 0, 20);
    expect(result.nx).toBeCloseTo(0);
    expect(result.ny).toBeCloseTo(1);
  });
});

describe('polarToCartesian', () => {
  it('computes correct point at 0 degrees', () => {
    const result = polarToCartesian(0, 0, 100, 0);
    expect(result.x).toBeCloseTo(100);
    expect(result.y).toBeCloseTo(0);
  });

  it('computes correct point at 90 degrees (north in SVG)', () => {
    const result = polarToCartesian(0, 0, 100, 90);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(-100);
  });
});

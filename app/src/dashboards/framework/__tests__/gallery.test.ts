import { describe, it, expect } from 'vitest';
import { tileData, sortByBlurbLength } from '../gallery';
import { DASHBOARD_CATALOG } from '../registry';

describe('tileData', () => {
  it('returns one tile per catalog entry', () => {
    const tiles = tileData(DASHBOARD_CATALOG);
    expect(tiles).toHaveLength(DASHBOARD_CATALOG.length);
  });

  it('preserves id, icon, title and data-class from the catalog', () => {
    const tiles = tileData(DASHBOARD_CATALOG);
    const exec = tiles.find((t) => t.id === 'executive');
    expect(exec).toBeDefined();
    expect(exec!.icon).toBe('📊');
    expect(exec!.title).toBe('Executive Overview');
    expect(exec!.dataClass).toBe('DAILY');
  });

  it('maps each present data-class to a badge CSS class', () => {
    const tiles = tileData(DASHBOARD_CATALOG);
    const byClass = new Map(tiles.map((t) => [t.dataClass, t.badgeCls]));
    expect(byClass.get('DAILY')).toBe('dc-daily');
    expect(byClass.get('LIVE')).toBe('dc-live');
    expect(byClass.get('ANNUAL')).toBe('dc-annual');
    expect(byClass.get('UNAVAILABLE')).toBe('dc-unavailable');
  });

  it('classic-analytics is no longer SAMPLE — it is real DAILY data', () => {
    const tiles = tileData(DASHBOARD_CATALOG);
    const classic = tiles.find((t) => t.id === 'classic-analytics');
    expect(classic).toBeDefined();
    expect(classic!.dataClass).toBe('DAILY');
    expect(classic!.badgeCls).toBe('dc-daily');
    // No dashboard in the catalog is illustrative SAMPLE any more.
    const sampleDashboards = tiles.filter((t) => t.dataClass === 'SAMPLE');
    expect(sampleDashboards).toEqual([]);
  });

  it('statusHint matches the data-class label', () => {
    const tiles = tileData(DASHBOARD_CATALOG);
    const vessel = tiles.find((t) => t.id === 'vessel');
    expect(vessel!.statusHint).toBe('Unavailable');
    const weather = tiles.find((t) => t.id === 'weather');
    expect(weather!.statusHint).toBe('Daily');
    const chokepoints = tiles.find((t) => t.id === 'chokepoints');
    expect(chokepoints!.statusHint).toBe('Live');
  });

  it('every tile has a concrete blurb (no generic placeholder)', () => {
    const tiles = tileData(DASHBOARD_CATALOG);
    for (const t of tiles) {
      expect(t.blurb.length).toBeGreaterThan(20);
      expect(t.blurb.toLowerCase()).not.toContain('lorem');
      expect(t.blurb.toLowerCase()).not.toContain('todo');
    }
  });
});

describe('sortByBlurbLength', () => {
  it('sorts tiles by blurb length descending', () => {
    const tiles = tileData(DASHBOARD_CATALOG);
    const sorted = sortByBlurbLength(tiles);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1]!.blurb.length).toBeGreaterThanOrEqual(sorted[i]!.blurb.length);
    }
  });

  it('does not mutate the input', () => {
    const tiles = tileData(DASHBOARD_CATALOG);
    const snapshot = tiles.map((t) => t.id);
    sortByBlurbLength(tiles);
    expect(tiles.map((t) => t.id)).toEqual(snapshot);
  });
});

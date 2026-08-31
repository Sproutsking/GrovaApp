import { SPORTS_SECTION_OPTIONS } from './sportsSectionModel';

describe('sportsSectionModel', () => {
  it('exposes the three required sports sections', () => {
    expect(SPORTS_SECTION_OPTIONS.map((entry) => entry.id)).toEqual(['fixtures', 'live', 'score']);
    expect(SPORTS_SECTION_OPTIONS.every((entry) => entry.label && entry.title)).toBe(true);
  });
});

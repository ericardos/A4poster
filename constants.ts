
export const PAPER_SIZES = {
  a4: { width: 210, height: 297 },
  a3: { width: 297, height: 420 },
  letter: { width: 215.9, height: 279.4 }
};

export const DEFAULT_SETTINGS = {
  rows: 2,
  cols: 2,
  overlapMm: 5,
  paperSize: 'a4' as const,
  orientation: 'portrait' as const
};

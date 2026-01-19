
export interface TileSettings {
  rows: number;
  cols: number;
  overlapMm: number;
  paperSize: 'a4' | 'a3' | 'letter';
  orientation: 'portrait' | 'landscape';
}

export interface ImageMetadata {
  width: number;
  height: number;
  aspectRatio: number;
  src: string;
}

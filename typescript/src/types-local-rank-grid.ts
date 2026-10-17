/**
 * Local rank grid types (GAP-150) — geo-grid ORGANIC-rank tracking with
 * heatmap output. See the REST route's own docs for the honest scope:
 * organic rank (not local-pack), a fixed 3x3 grid for now, manual trigger
 * only.
 */

export interface CreateLocalRankGridConfigInput {
  projectId: string;
  domain: string;
  keyword: string;
  centerLat: number;
  centerLng: number;
  /** What the center point was called when chosen — a heatmap with no
   *  stated center is a claim about an unspecified place. */
  centerLabel: string;
  /** Distance between adjacent grid points, in km (0.5-25). */
  spacingKm: number;
  languageCode?: string;
}

export interface LocalRankGridConfig {
  id: string;
  projectId: string;
  domain: string;
  keyword: string;
  centerLat: number;
  centerLng: number;
  centerLabel: string;
  /** Points per side of the grid. Currently always 3. */
  gridSize: number;
  spacingKm: number;
  languageCode: string;
  createdAt: string;
}

export interface LocalRankGridConfigsResponse {
  configs: LocalRankGridConfig[];
}

export interface LocalRankGridRun {
  id: string;
  configId: string;
  status: "running" | "completed" | "failed";
  pointsTotal: number;
  pointsChecked: number;
  startedAt: string;
  completedAt: string | null;
}

export interface LocalRankGridPoint {
  id: string;
  runId: string;
  rowIndex: number;
  colIndex: number;
  lat: number;
  lng: number;
  /** The "City,Region,Country"-shaped canonical string reverse-geocoded
   *  for this point and sent to openserp as the location hint. NULL means
   *  reverse geocoding found no usable place name — the check still ran,
   *  but with NO location override applied. */
  resolvedLocationLabel: string | null;
  /** ORGANIC rank only — null means not found within the depth searched. */
  position: number | null;
  url: string | null;
  checkedAt: string | null;
}

export interface LocalRankGridRunResult {
  run: LocalRankGridRun | null;
  points: LocalRankGridPoint[];
}

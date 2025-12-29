export interface ElectionResult {
  municipality_name: string;
  total_valid: number;
  total: number;
  eligible_voters: number;
  activity: string; // or number if parsed
  results: Record<string, number>; // Party name -> Votes
}

export interface Party {
  id: string;
  name: string;
  color?: string; // Optional for future use
}

export interface MunicipalityFeature {
  type: "Feature";
  properties: {
    name: string;
    nuts3?: string;
    nuts4?: string;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
}

export interface MunicipalityGeoJSON {
  type: "FeatureCollection";
  features: MunicipalityFeature[];
}

export interface MunicipalityData extends MunicipalityFeature {
  electionData?: {
    totalVotes: number;
    activity: number;
    eligibleVoters?: number;
    topParties:Array<{ party: string; votes: number; percentage: number }>;
  };
}


export interface Place {
  type: "Feature";
  properties: {
    ekatte: string;
    name: string;
    oblast: string;
    obshtina: string;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon" | "Point";
    coordinates: number[][][] | number[][][][] | number[];
  };
  electionData?: {
    totalVotes: number;
    activity: number;
    eligibleVoters?: number;
    topParties: Array<{ party: string; votes: number; percentage: number }>;
  };
}

export interface PlaceGeoJSON {
  type: "FeatureCollection";
  features: Place[];
}

export type SelectedRegion = MunicipalityData | Place;

export type ViewMode = 'map' | 'table' | 'visualization' | 'anomalies';

/**
 * Client API for the real-estate demo screens (live sales board, AI advisor
 * brief). Server: aspect-agent-server/agents/realestate/routes.js.
 */
import { apiRequest, getBaseURL } from './api';

// In dev the Vite proxy serves /api. Not '' — apiRequest treats an empty base
// as "none" and falls back to the production server.
const BASE = import.meta.env.DEV ? window.location.origin : getBaseURL();

export type UnitStatus = 'נמכרה' | 'שמורה' | 'פנויה';

export interface BoardUnit {
  id: number;
  floor: number;
  position: number;
  number: number;
  rooms: number;
  type: string;
  sqm: number;
  outdoorSqm: number;
  direction: string;
  view: string;
  price: number;
  status: UnitStatus;
  stuck: boolean;
  daysOnMarket: number;
  /** % above what the same kind of unit sold for in the project (unsold units over 180 days only). */
  premiumPct: number | null;
}

export interface BoardBuilding {
  building: number;
  pctSold: number;
  units: BoardUnit[];
}

export interface BoardProject {
  id: number;
  name: string;
  city: string;
  region: string;
  floors: number;
  totalUnits: number;
  sold: number;
  reserved: number;
  free: number;
  pctSold: number;
  monthlyPace: number;
  sellOutDate: string | null;
  buildings: BoardBuilding[];
}

export interface BoardData {
  date: string;
  kpis: { totalUnits: number; soldUnits: number; pctSold: number; soldLast30Days: number };
  projects: BoardProject[];
  insights: { id: string; title: string; headline: string }[];
}

export interface BriefData {
  date: string;
  intro: string;
  kpis: {
    calls: { count: number; sub: string };
    stuck: { count: number; sub: string };
    leakage: { amount: string; sub: string };
  };
  calls: { leadId: number; name: string; phone: string; project: string; rep: string; score: number; daysWithoutContact: number; reason: string }[];
  stuck: { unitId: number; projectId: number; project: string; city: string; building: number; floor: number; number: number; rooms: number; type: string; direction: string; price: number; daysOnMarket: number; premiumPct: number; reason: string; action: string }[];
  leakage: { amount: string; amountSub: string; bullets: string[]; reps: { name: string; avgDiscountPct: number; aboveAvg: number }[] };
}

export const realestateService = {
  getBoard: () => apiRequest<BoardData>('/api/realestate/board', {}, BASE),
  getBrief: () => apiRequest<BriefData>('/api/realestate/brief', {}, BASE),
};

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";

// Flightradar24 real, official commercial API.
// Base URL and contract confirmed against FR24's own `@flightradar24/fr24api-mcp`
// reference implementation (https://github.com/Flightradar24/fr24api-mcp) and the
// public docs at https://fr24api.flightradar24.com/docs/endpoints/overview and
// https://fr24api.flightradar24.com/docs/credit-overview.
export const ENDPOINTS = {
  LIVE_POSITIONS_LIGHT: '/live/flight-positions/light',
  LIVE_POSITIONS_FULL: '/live/flight-positions/full',
  LIVE_POSITIONS_COUNT: '/live/flight-positions/count',
  HISTORIC_POSITIONS_LIGHT: '/historic/flight-positions/light',
  HISTORIC_POSITIONS_FULL: '/historic/flight-positions/full',
  HISTORIC_POSITIONS_COUNT: '/historic/flight-positions/count',
  FLIGHT_SUMMARY_LIGHT: '/flight-summary/light',
  FLIGHT_SUMMARY_FULL: '/flight-summary/full',
  FLIGHT_SUMMARY_COUNT: '/flight-summary/count',
  FLIGHT_TRACKS: '/flight-tracks',
  AIRLINE_INFO: (icao: string) => `/static/airlines/${icao}/light`,
  AIRPORT_INFO: (code: string, detail: 'light' | 'full') => `/static/airports/${code}/${detail}`,
  USAGE: '/usage',
};

// Error messages
const ERROR_MESSAGES = {
  MISSING_API_KEY: 'Flightradar24 API key is required',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded for Flightradar24 API',
  INVALID_API_KEY: 'Invalid or missing Flightradar24 API key (FR24_API_KEY)',
  INSUFFICIENT_CREDITS: 'Flightradar24 API account has insufficient credits for this request',
  API_ERROR: 'Flightradar24 API error',
  NETWORK_ERROR: 'Network error while connecting to Flightradar24 API',
};

// --- Shared filter params accepted by live/historic position queries ---
// Field names and semantics match the FR24 API exactly (see docs: Live Flight
// Positions / Historic Flight Positions). All values are comma-separated
// strings on the wire; `bounds` is "north,south,west,east".
export interface FlightPositionFilterParams {
  bounds?: string;
  flights?: string;
  callsigns?: string;
  registrations?: string;
  painted_as?: string;
  operating_as?: string;
  airports?: string;
  routes?: string;
  aircraft?: string;
  altitude_ranges?: string;
  squawks?: string;
  categories?: string;
  data_sources?: string;
  airspaces?: string;
  gspeed?: string;
  limit?: number;
}

export interface HistoricFlightPositionFilterParams extends FlightPositionFilterParams {
  timestamp: number; // required
}

export interface FlightSummaryFilterParams {
  flight_ids?: string;
  flight_datetime_from?: string; // required by the API, ISO 8601
  flight_datetime_to?: string; // required by the API, ISO 8601
  flights?: string;
  callsigns?: string;
  registrations?: string;
  painted_as?: string;
  operating_as?: string;
  airports?: string;
  routes?: string;
  aircraft?: string;
  sort?: 'asc' | 'desc';
  limit?: number;
}

// --- Response shapes (as returned by the FR24 API) ---

export interface FlightPositionLight {
  fr24_id: string;
  hex: string;
  callsign: string;
  lat: number;
  lon: number;
  track: number;
  alt: number;
  gspeed: number;
  vspeed: number;
  squawk: string;
  timestamp: string; // ISO 8601
  source: string; // ADSB, MLAT, ESTIMATED
}

export interface FlightPositionFull extends FlightPositionLight {
  flight: string;
  type: string;
  reg: string;
  painted_as: string;
  operating_as: string;
  orig_iata: string;
  orig_icao: string;
  dest_iata: string;
  dest_icao: string;
  eta: string; // ISO 8601
}

export interface RecordCountResponse {
  record_count: number;
}

export interface FlightSummaryLight {
  fr24_id: string;
  flight: string | null;
  callsign: string | null;
  operating_as: string | null;
  painted_as: string | null;
  type: string | null;
  reg: string | null;
  orig_icao: string | null;
  datetime_takeoff: string | null;
  dest_icao: string | null;
  dest_icao_actual: string | null;
  datetime_landed: string | null;
  hex: string | null;
  first_seen: string | null;
  last_seen: string | null;
  flight_ended?: boolean | null;
}

export interface FlightSummaryFull extends FlightSummaryLight {
  orig_iata: string | null;
  runway_takeoff: string | null;
  dest_iata: string | null;
  dest_iata_actual: string | null;
  runway_landed: string | null;
  flight_time: number | null;
  actual_distance: number | null;
  circle_distance: number | null;
  category: string | null;
}

export interface FlightTrackPoint {
  timestamp: string;
  lat: number;
  lon: number;
  alt: number;
  gspeed: number;
  vspeed: number;
  track: number;
  squawk: string;
  callsign: string;
  source: string;
}

export interface FlightTracksResponse {
  fr24_id: string;
  tracks: FlightTrackPoint[];
}

export interface AirlineInfo {
  icao: string;
  iata: string;
  name: string;
}

export interface AirportInfoLight {
  name: string;
  iata: string;
  icao: string;
}

export interface AirportInfoFull {
  name: string;
  iata: string;
  icao: string;
  lon: number;
  lat: number;
  elevation: number;
  country: { code: string; name: string };
  city: string;
  state: string | null;
  timezone: { name: string; offset: number };
}

export interface UsageEntry {
  endpoint: string;
  request_count: number;
  credits: number;
}

export class Flightradar24ApiClient {
  private axiosInstance: AxiosInstance;
  private apiKey: string;
  private baseUrl: string = 'https://fr24api.flightradar24.com/api';
  private retryDelay: number = 1000; // Initial retry delay in ms
  private maxRetries: number = 3;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new ProtocolError(ProtocolErrorCode.InvalidParams, ERROR_MESSAGES.MISSING_API_KEY);
    }

    this.apiKey = apiKey;
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
        // Required on every request per the FR24 API docs; pins us to the v1
        // response contract so the API can evolve without silently breaking us.
        'Accept-Version': 'v1',
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });
  }

  /**
   * Make an API request with retry logic for rate limiting.
   */
  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, any> = {},
    retryCount: number = 0
  ): Promise<T> {
    try {
      // Drop null/undefined/empty-string params so we don't send e.g. "flights="
      const cleanedParams: Record<string, any> = {};
      for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined && value !== '') {
          cleanedParams[key] = value;
        }
      }

      const config: AxiosRequestConfig = { params: cleanedParams };
      const response: AxiosResponse = await this.axiosInstance.get(endpoint, config);
      return this.unwrap<T>(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        // Handle rate limiting (429 Too Many Requests)
        if (axiosError.response?.status === 429 && retryCount < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, retryCount);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.makeRequest(endpoint, params, retryCount + 1);
        }

        // Handle authentication errors
        if (axiosError.response?.status === 401) {
          throw new ProtocolError(ProtocolErrorCode.InvalidRequest, ERROR_MESSAGES.INVALID_API_KEY);
        }

        // Handle out-of-credits errors
        if (axiosError.response?.status === 402) {
          throw new ProtocolError(ProtocolErrorCode.InvalidRequest, ERROR_MESSAGES.INSUFFICIENT_CREDITS);
        }

        if (axiosError.response?.status === 429) {
          throw new ProtocolError(ProtocolErrorCode.InternalError, ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
        }

        // Handle other API errors
        if (axiosError.response) {
          throw new ProtocolError(
            ProtocolErrorCode.InternalError,
            `${ERROR_MESSAGES.API_ERROR}: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`
          );
        } else {
          throw new ProtocolError(ProtocolErrorCode.InternalError, ERROR_MESSAGES.NETWORK_ERROR);
        }
      }

      // Re-throw other errors (e.g. ProtocolError from above)
      throw error;
    }
  }

  /**
   * The FR24 API wraps list results as `{ data: [...] }`, returns count
   * endpoints as a bare `{ record_count: N }` object, and returns single
   * objects (airline/airport info, flight tracks) directly. Normalize all
   * three shapes to whatever the caller actually wants.
   */
  private unwrap<T>(data: any): T {
    if (data && Array.isArray(data.data)) {
      return data.data as T;
    }
    return data as T;
  }

  // --- Live flight positions ---

  async getLiveFlightPositionsLight(params: FlightPositionFilterParams): Promise<FlightPositionLight[]> {
    return this.makeRequest<FlightPositionLight[]>(ENDPOINTS.LIVE_POSITIONS_LIGHT, params);
  }

  async getLiveFlightPositionsFull(params: FlightPositionFilterParams): Promise<FlightPositionFull[]> {
    return this.makeRequest<FlightPositionFull[]>(ENDPOINTS.LIVE_POSITIONS_FULL, params);
  }

  async getLiveFlightPositionsCount(params: FlightPositionFilterParams): Promise<RecordCountResponse> {
    return this.makeRequest<RecordCountResponse>(ENDPOINTS.LIVE_POSITIONS_COUNT, params);
  }

  // --- Historic flight positions ---

  async getHistoricFlightPositionsLight(params: HistoricFlightPositionFilterParams): Promise<FlightPositionLight[]> {
    return this.makeRequest<FlightPositionLight[]>(ENDPOINTS.HISTORIC_POSITIONS_LIGHT, params);
  }

  async getHistoricFlightPositionsFull(params: HistoricFlightPositionFilterParams): Promise<FlightPositionFull[]> {
    return this.makeRequest<FlightPositionFull[]>(ENDPOINTS.HISTORIC_POSITIONS_FULL, params);
  }

  async getHistoricFlightPositionsCount(params: HistoricFlightPositionFilterParams): Promise<RecordCountResponse> {
    return this.makeRequest<RecordCountResponse>(ENDPOINTS.HISTORIC_POSITIONS_COUNT, params);
  }

  // --- Flight summary (takeoff/landing history) ---

  async getFlightSummaryLight(params: FlightSummaryFilterParams): Promise<FlightSummaryLight[]> {
    return this.makeRequest<FlightSummaryLight[]>(ENDPOINTS.FLIGHT_SUMMARY_LIGHT, params);
  }

  async getFlightSummaryFull(params: FlightSummaryFilterParams): Promise<FlightSummaryFull[]> {
    return this.makeRequest<FlightSummaryFull[]>(ENDPOINTS.FLIGHT_SUMMARY_FULL, params);
  }

  async getFlightSummaryCount(params: Omit<FlightSummaryFilterParams, 'sort' | 'limit'>): Promise<RecordCountResponse> {
    return this.makeRequest<RecordCountResponse>(ENDPOINTS.FLIGHT_SUMMARY_COUNT, params);
  }

  // --- Flight tracks ---

  async getFlightTracks(flightId: string): Promise<FlightTracksResponse[]> {
    return this.makeRequest<FlightTracksResponse[]>(ENDPOINTS.FLIGHT_TRACKS, { flight_id: flightId });
  }

  // --- Static reference data ---

  async getAirlineInfo(icao: string): Promise<AirlineInfo> {
    const data = await this.makeRequest<AirlineInfo>(ENDPOINTS.AIRLINE_INFO(icao));
    if (!data || !data.icao) {
      throw new ProtocolError(ProtocolErrorCode.InvalidRequest, `No airline data found for ICAO code: ${icao}`);
    }
    return data;
  }

  async getAirportInfo(code: string, detail: 'light' | 'full' = 'full'): Promise<AirportInfoLight | AirportInfoFull> {
    const data = await this.makeRequest<AirportInfoLight | AirportInfoFull>(ENDPOINTS.AIRPORT_INFO(code, detail));
    if (!data || !data.icao) {
      throw new ProtocolError(ProtocolErrorCode.InvalidRequest, `No airport data found for code: ${code}`);
    }
    return data;
  }

  // --- Usage / credits ---

  async getUsage(): Promise<UsageEntry[]> {
    return this.makeRequest<UsageEntry[]>(ENDPOINTS.USAGE);
  }
}

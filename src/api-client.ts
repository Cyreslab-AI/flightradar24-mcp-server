import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

// Flightradar24 API endpoints
export const ENDPOINTS = {
  FLIGHT_DATA: '/flights',
  FLIGHT_INFO: '/flight/info',
  AIRPORT_DATA: '/airports',
  AIRLINE_DATA: '/airlines',
  AIRCRAFT_DATA: '/aircraft',
  ZONES: '/zones',
};

// Error messages
const ERROR_MESSAGES = {
  MISSING_API_KEY: 'Flightradar24 API key is required',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded for Flightradar24 API',
  INVALID_API_KEY: 'Invalid Flightradar24 API key',
  API_ERROR: 'Flightradar24 API error',
  NETWORK_ERROR: 'Network error while connecting to Flightradar24 API',
};

// Interface for flight data
export interface FlightData {
  flight: string;
  lat: number;
  lng: number;
  alt: number;
  speed: number;
  heading: number;
  aircraft: string;
  registration: string;
  origin: string;
  destination: string;
  callsign: string;
  airline: string;
  time: number;
  status: string;
}

// Interface for flight details
export interface FlightDetails {
  identification: {
    id: string;
    callsign: string;
    number: {
      default: string;
      alternative?: string;
    };
  };
  status: {
    live: boolean;
    text: string;
    icon: string;
    estimated?: boolean;
    ambiguous?: boolean;
    generic?: {
      status: {
        text: string;
        color: string;
        type: string;
      };
      eventTime: {
        utc?: number;
        local?: number;
      };
    };
  };
  aircraft: {
    model: {
      code: string;
      text: string;
    };
    registration: string;
    images?: {
      thumbnails: {
        src: string;
        link: string;
        copyright: string;
        source: string;
      }[];
    };
  };
  airline: {
    name: string;
    code: {
      iata: string;
      icao: string;
    };
  };
  airport: {
    origin: {
      name: string;
      code: {
        iata: string;
        icao: string;
      };
      position: {
        latitude: number;
        longitude: number;
        altitude: number;
        country: {
          name: string;
          code: string;
        };
        region: {
          city: string;
        };
      };
      timezone: {
        name: string;
        offset: number;
        abbr: string;
      };
      visible: boolean;
    };
    destination: {
      name: string;
      code: {
        iata: string;
        icao: string;
      };
      position: {
        latitude: number;
        longitude: number;
        altitude: number;
        country: {
          name: string;
          code: string;
        };
        region: {
          city: string;
        };
      };
      timezone: {
        name: string;
        offset: number;
        abbr: string;
      };
      visible: boolean;
    };
  };
  time: {
    scheduled: {
      departure: number;
      arrival: number;
    };
    real: {
      departure?: number;
      arrival?: number;
    };
    estimated: {
      departure?: number;
      arrival?: number;
    };
    other: {
      eta?: number;
      updated?: number;
    };
  };
  trail?: {
    lat: number;
    lng: number;
    alt: number;
    spd: number;
    ts: number;
    hd: number;
  }[];
}

// Interface for airport data
export interface AirportData {
  name: string;
  iata: string;
  icao: string;
  lat: number;
  lng: number;
  country: string;
  alt: number;
}

// Interface for airline data
export interface AirlineData {
  name: string;
  code: {
    iata: string;
    icao: string;
  };
  country: string;
}

// Interface for aircraft data
export interface AircraftData {
  registration: string;
  type: string;
  manufacturer: string;
  model: string;
  owner: string;
  operator: string;
  age: number;
  msn: string;
}

// Interface for flight search parameters
export interface FlightSearchParams {
  airline_iata?: string;
  airline_icao?: string;
  flight_number?: string;
  flight_iata?: string;
  flight_icao?: string;
  registration?: string;
  bounds?: {
    north: number;
    south: number;
    west: number;
    east: number;
  };
  limit?: number;
}

// Interface for airport search parameters
export interface AirportSearchParams {
  iata?: string;
  icao?: string;
  name?: string;
  country?: string;
  limit?: number;
}

export class Flightradar24ApiClient {
  private axiosInstance: AxiosInstance;
  private apiKey: string;
  private baseUrl: string = 'https://api.flightradar24.com/v1';
  private retryDelay: number = 1000; // Initial retry delay in ms
  private maxRetries: number = 3;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new McpError(ErrorCode.InvalidParams, ERROR_MESSAGES.MISSING_API_KEY);
    }

    this.apiKey = apiKey;
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Make an API request with retry logic for rate limiting
   */
  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, any> = {},
    retryCount: number = 0
  ): Promise<T> {
    try {
      const config: AxiosRequestConfig = {
        params,
      };

      const response: AxiosResponse = await this.axiosInstance.get(endpoint, config);
      return response.data as T;
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
          throw new McpError(ErrorCode.InvalidRequest, ERROR_MESSAGES.INVALID_API_KEY);
        }

        // Handle other API errors
        if (axiosError.response) {
          throw new McpError(
            ErrorCode.InternalError,
            `${ERROR_MESSAGES.API_ERROR}: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`
          );
        } else {
          throw new McpError(ErrorCode.InternalError, ERROR_MESSAGES.NETWORK_ERROR);
        }
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Get flight data for a specific flight
   */
  async getFlightData(flightId: string): Promise<FlightDetails> {
    const endpoint = `${ENDPOINTS.FLIGHT_INFO}/${flightId}`;
    const response = await this.makeRequest<{ result: FlightDetails }>(endpoint);

    if (!response || !response.result) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `No flight data found for flight ID: ${flightId}`
      );
    }

    return response.result;
  }

  /**
   * Search for flights based on various parameters
   */
  async searchFlights(params: FlightSearchParams): Promise<FlightData[]> {
    const endpoint = ENDPOINTS.FLIGHT_DATA;
    const response = await this.makeRequest<{ result: { response: { flights: FlightData[] } } }>(endpoint, params);

    if (!response || !response.result || !response.result.response || !response.result.response.flights) {
      return [];
    }

    return response.result.response.flights;
  }

  /**
   * Get airport data
   */
  async getAirportData(airportCode: string): Promise<AirportData> {
    const isIATA = airportCode.length === 3;
    const params = isIATA ? { iata: airportCode } : { icao: airportCode };

    const endpoint = ENDPOINTS.AIRPORT_DATA;
    const response = await this.makeRequest<{ result: { response: { airport: AirportData } } }>(endpoint, params);

    if (!response || !response.result || !response.result.response || !response.result.response.airport) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `No airport data found for airport code: ${airportCode}`
      );
    }

    return response.result.response.airport;
  }

  /**
   * Search for airports
   */
  async searchAirports(params: AirportSearchParams): Promise<AirportData[]> {
    const endpoint = ENDPOINTS.AIRPORT_DATA;
    const response = await this.makeRequest<{ result: { response: { airports: AirportData[] } } }>(endpoint, params);

    if (!response || !response.result || !response.result.response || !response.result.response.airports) {
      return [];
    }

    return response.result.response.airports;
  }

  /**
   * Get airline data
   */
  async getAirlineData(airlineCode: string): Promise<AirlineData> {
    const isIATA = airlineCode.length === 2;
    const params = isIATA ? { iata: airlineCode } : { icao: airlineCode };

    const endpoint = ENDPOINTS.AIRLINE_DATA;
    const response = await this.makeRequest<{ result: { response: { airline: AirlineData } } }>(endpoint, params);

    if (!response || !response.result || !response.result.response || !response.result.response.airline) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `No airline data found for airline code: ${airlineCode}`
      );
    }

    return response.result.response.airline;
  }

  /**
   * Get aircraft data
   */
  async getAircraftData(registration: string): Promise<AircraftData> {
    const endpoint = `${ENDPOINTS.AIRCRAFT_DATA}/${registration}`;
    const response = await this.makeRequest<{ result: { response: { aircraft: AircraftData } } }>(endpoint);

    if (!response || !response.result || !response.result.response || !response.result.response.aircraft) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `No aircraft data found for registration: ${registration}`
      );
    }

    return response.result.response.aircraft;
  }

  /**
   * Get flights in a specific zone (geographic area)
   */
  async getFlightsInZone(bounds: { north: number; south: number; west: number; east: number }): Promise<FlightData[]> {
    const endpoint = ENDPOINTS.ZONES;
    const params = {
      bounds: `${bounds.north},${bounds.south},${bounds.west},${bounds.east}`,
    };

    const response = await this.makeRequest<{ result: { response: { flights: FlightData[] } } }>(endpoint, params);

    if (!response || !response.result || !response.result.response || !response.result.response.flights) {
      return [];
    }

    return response.result.response.flights;
  }
}

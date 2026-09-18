import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { Flightradar24ApiClient, FlightSummaryFilterParams, FlightSummaryFull, FlightSummaryLight } from '../api-client.js';

// New tool: this endpoint has no legacy equivalent, but it is the real API's
// only way to get takeoff/landing history for a flight, which the old
// `get_flight_data` tool used to approximate via scheduled/estimated times
// that do not exist in the real FR24 API. Added to keep overall capability
// parity with the legacy server.
export const getFlightSummaryToolSchema = {
  name: 'get_flight_summary',
  description:
    'Get takeoff/landing history (flight summary) for flights in a date/time window, optionally filtered by ' +
    'flight number, callsign, registration, airport, route, or aircraft type. Covers completed flights; use ' +
    'get_flight_data for flights currently in the air.',
  inputSchema: {
    type: 'object',
    properties: {
      flight_datetime_from: {
        type: 'string',
        description: 'Start of the datetime window, ISO 8601 (e.g., \'2024-01-01T00:00:00Z\').',
      },
      flight_datetime_to: {
        type: 'string',
        description: 'End of the datetime window, ISO 8601 (e.g., \'2024-01-02T00:00:00Z\'). The window can span at most 14 days.',
      },
      flight_number: {
        type: 'string',
        description: 'Flight number(s), comma-separated (e.g., \'BA123\'). Max 15.',
      },
      registration: {
        type: 'string',
        description: 'Aircraft registration(s), comma-separated. Max 15.',
      },
      route: {
        type: 'string',
        description: 'Route(s) between airports or countries, comma-separated (e.g., \'JFK-LAX\'). Max 15.',
      },
      airline_icao: {
        type: 'string',
        description: 'ICAO airline code the aircraft is operating as, comma-separated. Max 15.',
      },
      sort: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort order by datetime.',
      },
      detail_level: {
        type: 'string',
        enum: ['light', 'full'],
        description: 'Amount of detail to return. "light" (default) covers the essentials and costs fewer FR24 API credits; "full" adds runway, distance, and flight-time data.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10, max: 20000).',
        minimum: 1,
        maximum: 20000,
      },
    },
    required: ['flight_datetime_from', 'flight_datetime_to'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      query: { type: 'object' },
      flights: { type: 'array', items: { type: 'object' } },
      count: { type: 'number' },
      message: { type: 'string' },
      timestamp: { type: 'string' },
    },
    required: ['query', 'flights', 'count', 'timestamp'],
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  },
};

export async function getFlightSummaryTool(
  apiClient: Flightradar24ApiClient,
  args: {
    flight_datetime_from: string;
    flight_datetime_to: string;
    flight_number?: string;
    registration?: string;
    route?: string;
    airline_icao?: string;
    sort?: 'asc' | 'desc';
    detail_level?: 'light' | 'full';
    limit?: number;
  }
) {
  try {
    if (!args.flight_datetime_from || !args.flight_datetime_to) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        'Both flight_datetime_from and flight_datetime_to are required.'
      );
    }

    const detailLevel = args.detail_level || 'light';
    const limit = args.limit || 10;

    const filterParams: FlightSummaryFilterParams = {
      flight_datetime_from: args.flight_datetime_from,
      flight_datetime_to: args.flight_datetime_to,
      flights: args.flight_number,
      registrations: args.registration,
      routes: args.route,
      operating_as: args.airline_icao,
      sort: args.sort,
      limit,
    };

    const summaries = detailLevel === 'full'
      ? await apiClient.getFlightSummaryFull(filterParams)
      : await apiClient.getFlightSummaryLight(filterParams);

    if (!summaries || summaries.length === 0) {
      const result = {
        query: args,
        flights: [],
        count: 0,
        message: 'No flights found matching the search criteria.',
        timestamp: new Date().toISOString(),
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
      };
    }

    const result = {
      query: args,
      flights: summaries.map(formatSummary),
      count: summaries.length,
      timestamp: new Date().toISOString(),
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
      structuredContent: result,
    };
  } catch (error) {
    if (error instanceof ProtocolError) {
      throw error;
    }

    throw new ProtocolError(
      ProtocolErrorCode.InternalError,
      `Error retrieving flight summary: ${(error as Error).message}`
    );
  }
}

function formatSummary(summary: FlightSummaryLight | FlightSummaryFull) {
  const full = summary as FlightSummaryFull;
  return {
    fr24_id: summary.fr24_id,
    flight_number: summary.flight,
    callsign: summary.callsign,
    operating_as: summary.operating_as,
    painted_as: summary.painted_as,
    aircraft_type: summary.type,
    registration: summary.reg,
    origin: { icao: summary.orig_icao, iata: full.orig_iata },
    destination: { icao: summary.dest_icao, iata: full.dest_iata, icao_actual: summary.dest_icao_actual, iata_actual: full.dest_iata_actual },
    datetime_takeoff: summary.datetime_takeoff,
    datetime_landed: summary.datetime_landed,
    runway_takeoff: full.runway_takeoff,
    runway_landed: full.runway_landed,
    flight_time_sec: full.flight_time,
    actual_distance_km: full.actual_distance,
    flight_ended: summary.flight_ended,
    first_seen: summary.first_seen,
    last_seen: summary.last_seen,
  };
}

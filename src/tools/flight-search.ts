import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { Flightradar24ApiClient, FlightPositionFilterParams } from '../api-client.js';
import { formatPosition } from './flight-data.js';

// Judgment call: the real FR24 API has no airline-IATA or free-text search.
// `operating_as`/`painted_as`/`aircraft` filters take ICAO codes only, so
// airline_iata support from the legacy tool has been dropped; airline_icao is
// the real, working equivalent. Registration/aircraft/route/bounds all map
// directly onto real Live Flight Positions filter parameters.
export const searchFlightsToolSchema = {
  name: 'search_flights',
  description:
    'Search for currently airborne flights using the FR24 live flight positions endpoint. At least one filter ' +
    '(besides limit and detail_level) must be provided.',
  inputSchema: {
    type: 'object',
    properties: {
      airline_icao: {
        type: 'string',
        description: 'ICAO airline code the aircraft is operating as (e.g., \'BAW\' for British Airways). IATA airline codes are not supported by the FR24 API for this filter.',
      },
      registration: {
        type: 'string',
        description: 'Aircraft registration(s), comma-separated (e.g., \'G-EUPT\'). Max 15.',
      },
      aircraft_type: {
        type: 'string',
        description: 'ICAO aircraft type code(s), comma-separated (e.g., \'A320\'). Max 15.',
      },
      route: {
        type: 'string',
        description: 'Route(s) between airports or countries, comma-separated (e.g., \'JFK-LAX\'). Max 15.',
      },
      altitude_range: {
        type: 'string',
        description: 'Altitude range(s) in feet (e.g., \'0-3000\' or \'0-3000,30000-40000\').',
      },
      bounds: {
        type: 'object',
        description: 'Geographic bounds to search within',
        properties: {
          north: { type: 'number', description: 'Northern latitude bound', minimum: -90, maximum: 90 },
          south: { type: 'number', description: 'Southern latitude bound', minimum: -90, maximum: 90 },
          west: { type: 'number', description: 'Western longitude bound', minimum: -180, maximum: 180 },
          east: { type: 'number', description: 'Eastern longitude bound', minimum: -180, maximum: 180 },
        },
        required: ['north', 'south', 'west', 'east'],
      },
      detail_level: {
        type: 'string',
        enum: ['light', 'full'],
        description: 'Amount of detail to return. "full" (default) includes route, registration, and aircraft type; "light" returns only position data and costs fewer FR24 API credits.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10, max: 30000).',
        minimum: 1,
        maximum: 30000,
      },
    },
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  },
};

export async function searchFlightsTool(
  apiClient: Flightradar24ApiClient,
  args: {
    airline_icao?: string;
    registration?: string;
    aircraft_type?: string;
    route?: string;
    altitude_range?: string;
    bounds?: { north: number; south: number; west: number; east: number };
    detail_level?: 'light' | 'full';
    limit?: number;
  }
) {
  try {
    if (
      !args.airline_icao &&
      !args.registration &&
      !args.aircraft_type &&
      !args.route &&
      !args.altitude_range &&
      !args.bounds
    ) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        'At least one search parameter must be provided (airline_icao, registration, aircraft_type, route, altitude_range, or bounds).'
      );
    }

    if (args.bounds) {
      const { north, south, west, east } = args.bounds;
      if (north < south) {
        throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Northern latitude must be greater than or equal to southern latitude.');
      }
      if (east < west) {
        throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Eastern longitude must be greater than or equal to western longitude.');
      }
    }

    const detailLevel = args.detail_level || 'full';
    const limit = args.limit || 10;

    const filterParams: FlightPositionFilterParams = {
      operating_as: args.airline_icao,
      registrations: args.registration,
      aircraft: args.aircraft_type,
      routes: args.route,
      altitude_ranges: args.altitude_range,
      bounds: args.bounds ? `${args.bounds.north},${args.bounds.south},${args.bounds.west},${args.bounds.east}` : undefined,
      limit,
    };

    const positions = detailLevel === 'full'
      ? await apiClient.getLiveFlightPositionsFull(filterParams)
      : await apiClient.getLiveFlightPositionsLight(filterParams);

    if (!positions || positions.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              search_params: args,
              flights: [],
              count: 0,
              message: 'No currently airborne flights matched the search criteria.',
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            search_params: args,
            flights: positions.map(formatPosition),
            count: positions.length,
            timestamp: new Date().toISOString(),
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof ProtocolError) {
      throw error;
    }

    throw new ProtocolError(
      ProtocolErrorCode.InternalError,
      `Error searching for flights: ${(error as Error).message}`
    );
  }
}

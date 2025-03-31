import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { FlightData, FlightSearchParams, Flightradar24ApiClient } from '../api-client.js';

export const searchFlightsToolSchema = {
  name: 'search_flights',
  description: 'Search for flights by various criteria',
  inputSchema: {
    type: 'object',
    properties: {
      airline_iata: {
        type: 'string',
        description: 'IATA airline code (e.g., \'BA\' for British Airways)',
      },
      airline_icao: {
        type: 'string',
        description: 'ICAO airline code (e.g., \'BAW\' for British Airways)',
      },
      flight_number: {
        type: 'string',
        description: 'Flight number (e.g., \'123\')',
      },
      flight_iata: {
        type: 'string',
        description: 'IATA flight code (e.g., \'BA123\')',
      },
      flight_icao: {
        type: 'string',
        description: 'ICAO flight code (e.g., \'BAW123\')',
      },
      registration: {
        type: 'string',
        description: 'Aircraft registration (e.g., \'G-EUPT\')',
      },
      bounds: {
        type: 'object',
        description: 'Geographic bounds to search within',
        properties: {
          north: {
            type: 'number',
            description: 'Northern latitude bound',
            minimum: -90,
            maximum: 90,
          },
          south: {
            type: 'number',
            description: 'Southern latitude bound',
            minimum: -90,
            maximum: 90,
          },
          west: {
            type: 'number',
            description: 'Western longitude bound',
            minimum: -180,
            maximum: 180,
          },
          east: {
            type: 'number',
            description: 'Eastern longitude bound',
            minimum: -180,
            maximum: 180,
          },
        },
        required: ['north', 'south', 'west', 'east'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10, max: 100)',
        minimum: 1,
        maximum: 100,
      },
    },
  },
};

export async function searchFlightsTool(
  apiClient: Flightradar24ApiClient,
  args: {
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
) {
  try {
    // Validate that at least one search parameter is provided
    if (
      !args.airline_iata &&
      !args.airline_icao &&
      !args.flight_number &&
      !args.flight_iata &&
      !args.flight_icao &&
      !args.registration &&
      !args.bounds
    ) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'At least one search parameter must be provided.'
      );
    }

    // Validate bounds if provided
    if (args.bounds) {
      const { north, south, west, east } = args.bounds;

      if (north < south) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Northern latitude must be greater than or equal to southern latitude.'
        );
      }

      if (east < west) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Eastern longitude must be greater than or equal to western longitude.'
        );
      }
    }

    // Set default limit if not provided
    const limit = args.limit || 10;

    // Prepare search parameters
    const searchParams: FlightSearchParams = {
      ...args,
      limit,
    };

    // Search for flights
    const flights = await apiClient.searchFlights(searchParams);

    if (!flights || flights.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              search_params: searchParams,
              flights: [],
              count: 0,
              message: 'No flights found matching the search criteria.',
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    }

    // Format the response
    const formattedFlights = flights.map(flight => formatFlightData(flight));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            search_params: searchParams,
            flights: formattedFlights,
            count: formattedFlights.length,
            timestamp: new Date().toISOString(),
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Error searching for flights: ${(error as Error).message}`
    );
  }
}

function formatFlightData(flight: FlightData) {
  return {
    flight_id: flight.flight,
    callsign: flight.callsign,
    airline: flight.airline,
    position: {
      latitude: flight.lat,
      longitude: flight.lng,
      altitude: flight.alt,
    },
    speed: flight.speed,
    heading: flight.heading,
    aircraft: {
      type: flight.aircraft,
      registration: flight.registration,
    },
    route: {
      origin: flight.origin,
      destination: flight.destination,
    },
    status: flight.status,
    timestamp: new Date(flight.time * 1000).toISOString(),
  };
}

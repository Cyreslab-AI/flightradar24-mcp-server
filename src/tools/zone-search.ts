import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { FlightData, Flightradar24ApiClient } from '../api-client.js';

export const getFlightsInZoneToolSchema = {
  name: 'get_flights_in_zone',
  description: 'Get all flights currently in a specified geographic zone',
  inputSchema: {
    type: 'object',
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
};

export async function getFlightsInZoneTool(
  apiClient: Flightradar24ApiClient,
  args: {
    north: number;
    south: number;
    west: number;
    east: number;
  }
) {
  try {
    const { north, south, west, east } = args;

    // Validate bounds
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

    if (north > 90 || south < -90) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Latitude must be between -90 and 90 degrees.'
      );
    }

    if (east > 180 || west < -180) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Longitude must be between -180 and 180 degrees.'
      );
    }

    // Get flights in zone
    const flights = await apiClient.getFlightsInZone({ north, south, west, east });

    if (!flights || flights.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              zone: {
                north,
                south,
                west,
                east,
              },
              flights: [],
              count: 0,
              message: 'No flights found in the specified zone.',
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
            zone: {
              north,
              south,
              west,
              east,
            },
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
      `Error retrieving flights in zone: ${(error as Error).message}`
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

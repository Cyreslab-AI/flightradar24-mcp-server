import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { Flightradar24ApiClient } from '../api-client.js';
import { formatPosition } from './flight-data.js';

// Direct real equivalent: the FR24 Live Flight Positions endpoint accepts a
// `bounds` filter formatted as "north,south,west,east", matching this tool's
// existing parameter order exactly.
export const getFlightsInZoneToolSchema = {
  name: 'get_flights_in_zone',
  description: 'Get all currently airborne flights within a specified geographic bounding box.',
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
      detail_level: {
        type: 'string',
        enum: ['light', 'full'],
        description: 'Amount of detail to return. "full" (default) includes route, registration, and aircraft type; "light" returns only position data and costs fewer FR24 API credits.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 50, max: 30000).',
        minimum: 1,
        maximum: 30000,
      },
    },
    required: ['north', 'south', 'west', 'east'],
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  },
};

export async function getFlightsInZoneTool(
  apiClient: Flightradar24ApiClient,
  args: {
    north: number;
    south: number;
    west: number;
    east: number;
    detail_level?: 'light' | 'full';
    limit?: number;
  }
) {
  try {
    const { north, south, west, east } = args;

    if (north < south) {
      throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Northern latitude must be greater than or equal to southern latitude.');
    }
    if (east < west) {
      throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Eastern longitude must be greater than or equal to western longitude.');
    }
    if (north > 90 || south < -90) {
      throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Latitude must be between -90 and 90 degrees.');
    }
    if (east > 180 || west < -180) {
      throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Longitude must be between -180 and 180 degrees.');
    }

    const detailLevel = args.detail_level || 'full';
    const limit = args.limit || 50;
    const filterParams = {
      bounds: `${north},${south},${west},${east}`,
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
              zone: { north, south, west, east },
              flights: [],
              count: 0,
              message: 'No flights found in the specified zone.',
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
            zone: { north, south, west, east },
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
      `Error retrieving flights in zone: ${(error as Error).message}`
    );
  }
}

import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { Flightradar24ApiClient } from '../api-client.js';
import { formatPosition } from '../tools/flight-data.js';

export const zoneResourceTemplate = {
  uriTemplate: 'zone://{north}/{south}/{west}/{east}',
  name: 'Zone Flights',
  description: 'Currently airborne flights in a specified geographic zone',
  mimeType: 'application/json',
};

export async function getZoneResource(
  apiClient: Flightradar24ApiClient,
  uri: string
): Promise<string> {
  try {
    const match = uri.match(/^zone:\/\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (!match) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidRequest,
        `Invalid zone resource URI: ${uri}`
      );
    }

    const north = parseFloat(decodeURIComponent(match[1]));
    const south = parseFloat(decodeURIComponent(match[2]));
    const west = parseFloat(decodeURIComponent(match[3]));
    const east = parseFloat(decodeURIComponent(match[4]));

    if (isNaN(north) || isNaN(south) || isNaN(west) || isNaN(east)) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        'Invalid zone bounds. All bounds must be valid numbers.'
      );
    }

    if (north < south) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        'Northern latitude must be greater than or equal to southern latitude.'
      );
    }

    if (east < west) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        'Eastern longitude must be greater than or equal to western longitude.'
      );
    }

    if (north > 90 || south < -90) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        'Latitude must be between -90 and 90 degrees.'
      );
    }

    if (east > 180 || west < -180) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        'Longitude must be between -180 and 180 degrees.'
      );
    }

    const positions = await apiClient.getLiveFlightPositionsFull({
      bounds: `${north},${south},${west},${east}`,
      limit: 50,
    });

    const formattedResponse = {
      zone: { north, south, west, east },
      flights: positions.map(formatPosition),
      count: positions.length,
      timestamp: new Date().toISOString(),
    };

    return JSON.stringify(formattedResponse, null, 2);
  } catch (error) {
    if (error instanceof ProtocolError) {
      throw error;
    }

    throw new ProtocolError(
      ProtocolErrorCode.InternalError,
      `Error retrieving zone resource: ${(error as Error).message}`
    );
  }
}

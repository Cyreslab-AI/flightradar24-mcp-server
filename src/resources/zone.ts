import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { FlightData, Flightradar24ApiClient } from '../api-client.js';

export const zoneResourceTemplate = {
  uriTemplate: 'zone://{north}/{south}/{west}/{east}',
  name: 'Zone Flights',
  description: 'Flights in a specified geographic zone',
  mimeType: 'application/json',
};

export async function getZoneResource(
  apiClient: Flightradar24ApiClient,
  uri: string
): Promise<string> {
  try {
    // Extract the zone bounds from the URI
    const match = uri.match(/^zone:\/\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (!match) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid zone resource URI: ${uri}`
      );
    }

    const north = parseFloat(decodeURIComponent(match[1]));
    const south = parseFloat(decodeURIComponent(match[2]));
    const west = parseFloat(decodeURIComponent(match[3]));
    const east = parseFloat(decodeURIComponent(match[4]));

    // Validate bounds
    if (isNaN(north) || isNaN(south) || isNaN(west) || isNaN(east)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid zone bounds. All bounds must be valid numbers.'
      );
    }

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

    // Format the response
    const formattedFlights = flights.map(flight => formatFlightData(flight));

    const formattedResponse = {
      zone: {
        north,
        south,
        west,
        east,
      },
      flights: formattedFlights,
      count: formattedFlights.length,
      timestamp: new Date().toISOString(),
    };

    return JSON.stringify(formattedResponse, null, 2);
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Error retrieving zone resource: ${(error as Error).message}`
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

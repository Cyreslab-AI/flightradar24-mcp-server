import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { Flightradar24ApiClient } from '../api-client.js';
import { formatPosition } from '../tools/flight-data.js';

export const flightResourceTemplate = {
  uriTemplate: 'flight://{flight_number}',
  name: 'Flight Information',
  description: 'Real-time position of a currently airborne flight by IATA or ICAO flight number',
  mimeType: 'application/json',
};

export async function getFlightResource(
  apiClient: Flightradar24ApiClient,
  uri: string
): Promise<string> {
  try {
    const match = uri.match(/^flight:\/\/([A-Za-z0-9]+)$/);
    if (!match) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidRequest,
        `Invalid flight resource URI: ${uri}`
      );
    }

    const flightNumber = match[1];

    if (!flightNumber || flightNumber.length < 2) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        'Invalid flight number.'
      );
    }

    const positions = await apiClient.getLiveFlightPositionsFull({ flights: flightNumber });

    const formattedResponse = {
      query: flightNumber,
      flights: positions.map(formatPosition),
      count: positions.length,
      message: positions.length === 0
        ? 'No currently airborne flight matched this flight number.'
        : undefined,
      updated: new Date().toISOString(),
    };

    return JSON.stringify(formattedResponse, null, 2);
  } catch (error) {
    if (error instanceof ProtocolError) {
      throw error;
    }

    throw new ProtocolError(
      ProtocolErrorCode.InternalError,
      `Error retrieving flight resource: ${(error as Error).message}`
    );
  }
}

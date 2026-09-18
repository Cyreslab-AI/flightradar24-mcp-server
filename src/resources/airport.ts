import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { Flightradar24ApiClient } from '../api-client.js';
import { formatAirportData } from '../tools/airport-data.js';

export const airportResourceTemplate = {
  uriTemplate: 'airport://{code}',
  name: 'Airport Information',
  description: 'Information about an airport by exact IATA or ICAO code',
  mimeType: 'application/json',
};

export async function getAirportResource(
  apiClient: Flightradar24ApiClient,
  uri: string
): Promise<string> {
  try {
    const match = uri.match(/^airport:\/\/([A-Za-z0-9]+)$/);
    if (!match) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidRequest,
        `Invalid airport resource URI: ${uri}`
      );
    }

    const airportCode = match[1];

    if (!airportCode || (airportCode.length !== 3 && airportCode.length !== 4)) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        'Invalid airport code. Must be a 3-letter IATA code or 4-letter ICAO code.'
      );
    }

    const airportData = await apiClient.getAirportInfo(airportCode, 'full');
    const formattedResponse = formatAirportData(airportData);

    return JSON.stringify(formattedResponse, null, 2);
  } catch (error) {
    if (error instanceof ProtocolError) {
      throw error;
    }

    throw new ProtocolError(
      ProtocolErrorCode.InternalError,
      `Error retrieving airport resource: ${(error as Error).message}`
    );
  }
}

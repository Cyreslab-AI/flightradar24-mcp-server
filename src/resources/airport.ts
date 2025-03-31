import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { Flightradar24ApiClient } from '../api-client.js';

export const airportResourceTemplate = {
  uriTemplate: 'airport://{code}',
  name: 'Airport Information',
  description: 'Information about an airport by IATA or ICAO code',
  mimeType: 'application/json',
};

export async function getAirportResource(
  apiClient: Flightradar24ApiClient,
  uri: string
): Promise<string> {
  try {
    // Extract the airport code from the URI
    const match = uri.match(/^airport:\/\/([A-Za-z0-9]+)$/);
    if (!match) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid airport resource URI: ${uri}`
      );
    }

    const airportCode = match[1];

    // Validate airport code
    if (!airportCode || (airportCode.length !== 3 && airportCode.length !== 4)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid airport code. Must be a 3-letter IATA code or 4-letter ICAO code.'
      );
    }

    // Get airport data
    const airportData = await apiClient.getAirportData(airportCode);

    // Format the response
    const formattedResponse = {
      name: airportData.name,
      codes: {
        iata: airportData.iata,
        icao: airportData.icao,
      },
      location: {
        latitude: airportData.lat,
        longitude: airportData.lng,
        altitude: airportData.alt,
        country: airportData.country,
      },
      updated: new Date().toISOString(),
    };

    return JSON.stringify(formattedResponse, null, 2);
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Error retrieving airport resource: ${(error as Error).message}`
    );
  }
}

import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { Flightradar24ApiClient } from '../api-client.js';

export const airlineResourceTemplate = {
  uriTemplate: 'airline://{code}',
  name: 'Airline Information',
  description: 'Information about an airline by IATA or ICAO code',
  mimeType: 'application/json',
};

export async function getAirlineResource(
  apiClient: Flightradar24ApiClient,
  uri: string
): Promise<string> {
  try {
    // Extract the airline code from the URI
    const match = uri.match(/^airline:\/\/([A-Za-z0-9]+)$/);
    if (!match) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid airline resource URI: ${uri}`
      );
    }

    const airlineCode = match[1];

    // Validate airline code
    if (!airlineCode || (airlineCode.length !== 2 && airlineCode.length !== 3)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid airline code. Must be a 2-letter IATA code or 3-letter ICAO code.'
      );
    }

    // Get airline data
    const airlineData = await apiClient.getAirlineData(airlineCode);

    // Format the response
    const formattedResponse = {
      name: airlineData.name,
      codes: {
        iata: airlineData.code.iata,
        icao: airlineData.code.icao,
      },
      country: airlineData.country,
      updated: new Date().toISOString(),
    };

    return JSON.stringify(formattedResponse, null, 2);
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Error retrieving airline resource: ${(error as Error).message}`
    );
  }
}

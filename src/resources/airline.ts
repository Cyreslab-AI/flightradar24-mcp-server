import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { Flightradar24ApiClient } from '../api-client.js';
import { formatAirlineData } from '../tools/airline-data.js';

export const airlineResourceTemplate = {
  uriTemplate: 'airline://{icao}',
  name: 'Airline Information',
  description: 'Information about an airline by ICAO code',
  mimeType: 'application/json',
};

export async function getAirlineResource(
  apiClient: Flightradar24ApiClient,
  uri: string
): Promise<string> {
  try {
    const match = uri.match(/^airline:\/\/([A-Za-z0-9]+)$/);
    if (!match) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidRequest,
        `Invalid airline resource URI: ${uri}`
      );
    }

    const airlineIcao = match[1];

    if (!airlineIcao || airlineIcao.length !== 3) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        'Invalid airline code. Must be a 3-letter ICAO code.'
      );
    }

    const airlineData = await apiClient.getAirlineInfo(airlineIcao);
    const formattedResponse = formatAirlineData(airlineData);

    return JSON.stringify(formattedResponse, null, 2);
  } catch (error) {
    if (error instanceof ProtocolError) {
      throw error;
    }

    throw new ProtocolError(
      ProtocolErrorCode.InternalError,
      `Error retrieving airline resource: ${(error as Error).message}`
    );
  }
}

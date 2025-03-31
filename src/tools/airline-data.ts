import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { AirlineData, Flightradar24ApiClient } from '../api-client.js';

export const getAirlineDataToolSchema = {
  name: 'get_airline_data',
  description: 'Get detailed information about an airline by IATA or ICAO code',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'IATA (2-letter) or ICAO (3-letter) airline code',
      },
    },
    required: ['code'],
  },
};

export async function getAirlineDataTool(
  apiClient: Flightradar24ApiClient,
  args: {
    code: string;
  }
) {
  try {
    const { code } = args;

    // Validate airline code
    if (!code || (code.length !== 2 && code.length !== 3)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid airline code. Must be a 2-letter IATA code or 3-letter ICAO code.'
      );
    }

    // Get airline data
    const airlineData = await apiClient.getAirlineData(code);

    // Format the response
    const formattedResponse = formatAirlineData(airlineData);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(formattedResponse, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Error retrieving airline data: ${(error as Error).message}`
    );
  }
}

function formatAirlineData(airline: AirlineData) {
  return {
    name: airline.name,
    codes: {
      iata: airline.code.iata,
      icao: airline.code.icao,
    },
    country: airline.country,
    updated: new Date().toISOString(),
  };
}

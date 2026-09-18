import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { AirlineInfo, Flightradar24ApiClient } from '../api-client.js';

// Judgment call: the real FR24 airline endpoint (`/static/airlines/{icao}/light`)
// only accepts an ICAO code and only returns { icao, iata, name } — there is no
// IATA-code lookup path and no country/other metadata. The old tool's IATA
// support and `country` field have been dropped since the real API cannot
// provide them.
export const getAirlineDataToolSchema = {
  name: 'get_airline_data',
  description: 'Get an airline\'s name and IATA code by its ICAO code.',
  inputSchema: {
    type: 'object',
    properties: {
      icao: {
        type: 'string',
        description: 'ICAO (3-letter) airline code (e.g., \'BAW\' for British Airways). IATA-only lookup is not supported by the FR24 API.',
      },
    },
    required: ['icao'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      codes: {
        type: 'object',
        properties: {
          iata: { type: 'string' },
          icao: { type: 'string' },
        },
      },
      updated: { type: 'string' },
    },
    required: ['name', 'codes', 'updated'],
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  },
};

export async function getAirlineDataTool(
  apiClient: Flightradar24ApiClient,
  args: {
    icao: string;
  }
) {
  try {
    const { icao } = args;

    if (!icao || icao.length !== 3) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        'Invalid airline code. Must be a 3-letter ICAO code.'
      );
    }

    const airlineData = await apiClient.getAirlineInfo(icao);
    const formattedResponse = formatAirlineData(airlineData);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(formattedResponse, null, 2),
        },
      ],
      structuredContent: formattedResponse,
    };
  } catch (error) {
    if (error instanceof ProtocolError) {
      throw error;
    }

    throw new ProtocolError(
      ProtocolErrorCode.InternalError,
      `Error retrieving airline data: ${(error as Error).message}`
    );
  }
}

export function formatAirlineData(airline: AirlineInfo) {
  return {
    name: airline.name,
    codes: {
      iata: airline.iata,
      icao: airline.icao,
    },
    updated: new Date().toISOString(),
  };
}

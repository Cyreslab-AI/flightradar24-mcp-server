import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { AirportData, AirportSearchParams, Flightradar24ApiClient } from '../api-client.js';

export const getAirportDataToolSchema = {
  name: 'get_airport_data',
  description: 'Get detailed information about an airport by IATA or ICAO code',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'IATA (3-letter) or ICAO (4-letter) airport code',
      },
    },
    required: ['code'],
  },
};

export async function getAirportDataTool(
  apiClient: Flightradar24ApiClient,
  args: {
    code: string;
  }
) {
  try {
    const { code } = args;

    // Validate airport code
    if (!code || (code.length !== 3 && code.length !== 4)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid airport code. Must be a 3-letter IATA code or 4-letter ICAO code.'
      );
    }

    // Get airport data
    const airportData = await apiClient.getAirportData(code);

    // Format the response
    const formattedResponse = formatAirportData(airportData);

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
      `Error retrieving airport data: ${(error as Error).message}`
    );
  }
}

export const searchAirportsToolSchema = {
  name: 'search_airports',
  description: 'Search for airports by name, country, or other criteria',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Airport name or partial name',
      },
      country: {
        type: 'string',
        description: 'Country name or code',
      },
      iata: {
        type: 'string',
        description: 'IATA airport code (3 letters)',
      },
      icao: {
        type: 'string',
        description: 'ICAO airport code (4 letters)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10, max: 100)',
        minimum: 1,
        maximum: 100,
      },
    },
  },
};

export async function searchAirportsTool(
  apiClient: Flightradar24ApiClient,
  args: {
    name?: string;
    country?: string;
    iata?: string;
    icao?: string;
    limit?: number;
  }
) {
  try {
    // Validate that at least one search parameter is provided
    if (!args.name && !args.country && !args.iata && !args.icao) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'At least one search parameter must be provided.'
      );
    }

    // Set default limit if not provided
    const limit = args.limit || 10;

    // Prepare search parameters
    const searchParams: AirportSearchParams = {
      ...args,
      limit,
    };

    // Search for airports
    const airports = await apiClient.searchAirports(searchParams);

    if (!airports || airports.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              search_params: searchParams,
              airports: [],
              count: 0,
              message: 'No airports found matching the search criteria.',
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    }

    // Format the response
    const formattedAirports = airports.map(airport => formatAirportData(airport));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            search_params: searchParams,
            airports: formattedAirports,
            count: formattedAirports.length,
            timestamp: new Date().toISOString(),
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Error searching for airports: ${(error as Error).message}`
    );
  }
}

function formatAirportData(airport: AirportData) {
  return {
    name: airport.name,
    codes: {
      iata: airport.iata,
      icao: airport.icao,
    },
    location: {
      latitude: airport.lat,
      longitude: airport.lng,
      altitude: airport.alt,
      country: airport.country,
    },
  };
}

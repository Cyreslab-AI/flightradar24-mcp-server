import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { AirportInfoFull, AirportInfoLight, Flightradar24ApiClient } from '../api-client.js';

// Judgment call: the real FR24 API only supports exact-code airport lookup
// (`/static/airports/{code}/light|full`) — there is no name/country/free-text
// search. The old `search_airports` tool promised fuzzy, multi-result search
// that the real API cannot deliver, so per the "don't fake it" instruction it
// has been removed rather than re-implemented as a disguised exact lookup.
// get_airport_data now covers the one real capability that exists.
export const getAirportDataToolSchema = {
  name: 'get_airport_data',
  description: 'Get information about an airport by its exact IATA or ICAO code.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'IATA (3-letter) or ICAO (4-letter) airport code',
      },
      detail_level: {
        type: 'string',
        enum: ['light', 'full'],
        description: 'Amount of detail to return. "full" (default) includes coordinates, elevation, city, and timezone; "light" returns only name and codes and costs fewer FR24 API credits.',
      },
    },
    required: ['code'],
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
      location: {
        type: 'object',
        properties: {
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          elevation_ft: { type: 'number' },
          city: { type: 'string' },
          state: { type: ['string', 'null'] },
          country: { type: 'object' },
        },
      },
      timezone: { type: 'object' },
      updated: { type: 'string' },
    },
    required: ['name', 'codes', 'updated'],
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  },
};

export async function getAirportDataTool(
  apiClient: Flightradar24ApiClient,
  args: {
    code: string;
    detail_level?: 'light' | 'full';
  }
) {
  try {
    const { code } = args;

    if (!code || (code.length !== 3 && code.length !== 4)) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        'Invalid airport code. Must be a 3-letter IATA code or 4-letter ICAO code.'
      );
    }

    const detailLevel = args.detail_level || 'full';
    const airportData = await apiClient.getAirportInfo(code, detailLevel);
    const formattedResponse = formatAirportData(airportData);

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
      `Error retrieving airport data: ${(error as Error).message}`
    );
  }
}

export function formatAirportData(airport: AirportInfoLight | AirportInfoFull) {
  const full = airport as AirportInfoFull;
  return {
    name: airport.name,
    codes: {
      iata: airport.iata,
      icao: airport.icao,
    },
    location: full.lat !== undefined ? {
      latitude: full.lat,
      longitude: full.lon,
      elevation_ft: full.elevation,
      city: full.city,
      state: full.state,
      country: full.country,
    } : undefined,
    timezone: full.timezone,
    updated: new Date().toISOString(),
  };
}

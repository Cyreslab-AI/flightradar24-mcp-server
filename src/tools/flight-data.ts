import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { Flightradar24ApiClient, FlightPositionFull, FlightPositionLight } from '../api-client.js';

// Judgment call: the legacy `/flight/info` endpoint (scheduled + real + estimated
// times, plus a position "trail") does not exist in the real FR24 API. The closest
// real equivalent for "real-time data for a specific flight" is the Live Flight
// Positions endpoint filtered down to that one flight. This only returns data
// while the flight is actually airborne and being tracked; for completed or
// future flights, use get_flight_summary instead.
export const getFlightDataToolSchema = {
  name: 'get_flight_data',
  description:
    'Get real-time position data for a specific flight that is currently airborne, by flight number or callsign. ' +
    'Uses the FR24 live flight positions endpoint, so it only returns a result while the flight is in the air. ' +
    'For completed, scheduled, or historical flights, use get_flight_summary instead.',
  inputSchema: {
    type: 'object',
    properties: {
      flight_number: {
        type: 'string',
        description: 'IATA or ICAO flight number (e.g., \'BA123\' or \'BAW123\').',
      },
      callsign: {
        type: 'string',
        description: 'ATC callsign of the flight (e.g., \'BAW123\'), used instead of flight_number.',
      },
      detail_level: {
        type: 'string',
        enum: ['light', 'full'],
        description: 'Amount of detail to return. "full" (default) includes route, registration, and aircraft type; "light" returns only position data and costs fewer FR24 API credits.',
      },
    },
    oneOf: [
      { required: ['flight_number'] },
      { required: ['callsign'] },
    ],
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  },
};

export async function getFlightDataTool(
  apiClient: Flightradar24ApiClient,
  args: {
    flight_number?: string;
    callsign?: string;
    detail_level?: 'light' | 'full';
  }
) {
  try {
    const { flight_number, callsign } = args;

    if (!flight_number && !callsign) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        'Either flight_number or callsign must be provided.'
      );
    }

    const detailLevel = args.detail_level || 'full';
    const filterParams = {
      flights: flight_number,
      callsigns: callsign,
    };

    const positions = detailLevel === 'full'
      ? await apiClient.getLiveFlightPositionsFull(filterParams)
      : await apiClient.getLiveFlightPositionsLight(filterParams);

    if (!positions || positions.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query: { flight_number, callsign },
              flights: [],
              message: 'No currently airborne flight matched this query. The flight may not have departed yet, may have already landed, or the identifier may be incorrect. Try get_flight_summary for completed or historical flights.',
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            query: { flight_number, callsign },
            flights: positions.map(formatPosition),
            count: positions.length,
            timestamp: new Date().toISOString(),
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    if (error instanceof ProtocolError) {
      throw error;
    }

    throw new ProtocolError(
      ProtocolErrorCode.InternalError,
      `Error retrieving flight data: ${(error as Error).message}`
    );
  }
}

export function formatPosition(position: FlightPositionLight | FlightPositionFull) {
  const full = position as FlightPositionFull;
  return {
    fr24_id: position.fr24_id,
    hex: position.hex,
    callsign: position.callsign,
    flight_number: full.flight,
    position: {
      latitude: position.lat,
      longitude: position.lon,
      altitude_ft: position.alt,
      track_deg: position.track,
    },
    ground_speed_kt: position.gspeed,
    vertical_speed_fpm: position.vspeed,
    squawk: position.squawk,
    source: position.source,
    aircraft_type: full.type,
    registration: full.reg,
    painted_as: full.painted_as,
    operating_as: full.operating_as,
    origin: full.orig_iata ? { iata: full.orig_iata, icao: full.orig_icao } : undefined,
    destination: full.dest_iata ? { iata: full.dest_iata, icao: full.dest_icao } : undefined,
    eta: full.eta,
    timestamp: position.timestamp,
  };
}

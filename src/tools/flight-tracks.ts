import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { Flightradar24ApiClient } from '../api-client.js';

// Replaces the old get_aircraft_data tool. The real FR24 API has no
// aircraft-by-registration registry lookup at all (no owner, operator,
// manufacturer, MSN, or age data is exposed anywhere in the documented
// contract) — see the judgment-call note in aircraft-data removal in
// README.md. get_flight_tracks is the real, closest capability to the old
// "trail" field returned inside get_flight_data: a detailed position history
// for one specific flight, identified by its FR24 flight ID (fr24_id), which
// is returned by get_flight_data, search_flights, or get_flight_summary.
export const getFlightTracksToolSchema = {
  name: 'get_flight_tracks',
  description:
    'Get the detailed position track (a series of timestamped lat/lon/altitude/speed points) for one specific ' +
    'flight, identified by its FR24 flight ID (fr24_id). Get the fr24_id from get_flight_data, search_flights, ' +
    'or get_flight_summary first.',
  inputSchema: {
    type: 'object',
    properties: {
      flight_id: {
        type: 'string',
        description: 'FR24 flight ID (fr24_id), a hexadecimal string (e.g., \'3b3d2e3f\').',
      },
    },
    required: ['flight_id'],
  },
  annotations: {
    readOnlyHint: true,
    openWorldHint: true,
  },
};

export async function getFlightTracksTool(
  apiClient: Flightradar24ApiClient,
  args: {
    flight_id: string;
  }
) {
  try {
    const { flight_id } = args;

    if (!flight_id) {
      throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'flight_id is required.');
    }

    const results = await apiClient.getFlightTracks(flight_id);

    if (!results || results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              flight_id,
              tracks: [],
              message: 'No track data found for this flight ID.',
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    }

    const formatted = results.map(result => ({
      fr24_id: result.fr24_id,
      points: result.tracks.map(point => ({
        timestamp: point.timestamp,
        latitude: point.lat,
        longitude: point.lon,
        altitude_ft: point.alt,
        ground_speed_kt: point.gspeed,
        vertical_speed_fpm: point.vspeed,
        track_deg: point.track,
        squawk: point.squawk,
        callsign: point.callsign,
        source: point.source,
      })),
      point_count: result.tracks.length,
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            flight_id,
            tracks: formatted,
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
      `Error retrieving flight tracks: ${(error as Error).message}`
    );
  }
}

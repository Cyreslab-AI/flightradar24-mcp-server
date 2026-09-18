import { ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { Flightradar24ApiClient } from '../api-client.js';

// Replaces the old aircraft://{registration} resource. The real FR24 API has
// no aircraft registry lookup (see judgment-call note in
// src/tools/flight-tracks.ts and README.md), so this resource exposes the
// closest real capability instead: the detailed position track for one
// specific flight, by FR24 flight ID.
export const flightTrackResourceTemplate = {
  uriTemplate: 'flighttrack://{flight_id}',
  name: 'Flight Track',
  description: 'Detailed position track for a specific flight by FR24 flight ID (fr24_id)',
  mimeType: 'application/json',
};

export async function getFlightTrackResource(
  apiClient: Flightradar24ApiClient,
  uri: string
): Promise<string> {
  try {
    const match = uri.match(/^flighttrack:\/\/([A-Za-z0-9]+)$/);
    if (!match) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidRequest,
        `Invalid flight track resource URI: ${uri}`
      );
    }

    const flightId = match[1];

    if (!flightId) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        'Invalid flight ID.'
      );
    }

    const results = await apiClient.getFlightTracks(flightId);

    const formattedResponse = {
      flight_id: flightId,
      tracks: results.map(result => ({
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
      })),
      updated: new Date().toISOString(),
    };

    return JSON.stringify(formattedResponse, null, 2);
  } catch (error) {
    if (error instanceof ProtocolError) {
      throw error;
    }

    throw new ProtocolError(
      ProtocolErrorCode.InternalError,
      `Error retrieving flight track resource: ${(error as Error).message}`
    );
  }
}

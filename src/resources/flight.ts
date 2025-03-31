import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { Flightradar24ApiClient } from '../api-client.js';

export const flightResourceTemplate = {
  uriTemplate: 'flight://{flight_id}',
  name: 'Flight Information',
  description: 'Information about a flight by IATA or ICAO flight code',
  mimeType: 'application/json',
};

export async function getFlightResource(
  apiClient: Flightradar24ApiClient,
  uri: string
): Promise<string> {
  try {
    // Extract the flight ID from the URI
    const match = uri.match(/^flight:\/\/([A-Za-z0-9]+)$/);
    if (!match) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid flight resource URI: ${uri}`
      );
    }

    const flightId = match[1];

    // Validate flight ID
    if (!flightId || flightId.length < 2) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid flight ID.'
      );
    }

    // Get flight data
    const flightData = await apiClient.getFlightData(flightId);

    // Convert timestamps to ISO strings
    const scheduledDeparture = flightData.time.scheduled.departure ?
      new Date(flightData.time.scheduled.departure * 1000).toISOString() : null;
    const scheduledArrival = flightData.time.scheduled.arrival ?
      new Date(flightData.time.scheduled.arrival * 1000).toISOString() : null;
    const actualDeparture = flightData.time.real.departure ?
      new Date(flightData.time.real.departure * 1000).toISOString() : null;
    const actualArrival = flightData.time.real.arrival ?
      new Date(flightData.time.real.arrival * 1000).toISOString() : null;
    const estimatedDeparture = flightData.time.estimated.departure ?
      new Date(flightData.time.estimated.departure * 1000).toISOString() : null;
    const estimatedArrival = flightData.time.estimated.arrival ?
      new Date(flightData.time.estimated.arrival * 1000).toISOString() : null;

    // Format the response
    const formattedResponse = {
      flight: {
        id: flightData.identification.id,
        callsign: flightData.identification.callsign,
        number: flightData.identification.number.default,
        alternative_number: flightData.identification.number.alternative,
      },
      status: {
        live: flightData.status.live,
        text: flightData.status.text,
      },
      aircraft: {
        model: flightData.aircraft.model.text,
        code: flightData.aircraft.model.code,
        registration: flightData.aircraft.registration,
      },
      airline: {
        name: flightData.airline.name,
        iata: flightData.airline.code.iata,
        icao: flightData.airline.code.icao,
      },
      origin: {
        name: flightData.airport.origin.name,
        iata: flightData.airport.origin.code.iata,
        icao: flightData.airport.origin.code.icao,
        city: flightData.airport.origin.position.region.city,
        country: flightData.airport.origin.position.country.name,
        coordinates: {
          latitude: flightData.airport.origin.position.latitude,
          longitude: flightData.airport.origin.position.longitude,
        },
      },
      destination: {
        name: flightData.airport.destination.name,
        iata: flightData.airport.destination.code.iata,
        icao: flightData.airport.destination.code.icao,
        city: flightData.airport.destination.position.region.city,
        country: flightData.airport.destination.position.country.name,
        coordinates: {
          latitude: flightData.airport.destination.position.latitude,
          longitude: flightData.airport.destination.position.longitude,
        },
      },
      time: {
        scheduled: {
          departure: scheduledDeparture,
          arrival: scheduledArrival,
        },
        actual: {
          departure: actualDeparture,
          arrival: actualArrival,
        },
        estimated: {
          departure: estimatedDeparture,
          arrival: estimatedArrival,
        },
      },
      trail: flightData.trail ? flightData.trail.map(point => ({
        latitude: point.lat,
        longitude: point.lng,
        altitude: point.alt,
        speed: point.spd,
        heading: point.hd,
        timestamp: new Date(point.ts * 1000).toISOString(),
      })) : [],
      updated: new Date().toISOString(),
    };

    return JSON.stringify(formattedResponse, null, 2);
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Error retrieving flight resource: ${(error as Error).message}`
    );
  }
}

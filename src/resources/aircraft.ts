import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { Flightradar24ApiClient } from '../api-client.js';

export const aircraftResourceTemplate = {
  uriTemplate: 'aircraft://{registration}',
  name: 'Aircraft Information',
  description: 'Information about an aircraft by registration number',
  mimeType: 'application/json',
};

export async function getAircraftResource(
  apiClient: Flightradar24ApiClient,
  uri: string
): Promise<string> {
  try {
    // Extract the aircraft registration from the URI
    const match = uri.match(/^aircraft:\/\/([A-Za-z0-9-]+)$/);
    if (!match) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Invalid aircraft resource URI: ${uri}`
      );
    }

    const registration = match[1];

    // Validate registration
    if (!registration || registration.length < 2) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Invalid aircraft registration number.'
      );
    }

    // Get aircraft data
    const aircraftData = await apiClient.getAircraftData(registration);

    // Format the response
    const formattedResponse = {
      registration: aircraftData.registration,
      aircraft_type: {
        code: aircraftData.type,
        model: aircraftData.model,
        manufacturer: aircraftData.manufacturer,
      },
      operator: aircraftData.operator,
      owner: aircraftData.owner,
      age_years: aircraftData.age,
      msn: aircraftData.msn,
      updated: new Date().toISOString(),
    };

    return JSON.stringify(formattedResponse, null, 2);
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InternalError,
      `Error retrieving aircraft resource: ${(error as Error).message}`
    );
  }
}

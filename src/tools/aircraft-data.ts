import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { AircraftData, Flightradar24ApiClient } from '../api-client.js';

export const getAircraftDataToolSchema = {
  name: 'get_aircraft_data',
  description: 'Get detailed information about an aircraft by registration number',
  inputSchema: {
    type: 'object',
    properties: {
      registration: {
        type: 'string',
        description: 'Aircraft registration number (e.g., \'G-EUPT\')',
      },
    },
    required: ['registration'],
  },
};

export async function getAircraftDataTool(
  apiClient: Flightradar24ApiClient,
  args: {
    registration: string;
  }
) {
  try {
    const { registration } = args;

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
    const formattedResponse = formatAircraftData(aircraftData);

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
      `Error retrieving aircraft data: ${(error as Error).message}`
    );
  }
}

function formatAircraftData(aircraft: AircraftData) {
  return {
    registration: aircraft.registration,
    aircraft_type: {
      code: aircraft.type,
      model: aircraft.model,
      manufacturer: aircraft.manufacturer,
    },
    operator: aircraft.operator,
    owner: aircraft.owner,
    age_years: aircraft.age,
    msn: aircraft.msn,
    updated: new Date().toISOString(),
  };
}

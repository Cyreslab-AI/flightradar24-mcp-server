#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { Server, ProtocolError, ProtocolErrorCode } from "@modelcontextprotocol/server";
import { Flightradar24ApiClient } from './api-client.js';
import { getFlightDataTool, getFlightDataToolSchema } from './tools/flight-data.js';
import { searchFlightsTool, searchFlightsToolSchema } from './tools/flight-search.js';
import { getFlightSummaryTool, getFlightSummaryToolSchema } from './tools/flight-summary.js';
import { getFlightTracksTool, getFlightTracksToolSchema } from './tools/flight-tracks.js';
import { getAirportDataTool, getAirportDataToolSchema } from './tools/airport-data.js';
import { getAirlineDataTool, getAirlineDataToolSchema } from './tools/airline-data.js';
import { getFlightsInZoneTool, getFlightsInZoneToolSchema } from './tools/zone-search.js';
import { getApiUsageTool, getApiUsageToolSchema } from './tools/api-usage.js';
import { getFlightResource, flightResourceTemplate } from './resources/flight.js';
import { getAirportResource, airportResourceTemplate } from './resources/airport.js';
import { getAirlineResource, airlineResourceTemplate } from './resources/airline.js';
import { getFlightTrackResource, flightTrackResourceTemplate } from './resources/flight-track.js';
import { getZoneResource, zoneResourceTemplate } from './resources/zone.js';

class Flightradar24Server {
  private server: Server;
  private apiClient: Flightradar24ApiClient | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'flightradar24-server',
        version: '2.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });

    this.setupHandlers();
  }

  private getApiClient(): Flightradar24ApiClient {
    if (!this.apiClient) {
      const apiKey = process.env.FR24_API_KEY;
      if (!apiKey) {
        throw new ProtocolError(
          ProtocolErrorCode.InvalidRequest,
          'FR24_API_KEY environment variable is required. Get a key at https://fr24api.flightradar24.com'
        );
      }
      this.apiClient = new Flightradar24ApiClient(apiKey);
    }
    return this.apiClient;
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler('tools/list', async (): Promise<any> => ({
      tools: [
        getFlightDataToolSchema,
        searchFlightsToolSchema,
        getFlightSummaryToolSchema,
        getFlightTracksToolSchema,
        getAirportDataToolSchema,
        getAirlineDataToolSchema,
        getFlightsInZoneToolSchema,
        getApiUsageToolSchema,
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler('tools/call', async (request): Promise<any> => {
      const apiClient = this.getApiClient();

      switch (request.params.name) {
        case 'get_flight_data':
          return getFlightDataTool(apiClient, request.params.arguments as any);

        case 'search_flights':
          return searchFlightsTool(apiClient, request.params.arguments as any);

        case 'get_flight_summary':
          return getFlightSummaryTool(apiClient, request.params.arguments as any);

        case 'get_flight_tracks':
          return getFlightTracksTool(apiClient, request.params.arguments as any);

        case 'get_airport_data':
          return getAirportDataTool(apiClient, request.params.arguments as any);

        case 'get_airline_data':
          return getAirlineDataTool(apiClient, request.params.arguments as any);

        case 'get_flights_in_zone':
          return getFlightsInZoneTool(apiClient, request.params.arguments as any);

        case 'get_api_usage':
          return getApiUsageTool(apiClient);

        default:
          throw new ProtocolError(
            ProtocolErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });

    // List resource templates
    this.server.setRequestHandler('resources/templates/list', async () => ({
      resourceTemplates: [
        flightResourceTemplate,
        airportResourceTemplate,
        airlineResourceTemplate,
        flightTrackResourceTemplate,
        zoneResourceTemplate,
      ],
    }));

    // List static resources (none in this implementation)
    this.server.setRequestHandler('resources/list', async () => ({
      resources: [],
    }));

    // Handle resource requests
    this.server.setRequestHandler('resources/read', async (request) => {
      const apiClient = this.getApiClient();
      const uri = request.params.uri;

      let content: string;

      if (uri.startsWith('flight://')) {
        content = await getFlightResource(apiClient, uri);
      } else if (uri.startsWith('airport://')) {
        content = await getAirportResource(apiClient, uri);
      } else if (uri.startsWith('airline://')) {
        content = await getAirlineResource(apiClient, uri);
      } else if (uri.startsWith('flighttrack://')) {
        content = await getFlightTrackResource(apiClient, uri);
      } else if (uri.startsWith('zone://')) {
        content = await getZoneResource(apiClient, uri);
      } else {
        throw new ProtocolError(
          ProtocolErrorCode.InvalidRequest,
          `Unsupported resource URI: ${uri}`
        );
      }

      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: 'application/json',
            text: content,
          },
        ],
      };
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Flightradar24 MCP server running on stdio');
  }
}

const server = new Flightradar24Server();
server.run().catch(console.error);

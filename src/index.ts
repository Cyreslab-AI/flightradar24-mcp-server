#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { Flightradar24ApiClient } from './api-client.js';
import { getFlightDataTool, getFlightDataToolSchema } from './tools/flight-data.js';
import { searchFlightsTool, searchFlightsToolSchema } from './tools/flight-search.js';
import { getAirportDataTool, getAirportDataToolSchema, searchAirportsTool, searchAirportsToolSchema } from './tools/airport-data.js';
import { getAirlineDataTool, getAirlineDataToolSchema } from './tools/airline-data.js';
import { getAircraftDataTool, getAircraftDataToolSchema } from './tools/aircraft-data.js';
import { getFlightsInZoneTool, getFlightsInZoneToolSchema } from './tools/zone-search.js';
import { getFlightResource, flightResourceTemplate } from './resources/flight.js';
import { getAirportResource, airportResourceTemplate } from './resources/airport.js';
import { getAirlineResource, airlineResourceTemplate } from './resources/airline.js';
import { getAircraftResource, aircraftResourceTemplate } from './resources/aircraft.js';
import { getZoneResource, zoneResourceTemplate } from './resources/zone.js';

class Flightradar24Server {
  private server: Server;
  private apiClient: Flightradar24ApiClient | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'flightradar24-server',
        version: '1.0.0',
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
      const apiKey = process.env.FLIGHTRADAR24_API_KEY;
      if (!apiKey) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'FLIGHTRADAR24_API_KEY environment variable is required'
        );
      }
      this.apiClient = new Flightradar24ApiClient(apiKey);
    }
    return this.apiClient;
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        getFlightDataToolSchema,
        searchFlightsToolSchema,
        getAirportDataToolSchema,
        searchAirportsToolSchema,
        getAirlineDataToolSchema,
        getAircraftDataToolSchema,
        getFlightsInZoneToolSchema,
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const apiClient = this.getApiClient();

      switch (request.params.name) {
        case 'get_flight_data':
          return getFlightDataTool(apiClient, request.params.arguments as any);

        case 'search_flights':
          return searchFlightsTool(apiClient, request.params.arguments as any);

        case 'get_airport_data':
          return getAirportDataTool(apiClient, request.params.arguments as any);

        case 'search_airports':
          return searchAirportsTool(apiClient, request.params.arguments as any);

        case 'get_airline_data':
          return getAirlineDataTool(apiClient, request.params.arguments as any);

        case 'get_aircraft_data':
          return getAircraftDataTool(apiClient, request.params.arguments as any);

        case 'get_flights_in_zone':
          return getFlightsInZoneTool(apiClient, request.params.arguments as any);

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });

    // List resource templates
    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      resourceTemplates: [
        flightResourceTemplate,
        airportResourceTemplate,
        airlineResourceTemplate,
        aircraftResourceTemplate,
        zoneResourceTemplate,
      ],
    }));

    // List static resources (none in this implementation)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [],
    }));

    // Handle resource requests
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const apiClient = this.getApiClient();
      const uri = request.params.uri;

      let content: string;

      if (uri.startsWith('flight://')) {
        content = await getFlightResource(apiClient, uri);
      } else if (uri.startsWith('airport://')) {
        content = await getAirportResource(apiClient, uri);
      } else if (uri.startsWith('airline://')) {
        content = await getAirlineResource(apiClient, uri);
      } else if (uri.startsWith('aircraft://')) {
        content = await getAircraftResource(apiClient, uri);
      } else if (uri.startsWith('zone://')) {
        content = await getZoneResource(apiClient, uri);
      } else {
        throw new McpError(
          ErrorCode.InvalidRequest,
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

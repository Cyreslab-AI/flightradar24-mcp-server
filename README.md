# Flightradar24 MCP Server

A Model Context Protocol (MCP) server that provides access to flight tracking data from the
**official, commercial Flightradar24 API** (`fr24api.flightradar24.com`).

> This server previously called an undocumented, reverse-engineered mobile-app endpoint
> (`api.flightradar24.com/v1/...`). It has been migrated to FR24's real, documented,
> credit-metered API. See "Migration notes" below for what changed.

## Features

### Tools

- **get_flight_data**: Get real-time position data for a specific flight that is currently airborne, by flight number or callsign
- **search_flights**: Search for currently airborne flights by airline, registration, aircraft type, route, altitude, or geographic area
- **get_flight_summary**: Get takeoff/landing history for completed flights in a date/time window
- **get_flight_tracks**: Get the detailed position track for one specific flight by its FR24 flight ID
- **get_airport_data**: Get information about an airport by its exact IATA or ICAO code
- **get_airline_data**: Get an airline's name and IATA code by its ICAO code
- **get_flights_in_zone**: Get all currently airborne flights within a geographic bounding box
- **get_api_usage**: Get a summary of your FR24 API credit usage per endpoint

### Resources

- **flight://{flight_number}**: Real-time position of a currently airborne flight by IATA or ICAO flight number
- **airport://{code}**: Information about an airport by exact IATA or ICAO code
- **airline://{icao}**: Information about an airline by ICAO code
- **flighttrack://{flight_id}**: Detailed position track for a specific flight by FR24 flight ID
- **zone://{north}/{south}/{west}/{east}**: Currently airborne flights in a specified geographic zone

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the server:
   ```bash
   npm run build
   ```

## Getting an FR24 API key

1. Create an account and subscribe to an API plan at [fr24api.flightradar24.com](https://fr24api.flightradar24.com).
2. Generate a token from the [Key Management page](https://fr24api.flightradar24.com/key-management).
3. Set it as the `FR24_API_KEY` environment variable (see Configuration below).

### Pricing / credits, in brief

The FR24 API is **credit-metered**, not a flat-rate subscription: each request costs credits based on
how many entities (flights, airports, etc.) are returned, and the price per entity varies by endpoint.
For example, a Live Flight Positions (light) query costs roughly 6 credits per flight returned.
Subscription credits refresh monthly and do not roll over; top-up credits expire after 6 months.
Use the `get_api_usage` tool (or the `/usage` endpoint directly) to monitor consumption, and see
[Subscriptions & credits](https://fr24api.flightradar24.com/subscriptions-and-credits) and
[Credit overview](https://fr24api.flightradar24.com/docs/credit-overview) for current, authoritative pricing.

## Configuration

The server requires an FR24 API key to function. You can set this in your MCP settings configuration file:

```json
{
  "mcpServers": {
    "flightradar24": {
      "command": "node",
      "args": ["/path/to/flightradar24-server/build/index.js"],
      "env": {
        "FR24_API_KEY": "YOUR_FR24_API_KEY_HERE"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

## Usage Examples

### Get Flight Data

```
<use_mcp_tool>
<server_name>flightradar24</server_name>
<tool_name>get_flight_data</tool_name>
<arguments>
{
  "flight_number": "BA123"
}
</arguments>
</use_mcp_tool>
```

### Search Flights

```
<use_mcp_tool>
<server_name>flightradar24</server_name>
<tool_name>search_flights</tool_name>
<arguments>
{
  "airline_icao": "BAW",
  "limit": 5
}
</arguments>
</use_mcp_tool>
```

### Get Flight Summary (historical / completed flights)

```
<use_mcp_tool>
<server_name>flightradar24</server_name>
<tool_name>get_flight_summary</tool_name>
<arguments>
{
  "flight_datetime_from": "2024-01-01T00:00:00Z",
  "flight_datetime_to": "2024-01-02T00:00:00Z",
  "route": "JFK-LAX"
}
</arguments>
</use_mcp_tool>
```

### Get Flight Track

```
<use_mcp_tool>
<server_name>flightradar24</server_name>
<tool_name>get_flight_tracks</tool_name>
<arguments>
{
  "flight_id": "3b3d2e3f"
}
</arguments>
</use_mcp_tool>
```

### Get Airport Data

```
<use_mcp_tool>
<server_name>flightradar24</server_name>
<tool_name>get_airport_data</tool_name>
<arguments>
{
  "code": "LHR"
}
</arguments>
</use_mcp_tool>
```

### Get Flights in Zone

```
<use_mcp_tool>
<server_name>flightradar24</server_name>
<tool_name>get_flights_in_zone</tool_name>
<arguments>
{
  "north": 51.6,
  "south": 51.4,
  "west": -0.5,
  "east": 0.2
}
</arguments>
</use_mcp_tool>
```

### Access Flight Resource

```
<access_mcp_resource>
<server_name>flightradar24</server_name>
<uri>flight://BA123</uri>
</access_mcp_resource>
```

### Access Zone Resource

```
<access_mcp_resource>
<server_name>flightradar24</server_name>
<uri>zone://51.6/51.4/-0.5/0.2</uri>
</access_mcp_resource>
```

## Migration notes (v1 → v2)

Version 2 replaces every call to the old, undocumented `api.flightradar24.com/v1` host with FR24's
real, official API at `fr24api.flightradar24.com`, confirmed against FR24's own
[`fr24api-mcp`](https://github.com/Flightradar24/fr24api-mcp) reference server. This changed both the
environment variable and the tool set:

- **Env var renamed**: `FLIGHTRADAR24_API_KEY` → `FR24_API_KEY`.
- **`search_airports` removed**: the real API only supports an exact IATA/ICAO code lookup
  (`/static/airports/{code}`) — there is no name/country/free-text search to fake. `get_airport_data`
  now covers the one real capability.
- **`get_aircraft_data` removed**: the real API has no aircraft-by-registration registry at all (no
  owner, operator, manufacturer, MSN, or age data anywhere in its documented contract). Registration
  remains available only as a *filter* on `search_flights`, `get_flight_summary`, and live/historic
  position queries — it can no longer be used to look up static aircraft details.
- **`get_flight_summary` added**: the real API has no single "flight info" endpoint with scheduled,
  estimated, and real times like the old one did. Live position data (via `get_flight_data`) only
  exists while a flight is airborne; `get_flight_summary` (backed by `/flight-summary`) is the real
  equivalent for completed/historical flights.
- **`get_flight_tracks` added**: replaces the "trail" field that used to be embedded in
  `get_flight_data`'s response. The real API exposes this as its own endpoint
  (`/flight-tracks`), keyed by FR24 flight ID (`fr24_id`) rather than flight number.
- **`get_api_usage` added**: the real API is credit-metered per request; this tool wraps its
  `/usage` endpoint (rate-limited by FR24 to 1 call/minute) so usage can be monitored from the client.
- **Airline lookup is ICAO-only**: the real airline endpoint takes only an ICAO code and returns only
  `{ name, iata, icao }` — no IATA-code lookup and no country field, unlike the old tool.
- **All tools require `Accept-Version: v1`**: this is sent automatically by the client on every
  request, as required by the FR24 API.
- **All tools now carry `readOnlyHint: true` / `openWorldHint: true` annotations**, since every one
  of them is a pure read against a third-party data source.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

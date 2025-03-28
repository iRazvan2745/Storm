# Storm

A distributed monitoring system with persistent storage and hot-reloadable configuration.

## Features

- **Agent-based monitoring**: Distributed agents that can monitor targets from different locations
- **Persistent storage**: All data is stored on disk and loaded on startup
- **Hot-reloadable configuration**: Monitor targets can be modified without restarting the server
- **Resilient agents**: Retry logic with exponential backoff for network failures
- **CORS support**: Server supports cross-origin requests

## Getting Started

To install dependencies:

```bash
bun install
```

To run the server:

```bash
bun run server
```

To run an agent:

```bash
bun run agent
```

## Configuration

### Targets Configuration

Targets are configured in the `data/config/targets.json` file. The server automatically watches this file for changes and reloads the configuration when it changes.

Example configuration:

```json
{
  "targets": [
    {
      "id": "google-monitor",
      "url": "https://google.com",
      "name": "Google",
      "interval": 60000,
      "timeout": 5000
    },
    {
      "id": "github-monitor",
      "url": "https://github.com",
      "name": "GitHub",
      "interval": 60000,
      "timeout": 5000
    }
  ]
}
```

You can edit this file while the server is running, and the changes will be automatically applied.

### Environment Variables

#### Server

- `SERVER_PORT`: Port for the server to listen on (default: 3000)

#### Agent

- `SERVER_URL`: URL of the server (required)
- `AGENT_NAME`: Name of the agent (default: hostname)
- `AGENT_LOCATION`: Location of the agent (default: "Unknown")
- `CHECK_INTERVAL`: Interval for checking targets in milliseconds (default: 60000)

## Development

For development, you can run the server and multiple agents with:

```bash
bun run dev
```

This project was created using `bun init` in bun v1.2.5. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

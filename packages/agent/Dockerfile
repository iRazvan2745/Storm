FROM oven/bun:latest

WORKDIR /app

# Copy root package.json and workspace files
COPY package.json .
COPY bun.lock .
COPY packages/shared ./packages/shared
COPY packages/agent/package.json ./packages/agent/

# Install dependencies
RUN bun install

# Copy agent source
COPY packages/agent ./packages/agent

WORKDIR /app/packages/agent

CMD ["bun", "run", "start"]
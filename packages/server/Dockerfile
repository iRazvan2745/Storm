FROM oven/bun:latest

WORKDIR /app

# Copy root package.json and workspace files
COPY package.json .
COPY bun.lock .
COPY packages/shared ./packages/shared
COPY packages/server/package.json ./packages/server/

# Install dependencies
RUN bun install

# Copy server source
COPY packages/server ./packages/server

WORKDIR /app/packages/server

EXPOSE 3000

CMD ["bun", "run", "start"]
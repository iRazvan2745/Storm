FROM oven/bun:latest

WORKDIR /app

# Copy package files for better layer caching
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN bun install

# Copy the rest of the application code
COPY . .

EXPOSE 3000

CMD ["bun", "run", "start:server"]

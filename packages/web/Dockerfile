FROM oven/bun:latest

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN bun install

# Copy the rest of the application
COPY . .

# Build the Next.js application
RUN bun run build

EXPOSE 3000

# Start the Next.js application
CMD ["bun", "run", "start"]

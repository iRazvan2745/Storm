FROM oven/bun:latest

WORKDIR /app

COPY package.json .
COPY bun.lock .
COPY packages/shared ./packages/shared
COPY packages/web ./packages/web

WORKDIR /app/packages/web
RUN bun install
RUN bun run build

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "start"]
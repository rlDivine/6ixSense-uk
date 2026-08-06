# Slim Node image — no headless browser anymore (every source is now plain
# HTTP/JSON), so the container is tiny and runs comfortably in 512 MB.
FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production

# Install deps first (better layer caching).
COPY package*.json ./
RUN npm ci --omit=dev

# App source.
COPY . .

# Render injects $PORT; server.js already reads process.env.PORT.
EXPOSE 3000
CMD ["node", "server.js"]

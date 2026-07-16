# Vibe Coding Roadmap — production image
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

# Install only production deps first (better layer caching).
COPY package*.json ./
RUN npm ci --omit=dev

# App source.
COPY . .

# SQLite data lives here — mount a volume to persist across restarts.
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3012
ENV PORT=3012

# Basic container healthcheck hitting /healthz.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3012)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]

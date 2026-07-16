# Vibe Coding Roadmap — production image
FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app

# Install only production deps first (better layer caching).
COPY package*.json ./
RUN npm ci --omit=dev

# App source.
COPY . .

# No data volume: payments live in Firestore, not on local disk. Cloud Run's
# filesystem is ephemeral, which is exactly why the SQLite volume that used to
# be here could not survive here.

# Cloud Run injects PORT (8080) and server.js honours it; this default is only
# for running the image locally.
EXPOSE 8080
ENV PORT=8080

# Basic container healthcheck hitting /healthz.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3012)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]

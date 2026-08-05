FROM node:22-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY . .
# Bind-mount /app/storage/uploads in deployment; no upload content is baked in.
RUN mkdir -p /app/storage/uploads/public /app/storage/uploads/private /app/storage/tmp && chown -R node:node /app/storage
USER node
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node","src/server.js"]

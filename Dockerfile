FROM node:22-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY . .
# The deployment bind-mount replaces /app/uploads; no upload content is baked in.
RUN mkdir -p /app/uploads/public /app/uploads/private
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node","src/server.js"]

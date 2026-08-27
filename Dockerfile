# --- Build stage (frontend) ---
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Serve stage (Node sert l'API + le frontend buildé) ---
FROM node:20-alpine
WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server ./server
COPY --from=build /app/dist ./dist

EXPOSE 80
CMD ["node", "server/index.js"]

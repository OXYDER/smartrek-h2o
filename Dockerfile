# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Identifiants Smartrek H2O injectés au build (Vite les fige dans le bundle
# client à la compilation — voir la note de sécurité dans README.md)
ARG VITE_SMARTREK_EMAIL
ARG VITE_SMARTREK_PASSWORD
ARG VITE_SMARTREK_API_BASE=https://data3.smartrek.io/api
ENV VITE_SMARTREK_EMAIL=$VITE_SMARTREK_EMAIL
ENV VITE_SMARTREK_PASSWORD=$VITE_SMARTREK_PASSWORD
ENV VITE_SMARTREK_API_BASE=$VITE_SMARTREK_API_BASE

RUN npm run build

# --- Serve stage ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

# syntax=docker/dockerfile:1
# Multi-stage build for a static SPA: build the Vite bundle, serve it with nginx.

# ---- Build stage ---------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage: serve static files -----------------------------------
FROM nginx:1.27-alpine AS runtime
# SPA fallback: route unknown paths to index.html.
# Hashed build assets are cached forever; the HTML shell, service worker and
# manifest are always revalidated so the PWA picks up new deploys.
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location / { try_files $uri $uri/ /index.html; add_header Cache-Control "no-cache"; }\n  location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }\n  location = /sw.js { add_header Cache-Control "no-cache"; }\n  location ~ \\.webmanifest$ { default_type application/manifest+json; add_header Cache-Control "no-cache"; }\n}\n' > /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# nginx runs in the foreground by default in this image.

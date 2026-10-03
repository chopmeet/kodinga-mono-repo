FROM node:24-alpine AS build

ENV NX_DAEMON=false \
    NX_NO_CLOUD=true

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx build web

# ---- runtime: nginx serves the bundle and proxies the api ----
FROM nginx:alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/apps/web /usr/share/nginx/html

EXPOSE 80

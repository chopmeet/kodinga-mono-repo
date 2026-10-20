FROM node:24-alpine AS build

ENV NX_DAEMON=false \
    NX_NO_CLOUD=true

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Public origin baked into index.html (og:image...). Empty = vite.config default.
ARG VITE_SITE_URL=""
ENV VITE_SITE_URL=$VITE_SITE_URL
# dev | demo | prod: picks the api and app urls in src/utils/http.ts
ARG VITE_APP_ENV="dev"
ENV VITE_APP_ENV=$VITE_APP_ENV

RUN npx nx build web

# ---- runtime: nginx serves the bundle and proxies the api ----
FROM nginx:alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/apps/web /usr/share/nginx/html

EXPOSE 80

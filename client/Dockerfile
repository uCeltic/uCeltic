# --- build the SPA ---
# The bundle is plain JS/CSS, identical on every architecture, so pin this stage
# to the builder's native arch. Without it the arm64 half of the multi-arch build
# (#72) runs npm + esbuild + rollup under QEMU emulation, which took >70 min.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# --- serve SPA + reverse-proxy via Caddy ---
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
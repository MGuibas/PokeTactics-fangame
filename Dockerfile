# PokéTactics 3D — imagen de producción
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production PORT=8097

# Dependencias (el postinstall copia three.js y la fuente a public/vendor)
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci --omit=dev

# Código del juego
COPY server ./server
COPY public ./public
RUN node scripts/copy-vendor.js

EXPOSE 8097
USER node
CMD ["node", "server/server.js"]

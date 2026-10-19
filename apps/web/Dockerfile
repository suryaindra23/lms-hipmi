FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/web apps/web
ARG API_URL=http://api:3000/api/v1
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3001
ARG NEXT_PUBLIC_STORAGE_ORIGIN=http://localhost:9000
ENV API_URL=$API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_STORAGE_ORIGIN=$NEXT_PUBLIC_STORAGE_ORIGIN
RUN npm run build --workspace apps/web

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/web/public apps/web/public
COPY --from=build /app/apps/web/private apps/web/private
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static apps/web/.next/static
USER node
EXPOSE 3001
ENV PORT=3001
ARG NEXT_PUBLIC_STORAGE_ORIGIN=http://localhost:9000
ENV NEXT_PUBLIC_STORAGE_ORIGIN=$NEXT_PUBLIC_STORAGE_ORIGIN
CMD ["node", "apps/web/server.js"]

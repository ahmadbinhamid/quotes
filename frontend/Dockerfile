# Build the Vite app, then serve the static bundle with nginx.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
# package.json references these via file:../../flowpos-ui/packages/*, which
# resolves to /flowpos-ui/packages/* from /app — see additional_contexts in
# docker-compose.yml for where this comes from.
COPY --from=flowpos-ui . /flowpos-ui
# Deliberately not copying package-lock.json here: npm's arborist has a
# long-standing bug (crashes with "Cannot read properties of undefined
# (reading 'extraneous')") when reconciling a lockfile against a file:
# dependency whose target lives outside the project root, as ours does.
# Resolving fresh from package.json avoids that code path entirely.
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

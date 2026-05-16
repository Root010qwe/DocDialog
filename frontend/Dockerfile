FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# nginx official image runs envsubst on templates/ at startup → writes to conf.d/
# Set BACKEND_URL env var: http://backend:8000 locally, https://<backend>.up.railway.app on Railway
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 80

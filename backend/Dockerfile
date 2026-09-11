# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN rm -f tsconfig.tsbuildinfo
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/templates ./src/templates
COPY --from=build /app/package.json ./
EXPOSE 3000
USER node
CMD ["node", "dist/main"]   

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN chown -R node:node /app
EXPOSE 3615
USER node
CMD ["npm", "start"]

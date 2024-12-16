FROM node:lts-alpine

WORKDIR /app
COPY . /app
RUN npm install
RUN npm run build
RUN npm prune --production

EXPOSE 3000
CMD ["node", "app.min.js"]
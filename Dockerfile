FROM node:20-slim 

WORKDIR /app

COPY . .

RUN npm install

EXPOSE 5000

CMD sh -c "npm run setup && npm run env-fill && npm start"
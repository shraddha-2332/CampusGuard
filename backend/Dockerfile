FROM node:22-alpine

WORKDIR /app
RUN apk add --no-cache poppler-utils tesseract-ocr tesseract-ocr-data-eng
COPY package.json ./
COPY src ./src

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["npm", "start"]

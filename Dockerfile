FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "exec npm run start -- -H 0.0.0.0 -p ${PORT:-3000}"]

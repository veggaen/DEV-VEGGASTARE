FROM node:18-bullseye-slim

# Prisma runtime deps (OpenSSL + CA certs)
RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

# Create and change to the app directory.
WORKDIR /usr/src

# Copy application dependency manifests to the container image.
COPY package*.json ./

# Install all dependencies including devDependencies.
RUN npm install

# Copy local code to the container image.
COPY . .

# Generate Prisma Client.
RUN npx prisma generate

# Build the TypeScript project.
RUN npm run build

# Expose the ports the app runs on (HTTP + optional WS).
EXPOSE 3001
EXPOSE 3002

# Start the application using node.
CMD ["node", "dist/index.js"]
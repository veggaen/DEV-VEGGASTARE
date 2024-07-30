# Use the official Node.js image.
FROM node:18-alpine

# Create and change to the app directory.
WORKDIR /usr/src

# Install Prisma globally.
RUN npm install -g prisma

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

# Expose the port the app runs on.
EXPOSE 3002

# Start the application using node.
CMD ["node", "dist/index.js"]
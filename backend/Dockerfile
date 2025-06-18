# Use Node.js base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json .
RUN npm install

# Copy server.js
COPY server.js .

# Expose port 3000
EXPOSE 3000

# Start the server
CMD ["node", "server.js"]

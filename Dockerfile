FROM node:20-alpine AS builder

# Create app directory
WORKDIR /usr/src/app

# Copy and install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Clean up
RUN npm cache clean --force

# Final minimal image
FROM node:20-alpine
    
WORKDIR /usr/src/app

# Copy built app from builder stage
COPY --from=builder /usr/src/app .

EXPOSE 30001

CMD ["npm", "run", "start"]

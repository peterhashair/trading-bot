# Base image
ARG TARGETPLATFORM=linux/arm64
FROM --platform=${TARGETPLATFORM} node:22-slim
ENV ECS=true
ENV PORT=80
# Create app directory
WORKDIR /usr/src/app

# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Running `npm ci` removes the existing node_modules directory and passing in --only=production ensures that only the production dependencies are installed. This ensures that the node_modules directory is as optimized as possible
RUN npm install --quiet

COPY . .

RUN npm run build:app

EXPOSE 80
EXPOSE 443
# Start the server using the production
CMD [ "npm", "start" ]
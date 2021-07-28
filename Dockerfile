FROM node:16.5.0-buster AS base

FROM base AS build

# Build stage. Includes dev dependencies.

WORKDIR /tmp

COPY package.json package-lock.json ./
RUN npm install 
COPY . .
RUN npm run prepack

FROM base AS prod

# Prod stage. No dev dependencies, copies in built .js files

ENV NODE_ENV=production
ENV DEADTOUS_STORAGE=/data
ENV DEADTOUS_SLACK_TOKENS=

WORKDIR /opt/deadtous
RUN chown -R node:node /opt/deadtous
USER node

COPY package.json package-lock.json ./
RUN npm install
COPY --from=build --chown=node:node /tmp/bin ./bin
COPY --from=build --chown=node:node /tmp/lib ./lib

FROM prod AS lambda-build

# Lambda build stage. Builds aws-lambda-ric.

USER root
RUN apt-get update && apt-get install -y \
    g++ \
    make \
    cmake \
    unzip \
    libcurl4-openssl-dev

# Emulator - not included in final build but useful for testing if built to this stage
RUN curl -Lo /usr/local/bin/aws-lambda-rie \
        https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie && \
    chmod +x /usr/local/bin/aws-lambda-rie

USER node
RUN npm install aws-lambda-ric

ENTRYPOINT [ "aws-lambda-rie", "--log-level", "DEBUG", "npx", "aws-lambda-ric" ]
CMD ["lib/lambda.handler"]

FROM lambda-build AS lambda

# Lambda final stage. Copies in prod build with lambda runtime/entrypoint.

COPY --from=lambda-build /opt/deadtous /opt/deadtous

ENTRYPOINT ["npx", "aws-lambda-ric"]
CMD ["lib/lambda.handler"]

FROM prod AS final

ENV DEADTOUS_PORT=80

# Regular final stage. Prod stage with server entrypoint.

ENTRYPOINT [ "bin/run" ]
CMD [ "server", "--port", "$DEADTOUS_PORT" "--tokens", "$DEADTOUS_SLACK_TOKENS" ]

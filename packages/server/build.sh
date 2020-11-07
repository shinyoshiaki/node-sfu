#!/bin/sh
yarn organize-imports-cli src/**/*.ts
yarn prettier --write src/**/*.ts
rm -rf lib
yarn tsc

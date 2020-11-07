#!/bin/sh
rm -rf lib
yarn fix
yarn unused
yarn format
yarn test
yarn tsc
cd lib
mv src/* .
rm -rf demo
rm -rf tests
rm -rf src

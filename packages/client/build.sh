#!/bin/sh
rm -rf lib
yarn tsc
cd lib
mv client/src/* .
rm -rf client
rm -rf core

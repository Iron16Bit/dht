#!/bin/bash
truncate -s 0 ./interface.txt
[[ -d dist/ ]] && sudo rm -r dist/
mkdir dist/
mkdir dist/src/
cp -r src dist/
cp index.html dist/index.html
cp interface.txt dist/interface.txt
nexe -i 'src/server.js' -r src/ -o dist/server -t x64-14.15.3
cd dist/
truncate -s 0 ./interface.txt
chmod +x server
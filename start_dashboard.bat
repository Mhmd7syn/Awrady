@echo off
title Awrady Dashboard Local Server
echo Starting local web server on port 8080...
start "" "http://localhost:8080"
python -m http.server 8080

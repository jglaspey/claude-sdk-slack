#!/bin/bash
# Wrapper script to run claude CLI with stdin redirected from /dev/null
# This fixes the "spawn node ENOENT" issue in Docker containers

exec </dev/null
exec claude "$@"

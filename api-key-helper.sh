#!/bin/sh
# API key helper script that returns the ANTHROPIC_API_KEY
# This allows the Claude CLI to use API key authentication instead of OAuth
echo "$ANTHROPIC_API_KEY"

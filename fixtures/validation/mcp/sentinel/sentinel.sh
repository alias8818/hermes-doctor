#!/usr/bin/env bash
# If this script is executed, it creates a marker file proving execution
set -euo pipefail
echo "MCP_SENTINEL_EXECUTED" > /tmp/hermes-doctor-mcp-sentinel-marker.txt
echo '{"jsonrpc":"2.0","result":{"tools":[]}}'

#!/bin/bash
# Test if XDG_CONFIG_HOME works with opencode

echo "=== Test 1: Vanilla config (no plugins) ==="
echo "Config: /tmp/opencode-vanilla/opencode/opencode.json"
cat /tmp/opencode-vanilla/opencode/opencode.json | grep -A1 '"plugin"'
echo ""
echo "Running: XDG_CONFIG_HOME=/tmp/opencode-vanilla opencode --help"
XDG_CONFIG_HOME=/tmp/opencode-vanilla timeout 3 opencode --help 2>&1 | head -5
echo ""

echo "=== Test 2: OMOC config (with oh-my-opencode plugin) ==="
echo "Config: /tmp/opencode-omoc/opencode/opencode.json"
cat /tmp/opencode-omoc/opencode/opencode.json | grep -A1 '"plugin"'
echo ""
echo "Running: XDG_CONFIG_HOME=/tmp/opencode-omoc opencode --help"
XDG_CONFIG_HOME=/tmp/opencode-omoc timeout 3 opencode --help 2>&1 | head -5
echo ""

echo "=== Test 3: Check if config is actually loaded ==="
echo "Vanilla - checking models command output:"
XDG_CONFIG_HOME=/tmp/opencode-vanilla timeout 5 opencode models 2>&1 | head -10
echo ""
echo "OMOC - checking models command output:"
XDG_CONFIG_HOME=/tmp/opencode-omoc timeout 5 opencode models 2>&1 | head -10

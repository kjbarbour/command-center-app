#!/bin/bash

# Morning Routine Installation Script
# Run this script to set up the morning routine service

set -e  # Exit on any error

echo "🚀 Installing Morning Routine Service..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Paths
APP_DIR="$HOME/Desktop/command-center-app"
PLIST_FILE="$HOME/Library/LaunchAgents/com.commandcenter.morningroutine.plist"
SERVICE_FILE="$APP_DIR/morning-routine-service.js"

# Check if app directory exists
if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}❌ Error: App directory not found at $APP_DIR${NC}"
    exit 1
fi

echo "📂 App directory found"

# Check if service file exists
if [ ! -f "$SERVICE_FILE" ]; then
    echo -e "${RED}❌ Error: morning-routine-service.js not found${NC}"
    echo "Please copy the morning-routine-service.js file to $APP_DIR first"
    exit 1
fi

echo "✅ Service file found"

# Install dependencies if needed
echo "📦 Checking dependencies..."
cd "$APP_DIR"

if [ ! -d "node_modules/@anthropic-ai/sdk" ]; then
    echo "Installing @anthropic-ai/sdk..."
    npm install @anthropic-ai/sdk
else
    echo "✅ Dependencies already installed"
fi

# Make service executable
echo "🔧 Making service executable..."
chmod +x "$SERVICE_FILE"

# Copy plist file to LaunchAgents
echo "📋 Installing LaunchAgent..."

if [ -f "$PLIST_FILE" ]; then
    echo -e "${YELLOW}⚠️  LaunchAgent already exists. Unloading...${NC}"
    launchctl unload "$PLIST_FILE" 2>/dev/null || true
fi

# The plist file should already be created from the artifact
# If it exists in the app directory, copy it
if [ -f "$APP_DIR/com.commandcenter.morningroutine.plist" ]; then
    cp "$APP_DIR/com.commandcenter.morningroutine.plist" "$PLIST_FILE"
    echo "✅ Plist file copied"
else
    echo -e "${RED}❌ Error: com.commandcenter.morningroutine.plist not found${NC}"
    echo "Please copy the plist file to $APP_DIR first"
    exit 1
fi

# Set correct permissions
chmod 644 "$PLIST_FILE"

# Load the LaunchAgent
echo "🔄 Loading LaunchAgent..."
launchctl load "$PLIST_FILE"

# Verify it's loaded
if launchctl list | grep -q "com.commandcenter.morningroutine"; then
    echo -e "${GREEN}✅ LaunchAgent loaded successfully!${NC}"
else
    echo -e "${RED}❌ Failed to load LaunchAgent${NC}"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Installation Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📅 The morning routine will run daily at 7:00 AM"
echo ""
echo "🧪 Test Commands:"
echo "  • Test now:    node $SERVICE_FILE"
echo "  • Check logs:  tail -f $APP_DIR/morning-routine.log"
echo "  • Check status: launchctl list | grep morningroutine"
echo ""
echo "🛠️  Management Commands:"
echo "  • Unload:   launchctl unload $PLIST_FILE"
echo "  • Reload:   launchctl unload $PLIST_FILE && launchctl load $PLIST_FILE"
echo "  • Start now: launchctl start com.commandcenter.morningroutine"
echo ""
echo "💡 You can also trigger it manually from the widget UI!"
echo ""
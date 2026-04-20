#!/bin/bash

# AI Voice Recruiter - Asterisk Installation Script
# Run as: sudo bash asterisk-setup.sh

echo "=========================================="
echo "  AI Voice Recruiter - Asterisk Setup"
echo "=========================================="

# Update system
echo "[1/8] Updating system..."
apt update && apt upgrade -y

# Install dependencies
echo "[2/8] Installing dependencies..."
apt install -y build-essential git wget libssl-dev libncurses5-dev libsqlite3-dev libmariadb-dev libsrtp0-dev

# Download Asterisk
echo "[3/8] Downloading Asterisk 20..."
cd /usr/src
wget -q http://downloads.asterisk.org/pub/telephony/asterisk/asterisk-20-current.tar.gz

# Extract
echo "[4/8] Extracting..."
tar -xvf asterisk-20-current.tar.gz
cd asterisk-20*

# Configure and install
echo "[5/8] Configuring Asterisk..."
./configure --with-pjproject-bundled --with-jansson-bundled

# Install Asterisk
echo "[6/8] Installing Asterisk (this may take a while)..."
make
make install
make samples

# Create asterisk user (optional, for security)
echo "[7/8] Setting up Asterisk service..."

# Start Asterisk
echo "[8/8] Starting Asterisk..."
asterisk -rvvv

echo "=========================================="
echo "  Installation Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Configure SIP trunk in /etc/asterisk/sip.conf"
echo "2. Configure dial plan in /etc/asterisk/extensions.conf"
echo "3. Add AMI user in /etc/asterisk/manager.conf"
echo "4. Restart Asterisk: asterisk -rx 'reload'"

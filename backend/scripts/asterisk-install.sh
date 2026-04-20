#!/bin/bash

# AI Voice Recruiter - Asterisk Installation Script
# Run on Ubuntu 22.04 VPS

set -e

echo "=========================================="
echo "  Installing Asterisk for AI Recruiter"
echo "=========================================="

# Update system
echo "[1/6] Updating system..."
apt update && apt upgrade -y

# Install dependencies
echo "[2/6] Installing dependencies..."
apt install -y build-essential git wget libssl-dev libncurses5-dev libsqlite3-dev libmariadb-dev libsrtp0-dev libspeex-dev libspeexdsp-dev libogg-dev libvorbis-dev libasound2-dev portaudio19-dev libpq-dev libnewt-dev libusb-dev

# Download Asterisk
echo "[3/6] Downloading Asterisk 20..."
cd /usr/src
wget -q http://downloads.asterisk.org/pub/telephony/asterisk/asterisk-20-current.tar.gz
tar -xvf asterisk-20-current.tar.gz
cd asterisk-20*

# Configure and install
echo "[4/6] Configuring Asterisk..."
./configure --with-pjproject-bundled --with-jansson-bundled --libdir=/usr/lib

echo "[5/6] Installing Asterisk (may take 10-15 minutes)..."
make -j$(nproc)
make install
make samples

# Configure AMI
echo "[6/6] Configuring AMI..."
cat > /etc/asterisk/manager.conf << 'EOF'
[general]
enabled=yes
port=5038
bindaddr=0.0.0.0

[admin]
secret=admin123
read=system,call,log,verbose,command,agent,user,config
write=system,call,log,verbose,command,agent,user,config
EOF

# Configure SIP
cat > /etc/asterisk/sip.conf << 'EOF'
[general]
context=from-sip
bindport=5060
bindaddr=0.0.0.0
srvlookup=yes
disallow=all
allow=ulaw
allow=alaw
allow=g729

[exotel]
type=peer
host=sip.exotel.com
port=5060
username=YOUR_USERNAME
secret=YOUR_PASSWORD
fromuser=YOUR_NUMBER
context=from-sip
insecure=port,invite
EOF

# Configure dial plan
cat > /etc/asterisk/extensions.conf << 'EOF'
[from-sip]
exten => s,1,Answer()
exten => s,n,Wait(1)
exten => s,n,Playback(welcome)
exten => s,n,Hangup()

[from-outbound]
exten => _X.,1,Answer()
exten => _X.,n,Dial(SIP/${EXTEN}@exotel,30)
exten => _X.,n,Hangup()
EOF

# Start Asterisk
echo ""
echo "=========================================="
echo "  Installation Complete!"
echo "=========================================="
echo ""
echo "To start Asterisk: asterisk -rvvv"
echo ""
echo "IMPORTANT: Update your credentials:"
echo "  - Edit /etc/asterisk/sip.conf for SIP trunk"
echo "  - Edit /etc/asterisk/manager.conf for AMI password"
echo ""
echo "Then restart: asterisk -rx 'reload'"

#!/usr/bin/env python3
import subprocess
import sys
import os

os.chdir('/Users/varsityhub/Desktop/CODE/VarsityHubMobile')

# Kill any existing processes
subprocess.run(['pkill', '-9', 'expo'], capture_output=True)
subprocess.run(['pkill', '-9', 'node'], capture_output=True)
subprocess.run(['pkill', '-9', 'metro'], capture_output=True)

import time
time.sleep(2)

print("Starting Metro bundler...")
subprocess.Popen(['npx', 'expo', 'start', '--dev-client'], 
                 stdout=subprocess.DEVNULL,
                 stderr=subprocess.DEVNULL)

print("Metro process spawned. Waiting 15 seconds...")
time.sleep(15)

# Check if port is open
import socket
try:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('127.0.0.1', 8081))
    sock.close()
    if result == 0:
        print("✅ METRO IS RUNNING ON PORT 8081!")
    else:
        print("❌ Metro is NOT running on port 8081")
except Exception as e:
    print(f"Error checking port: {e}")

#!/usr/bin/env python3
import os
import sys
import argparse
import subprocess
import signal
import time
import webbrowser

def main():
    parser = argparse.ArgumentParser(description='BlockPot AI - Honeypot Command Monitoring System')
    parser.add_argument('--log-file', type=str, default='/home/guna-teja/cowrie/var/log/cowrie/cowrie.json',
                        help='Path to the cowrie.json log file')
    parser.add_argument('--model-path', type=str, 
                        default='/home/guna-teja/Desktop/hackathonX/blockPot-AI/trained_command_classifier',
                        help='Path to the trained model directory')
    parser.add_argument('--port', type=int, default=5000,
                        help='Port for the web interface')
    parser.add_argument('--no-browser', action='store_true',
                        help='Disable automatic browser opening')
    
    args = parser.parse_args()
    
    # Check if files exist
    if not os.path.exists(args.log_file):
        print(f"Error: Log file not found at {args.log_file}")
        return 1
    
    if not os.path.exists(os.path.join(args.model_path, 'model.h5')):
        print(f"Error: Model not found at {args.model_path}")
        return 1
    
    # Run the web interface
    print(f"Starting BlockPot AI monitoring system...")
    print(f"Monitoring log file: {args.log_file}")
    print(f"Using model from: {args.model_path}")
    print(f"Web interface will be available at: http://localhost:{args.port}")
    
    # Import the web app module
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from web_interface import app, socketio, processor, observer
    
    # Update paths
    processor.log_file_path = args.log_file
    
    # Open browser if not disabled
    if not args.no_browser:
        webbrowser.open(f"http://localhost:{args.port}")
    
    # Start the web server
    try:
        socketio.run(app, host='0.0.0.0', port=args.port, debug=False)
    except KeyboardInterrupt:
        print("\nShutting down BlockPot AI monitoring system...")
    finally:
        observer.stop()
        observer.join()
    
    return 0

if __name__ == '__main__':
    sys.exit(main())

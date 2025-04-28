#!/usr/bin/env python3
import os
import sys
import argparse
import subprocess
import signal
import time
import webbrowser
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('blockpot')

def check_file_readable(path):
    """Check if a file exists and is readable."""
    if not os.path.exists(path):
        logger.error(f"File does not exist: {path}")
        return False
    if not os.access(path, os.R_OK):
        logger.error(f"File exists but is not readable: {path}")
        return False
    return True

def main():
    parser = argparse.ArgumentParser(description='BlockPot AI - Honeypot Command Monitoring System')
    parser.add_argument('--log-file', type=str, default='/home/guna-teja/cowrie/var/log/cowrie/cowrie.json',
                        help='Path to the cowrie.json log file')
    parser.add_argument('--model-path', type=str,
                        default='/home/guna-teja/Desktop/project/Blockpot/trained_command_classifier',
                        help='Path to the trained model directory')
    parser.add_argument('--port', type=int, default=5000,
                        help='Port for the web interface')
    parser.add_argument('--no-browser', action='store_true',
                        help='Disable automatic browser opening')
    parser.add_argument('--debug', action='store_true',
                        help='Enable debug mode')
    
    args = parser.parse_args()
    
    # Set debug level if requested
    if args.debug:
        logger.setLevel(logging.DEBUG)
    
    # Check if files exist and are readable
    logger.info(f"Checking log file: {args.log_file}")
    if not check_file_readable(args.log_file):
        return 1
    
    model_file = os.path.join(args.model_path, 'model.h5')
    logger.info(f"Checking model file: {model_file}")
    if not check_file_readable(model_file):
        return 1
    
    # Set environment variables for child processes
    os.environ['BLOCKPOT_LOG_FILE'] = args.log_file
    os.environ['BLOCKPOT_MODEL_PATH'] = args.model_path
    
    # Add current directory to path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, current_dir)
    logger.debug(f"Added to sys.path: {current_dir}")
    
    # Log Python path for debugging
    logger.debug(f"Python path: {sys.path}")
    
    # Try to import the modules
    try:
        logger.info("Importing command_monitor...")
        from command_monitor import start_monitoring
        
        logger.info("Starting monitoring process...")
        processor, observer = start_monitoring(args.log_file, args.model_path)
        
        logger.info("Importing web_interface...")
        # Using relative import syntax
        from web_interface import app, socketio
        
        logger.info("All modules imported successfully")
    except ImportError as e:
        logger.error(f"Failed to import modules: {e}")
        logger.error("Make sure all required files are in the correct locations")
        return 1
    
    # Run the web interface
    logger.info(f"Starting BlockPot AI monitoring system...")
    logger.info(f"Monitoring log file: {args.log_file}")
    logger.info(f"Using model from: {args.model_path}")
    logger.info(f"Web interface will be available at: http://localhost:{args.port}")
    
    # Open browser if not disabled
    if not args.no_browser:
        webbrowser.open(f"http://localhost:{args.port}")
    
    # Start the web server
    try:
        logger.info("Starting web server...")
        socketio.run(app, host='0.0.0.0', port=args.port, debug=args.debug)
    except KeyboardInterrupt:
        logger.info("\nShutting down BlockPot AI monitoring system...")
    except Exception as e:
        logger.error(f"Error starting server: {e}")
    finally:
        logger.info("Stopping observer...")
        observer.stop()
        observer.join()
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
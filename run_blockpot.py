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

def check_directory_exists(path):
    """Check if directory exists and create if it doesn't."""
    if not os.path.exists(path):
        logger.info(f"Creating directory: {path}")
        os.makedirs(path, exist_ok=True)
    return True

def main():
    parser = argparse.ArgumentParser(description='BlockPot AI - Honeypot Command Monitoring System')
    parser.add_argument('--log-file', type=str, default='/home/guna-teja/cowrie/var/log/cowrie/cowrie.json',
                        help='Path to the cowrie.json log file')
    parser.add_argument('--model-path', type=str,
                        default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'trained_command_classifier'),
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
        
    # Ensure log file directory exists
    log_dir = os.path.dirname(args.log_file)
    check_directory_exists(log_dir)
    
    # If log file doesn't exist, create an empty one
    if not os.path.exists(args.log_file):
        logger.info(f"Log file doesn't exist. Creating empty file at {args.log_file}")
        with open(args.log_file, 'w') as f:
            pass
    
    # Check if model directory exists, if not try to create it
    check_directory_exists(args.model_path)
    
    # Set environment variables for child processes
    os.environ['BLOCKPOT_LOG_FILE'] = args.log_file
    os.environ['BLOCKPOT_MODEL_PATH'] = args.model_path
    
    # Add current directory to path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
    logger.debug(f"Added to sys.path: {current_dir}")
    
    # Log Python path for debugging
    logger.debug(f"Python path: {sys.path}")
    
    # Try to import the modules
    try:
        logger.info("Importing command_monitor...")
        sys.path.append(current_dir)  # Add current directory to path again to be sure
        
        # Import using direct path
        command_monitor_path = os.path.join(current_dir, 'command_monitor.py')
        if os.path.exists(command_monitor_path):
            logger.debug(f"Found command_monitor.py at {command_monitor_path}")
        
        # Try multiple import approaches
        try:
            from command_monitor import start_monitoring
        except ImportError:
            # Try alternate approach with explicit module creation
            import importlib.util
            spec = importlib.util.spec_from_file_location("command_monitor", command_monitor_path)
            command_monitor = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(command_monitor)
            start_monitoring = command_monitor.start_monitoring
        
        logger.info("Starting monitoring process...")
        processor, observer = start_monitoring(args.log_file, args.model_path)
        
        logger.info("Importing web_interface...")
        # Using relative import syntax
        try:
            from web_interface import app, socketio
        except ImportError:
            # Try alternate approach with explicit module creation
            web_interface_path = os.path.join(current_dir, 'web_interface.py')
            spec = importlib.util.spec_from_file_location("web_interface", web_interface_path)
            web_interface = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(web_interface)
            app = web_interface.app
            socketio = web_interface.socketio
        
        logger.info("All modules imported successfully")
    except ImportError as e:
        logger.error(f"Failed to import modules: {e}")
        logger.error("Make sure all required files are in the correct locations")
        return 1
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return 1
    
    # Run the web interface
    logger.info(f"Starting BlockPot AI monitoring system...")
    logger.info(f"Monitoring log file: {args.log_file}")
    logger.info(f"Using model from: {args.model_path}")
    logger.info(f"Web interface will be available at: http://localhost:{args.port}")
    
    # Create templates directory if it doesn't exist
    templates_dir = os.path.join(current_dir, 'templates')
    if not os.path.exists(templates_dir):
        logger.info(f"Creating templates directory at {templates_dir}")
        os.makedirs(templates_dir, exist_ok=True)
    
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
import os
import json
import time
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Import ML model and NLP processor - fixed import paths
import sys
# Get the current directory and add it to the path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)
# Make sure the ai_model directory is in the path
ai_model_path = os.path.join(os.path.dirname(current_dir), 'ai_model')
sys.path.append(ai_model_path)

# Safe imports that check module existence first
try:
    from ai_model.model import CommandClassifier
    from ai_model.nlp_processor import CommandNLPAnalyzer
except ImportError:
    # Fallback to direct imports if the module path doesn't work
    try:
        from ai_model import CommandClassifier
        from ai_model import CommandNLPAnalyzer
    except ImportError:
        print("ERROR: Could not import model or NLP processor. Check file paths.")
        raise

class CowrieLogProcessor:
    def __init__(self, log_file_path, model_path):
        self.log_file_path = log_file_path
        
        # Check if files exist
        if not os.path.exists(log_file_path):
            print(f"WARNING: Log file not found at {log_file_path}")
            # Create empty file if it doesn't exist
            open(log_file_path, 'a').close()
            
        if not os.path.exists(model_path):
            print(f"ERROR: Model path not found at {model_path}")
            
        try:
            self.classifier = CommandClassifier(model_path)
            self.nlp_analyzer = CommandNLPAnalyzer()
        except Exception as e:
            print(f"ERROR initializing models: {e}")
            raise
            
        self.latest_commands = []
        self.max_commands = 100  # Keep track of last 100 commands
        self.lock = threading.Lock()
        self.last_position = 0  # Track position in file
        
        # Initialize with existing commands from the log file
        self._process_existing_logs()
        
    def _process_existing_logs(self):
        """Process existing log entries when starting up"""
        if os.path.exists(self.log_file_path):
            try:
                with open(self.log_file_path, 'r') as f:
                    for line in f:
                        if line.strip():
                            try:
                                self._process_log_line(line)
                            except json.JSONDecodeError:
                                # Skip malformed JSON lines
                                continue
                    # Remember position for file monitoring
                    self.last_position = f.tell()
            except Exception as e:
                print(f"Error processing existing logs: {e}")
    
    def _process_log_line(self, line):
        """Process a single log line from the cowrie log file"""
        try:
            log_entry = json.loads(line)
            
            # Check if this is a command execution event
            if log_entry.get('eventid') == 'cowrie.command.input':
                command = log_entry.get('input', '').strip()
                if command:
                    # Process with ML model
                    ml_result = self.classifier.predict(command)
                    
                    # Process with NLP analyzer
                    nlp_result = self.nlp_analyzer.analyze_intent(command)
                    
                    # Combine results
                    result = {
                        'timestamp': log_entry.get('timestamp', time.strftime('%Y-%m-%dT%H:%M:%S.%fZ')),
                        'session': log_entry.get('session', 'unknown'),
                        'src_ip': log_entry.get('src_ip', 'unknown'),
                        'command': command,
                        'ml_classification': ml_result['classification'],
                        'ml_confidence': ml_result['confidence'],
                        'ml_probabilities': ml_result['probabilities'],
                        'risk_score': nlp_result['risk_score'],
                        'intent': nlp_result['intent_classification'],
                        'actions': nlp_result['actions'],
                        'features': nlp_result['features']
                    }
                    
                    # Add to our list of commands
                    with self.lock:
                        self.latest_commands.append(result)
                        # Keep only the most recent commands
                        if len(self.latest_commands) > self.max_commands:
                            self.latest_commands = self.latest_commands[-self.max_commands:]
                            
                    print(f"Processed command: {command}")
        except Exception as e:
            print(f"Error processing log entry: {e}")
    
    def get_latest_commands(self):
        """Return the latest processed commands"""
        with self.lock:
            return list(self.latest_commands)
    
    def process_file_update(self):
        """Process the log file for new entries"""
        try:
            with open(self.log_file_path, 'r') as f:
                # Seek to the last read position
                f.seek(self.last_position)
                
                # Read any new lines
                new_lines = f.readlines()
                
                # Update position
                self.last_position = f.tell()
                
                # Process new lines
                for line in new_lines:
                    if line.strip():
                        self._process_log_line(line)
        except Exception as e:
            print(f"Error reading log file: {e}")


class LogFileHandler(FileSystemEventHandler):
    def __init__(self, processor):
        self.processor = processor
        
    def on_modified(self, event):
        if not event.is_directory and event.src_path == self.processor.log_file_path:
            # Process any new entries
            self.processor.process_file_update()


def start_monitoring(log_file_path, model_path):
    """Start monitoring the cowrie log file"""
    print(f"Starting monitoring of: {log_file_path}")
    print(f"Using model from: {model_path}")
    
    # Ensure the log directory exists
    os.makedirs(os.path.dirname(log_file_path), exist_ok=True)
    
    # Create an empty log file if it doesn't exist
    if not os.path.exists(log_file_path):
        print(f"Log file not found, creating empty file at: {log_file_path}")
        open(log_file_path, 'a').close()
    
    try:
        processor = CowrieLogProcessor(log_file_path, model_path)
        
        # Set up file watching
        event_handler = LogFileHandler(processor)
        observer = Observer()
        observer.schedule(event_handler, os.path.dirname(log_file_path), recursive=False)
        observer.start()
        
        return processor, observer
    except Exception as e:
        print(f"Error starting monitoring: {e}")
        raise


if __name__ == "__main__":
    # Paths - use environment variables if available, otherwise use defaults
    LOG_FILE = os.environ.get('BLOCKPOT_LOG_FILE', '/home/guna-teja/cowrie/var/log/cowrie/cowrie.json')
    MODEL_PATH = os.environ.get('BLOCKPOT_MODEL_PATH', '/home/guna-teja/Desktop/project/trained_command_classifier')
    
    print(f"Starting BlockPot AI with log: {LOG_FILE} and model: {MODEL_PATH}")
    
    # Start monitoring
    processor, observer = start_monitoring(LOG_FILE, MODEL_PATH)
    
    try:
        # Keep the main thread running
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()
import os
import json
import time
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from datetime import datetime

# Import your ML model and NLP processor
import sys
sys.path.append('/home/guna-teja/Desktop/hackathonX/blockPot-AI/ai_model')
from model import CommandClassifier
from nlp_processor import CommandNLPAnalyzer

class CowrieLogProcessor:
    def __init__(self, log_file_path, model_path):
        self.log_file_path = log_file_path
        self.classifier = CommandClassifier(model_path)
        self.nlp_analyzer = CommandNLPAnalyzer()
        self.latest_commands = []
        self.max_commands = 100  # Keep track of last 100 commands
        self.lock = threading.Lock()
        
        # Initialize with existing commands from the log file
        self._process_existing_logs()
        
    def _process_existing_logs(self):
        """Process existing log entries when starting up"""
        if os.path.exists(self.log_file_path):
            with open(self.log_file_path, 'r') as f:
                for line in f:
                    if line.strip():
                        try:
                            self._process_log_line(line)
                        except json.JSONDecodeError:
                            # Skip malformed JSON lines
                            continue
    
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
                        'timestamp': log_entry.get('timestamp', datetime.now().isoformat()),
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
        except Exception as e:
            print(f"Error processing log entry: {e}")
    
    def get_latest_commands(self):
        """Return the latest processed commands"""
        with self.lock:
            return list(self.latest_commands)
    
    def process_file_update(self):
        """Process the log file for new entries"""
        try:
            # Get file size and read new content
            file_size = os.path.getsize(self.log_file_path)
            
            # Open the file and go to the end
            with open(self.log_file_path, 'r') as f:
                f.seek(0, 2)  # Go to the end
                
                # Start watching for changes
                while True:
                    line = f.readline()
                    if line:
                        self._process_log_line(line)
                    else:
                        time.sleep(0.1)  # Sleep briefly
        except Exception as e:
            print(f"Error watching log file: {e}")


class LogFileHandler(FileSystemEventHandler):
    def __init__(self, processor):
        self.processor = processor
        
    def on_modified(self, event):
        if not event.is_directory and event.src_path == self.processor.log_file_path:
            # Process any new entries
            self.processor.process_file_update()


def start_monitoring(log_file_path, model_path):
    """Start monitoring the cowrie log file"""
    processor = CowrieLogProcessor(log_file_path, model_path)
    
    # Set up file watching
    event_handler = LogFileHandler(processor)
    observer = Observer()
    observer.schedule(event_handler, os.path.dirname(log_file_path), recursive=False)
    observer.start()
    
    return processor, observer


if __name__ == "__main__":
    # Paths
    LOG_FILE = '/home/guna-teja/cowrie/var/log/cowrie/cowrie.json'
    MODEL_PATH = '/home/guna-teja/Desktop/hackathonX/blockPot-AI/trained_command_classifier'
    
    # Start monitoring
    processor, observer = start_monitoring(LOG_FILE, MODEL_PATH)
    
    try:
        # Keep the main thread running
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

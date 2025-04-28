"""
AI Model Package for Shell Command Classification and Analysis

This package provides tools for classifying and analyzing shell commands
to detect potentially malicious or suspicious behavior.
"""

from .model import CommandClassifier
from .nlp_processor import CommandNLPAnalyzer

__all__ = ['CommandClassifier', 'CommandNLPAnalyzer']

# Package version
__version__ = '0.1.0'
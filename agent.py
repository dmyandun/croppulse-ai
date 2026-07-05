import os
import sys

# Ensure the local directory takes precedence in sys.path to avoid importing
# a different app.py in the parent directory.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from workflow import root_workflow as root_agent

__all__ = ["app", "root_agent"]

#!/usr/bin/env python3
"""
Indeed Job Scraper Web Interface Launcher
Run this script to start the web interface
"""

import os
import sys
import subprocess

def check_requirements():
    """Check if all requirements are installed"""
    try:
        import flask
        import pandas
        import selenium
        import bs4
        print("✓ All required packages are installed")
        return True
    except ImportError as e:
        print(f"✗ Missing required package: {e}")
        print("Please install requirements: pip install -r requirements.txt")
        return False

def main():
    print("Indeed Job Scraper - Web Interface")
    print("=" * 40)
    
    # Check if we're in the right directory
    if not os.path.exists('app.py'):
        print("✗ Error: app.py not found. Please run this script from the IndeedJobScraper directory")
        sys.exit(1)
    
    # Check requirements
    if not check_requirements():
        sys.exit(1)
    
    print("✓ Starting web server...")
    print("✓ Open your browser and go to: http://localhost:5000")
    print("✓ Press Ctrl+C to stop the server")
    print("=" * 40)
    
    # Start the Flask app
    try:
        from app import app
        app.run(debug=True, host='0.0.0.0', port=5000)
    except KeyboardInterrupt:
        print("\n✓ Server stopped by user")
    except Exception as e:
        print(f"✗ Error starting server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

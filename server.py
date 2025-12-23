#!/usr/bin/env python3
"""
Local Podcast Server
Serves the podcast player web app and manages offline downloads.
"""

import http.server
import socketserver
import json
import os
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote
import threading
import requests

# Load configuration
CONFIG_FILE = Path("config.json")
if CONFIG_FILE.exists():
    with open(CONFIG_FILE, "r") as f:
        config = json.load(f)
else:
    # Default configuration
    config = {
        "app": {"port": 8080, "downloadsFolder": "data/podcasts"},
        "server": {"enableCORS": True, "timeout": 300},
    }

PORT = config["app"]["port"]
PODCASTS_DIR = Path(config["app"]["downloadsFolder"])
LIBRARY_FILE = PODCASTS_DIR / "library.json"
SERVER_TIMEOUT = config["server"]["timeout"]


class PodcastHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_GET(self):
        parsed_path = urlparse(self.path)

        # API endpoints
        if parsed_path.path == "/api/podcasts":
            self.serve_podcasts_list()
        elif parsed_path.path.startswith("/api/download"):
            self.handle_download_request(parsed_path)
        elif parsed_path.path == "/api/fetch-feed":
            self.fetch_rss_feed(parsed_path)
        elif parsed_path.path.startswith("/Podcasts/"):
            # Serve podcast files
            super().do_GET()
        else:
            # Serve static files (HTML, CSS, JS)
            super().do_GET()

    def fetch_rss_feed(self, parsed_path):
        """Fetch RSS feed and return raw XML"""
        params = parse_qs(parsed_path.query)
        feed_url = params.get("url", [""])[0]

        if not feed_url:
            self.send_error(400, "Missing URL parameter")
            return

        try:
            print(f"Fetching RSS feed: {feed_url}")
            response = requests.get(feed_url, timeout=SERVER_TIMEOUT)
            response.raise_for_status()

            self.send_response(200)
            self.send_header("Content-type", "application/xml")
            self.end_headers()
            self.wfile.write(response.content)
            print(f"Successfully fetched: {feed_url}")
        except Exception as e:
            print(f"Error fetching feed: {e}")
            self.send_error(500, f"Error fetching feed: {str(e)}")

    def serve_podcasts_list(self):
        """Serve the list of podcasts and their download status"""
        try:
            if LIBRARY_FILE.exists():
                with open(LIBRARY_FILE, "r", encoding="utf-8") as f:
                    library = json.load(f)
            else:
                library = {"podcasts": [], "episodes": {}}

            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(library).encode())
        except Exception as e:
            self.send_error(500, f"Error: {str(e)}")

    def handle_download_request(self, parsed_path):
        """Handle episode download request"""
        params = parse_qs(parsed_path.query)
        episode_url = params.get("url", [""])[0]
        title = params.get("title", ["episode"])[0]

        if not episode_url:
            self.send_error(400, "Missing URL parameter")
            return

        # Start download in background
        thread = threading.Thread(
            target=self.download_episode, args=(episode_url, title)
        )
        thread.daemon = True
        thread.start()

        self.send_response(202)  # Accepted
        self.send_header("Content-type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"status": "downloading", "title": title}).encode())

    def download_episode(self, url, title):
        """Download episode to Podcasts folder"""
        PODCASTS_DIR.mkdir(exist_ok=True)

        # Sanitize filename
        safe_title = "".join(
            c for c in title if c.isalnum() or c in (" ", "-", "_")
        ).strip()
        filepath = PODCASTS_DIR / f"{safe_title}.mp3"

        try:
            print(f"Downloading: {title}")
            response = requests.get(url, stream=True)
            response.raise_for_status()

            with open(filepath, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)

            print(f"✓ Downloaded: {filepath.name}")
        except Exception as e:
            print(f"✗ Error downloading {title}: {e}")

    def log_message(self, format, *args):
        # Override to reduce console noise
        if not self.path.startswith("/api/"):
            return
        super().log_message(format, *args)


def start_server():
    """Start the podcast server"""
    os.chdir(Path(__file__).parent)

    # Create podcasts directory if it doesn't exist
    PODCASTS_DIR.mkdir(parents=True, exist_ok=True)

    with socketserver.TCPServer(("", PORT), PodcastHTTPRequestHandler) as httpd:
        print("=" * 60)
        print(f"{config['app'].get('name', 'Podcast Player')} Server Started!")
        print("=" * 60)
        print(f"\nServer running at: http://localhost:{PORT}")
        print(f"Open in browser: http://localhost:{PORT}/public/index.html")
        print(f"Downloads folder: {PODCASTS_DIR.absolute()}")
        print("\nPress Ctrl+C to stop\n")

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\nServer stopped.")


if __name__ == "__main__":
    start_server()

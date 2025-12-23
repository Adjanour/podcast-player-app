#!/usr/bin/env python3
"""
Offline Podcast Manager
Downloads podcasts to local storage and serves them for offline playback.
"""

import os
import json
import requests
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlparse, unquote
import re
from datetime import datetime

# Load configuration
CONFIG_FILE = Path("config.json")
if CONFIG_FILE.exists():
    with open(CONFIG_FILE, 'r') as f:
        config = json.load(f)
else:
    # Default configuration
    config = {
        "app": {"downloadsFolder": "data/podcasts"},
        "server": {"timeout": 10}
    }

PODCASTS_DIR = Path(config["app"]["downloadsFolder"])
LIBRARY_FILE = PODCASTS_DIR / "library.json"
REQUEST_TIMEOUT = config["server"]["timeout"]

class PodcastManager:
    def __init__(self):
        self.podcasts_dir = PODCASTS_DIR
        self.podcasts_dir.mkdir(parents=True, exist_ok=True)
        self.library = self.load_library()

    def load_library(self):
        """Load podcast library from JSON file"""
        if LIBRARY_FILE.exists():
            with open(LIBRARY_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {"podcasts": [], "episodes": {}}

    def save_library(self):
        """Save podcast library to JSON file"""
        with open(LIBRARY_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.library, f, indent=2, ensure_ascii=False)

    def sanitize_filename(self, name):
        """Sanitize filename for filesystem"""
        # Remove invalid characters
        name = re.sub(r'[<>:"/\\|?*]', '', name)
        # Replace multiple spaces with single space
        name = re.sub(r'\s+', ' ', name)
        # Trim and limit length
        return name.strip()[:200]

    def fetch_rss_feed(self, feed_url):
        """Fetch and parse RSS feed"""
        try:
            response = requests.get(feed_url, timeout=REQUEST_TIMEOUT * 3)
            response.raise_for_status()
            return ET.fromstring(response.content)
        except Exception as e:
            print(f"Error fetching feed: {e}")
            return None

    def extract_text(self, element, tag, namespace=''):
        """Extract text from XML element"""
        if namespace:
            elem = element.find(f'{{{namespace}}}{tag}')
        else:
            elem = element.find(tag)
        return elem.text.strip() if elem is not None and elem.text else ''

    def get_image_url(self, element):
        """Extract image URL from various possible locations"""
        # Try iTunes image
        itunes_ns = 'http://www.itunes.com/dtds/podcast-1.0.dtd'
        image = element.find(f'{{{itunes_ns}}}image')
        if image is not None:
            return image.get('href', '')

        # Try standard image
        image = element.find('image')
        if image is not None:
            url_elem = image.find('url')
            if url_elem is not None:
                return url_elem.text.strip()

        return ''

    def add_podcast(self, feed_url):
        """Add a new podcast from RSS feed"""
        print(f"\nFetching podcast: {feed_url}")

        root = self.fetch_rss_feed(feed_url)
        if root is None:
            return False

        channel = root.find('channel')
        if channel is None:
            print("Invalid RSS feed")
            return False

        # Extract podcast info
        podcast = {
            'id': str(hash(feed_url)),
            'feedUrl': feed_url,
            'title': self.extract_text(channel, 'title'),
            'description': self.extract_text(channel, 'description'),
            'author': self.extract_text(channel, 'author', 'http://www.itunes.com/dtds/podcast-1.0.dtd'),
            'image': self.get_image_url(channel),
            'addedDate': datetime.now().isoformat()
        }

        # Create podcast directory
        podcast_dir = self.podcasts_dir / self.sanitize_filename(podcast['title'])
        podcast_dir.mkdir(exist_ok=True)

        # Download podcast artwork
        if podcast['image']:
            self.download_image(podcast['image'], podcast_dir / 'cover.jpg')

        # Add to library
        self.library['podcasts'].append(podcast)
        self.library['episodes'][podcast['id']] = []

        print(f"✓ Added podcast: {podcast['title']}")
        self.save_library()
        return True

    def download_image(self, url, filepath):
        """Download an image"""
        try:
            response = requests.get(url, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            with open(filepath, 'wb') as f:
                f.write(response.content)
            return True
        except Exception as e:
            print(f"  Warning: Could not download image: {e}")
            return False

    def update_episodes(self, podcast_id):
        """Update episodes list for a podcast"""
        podcast = next((p for p in self.library['podcasts'] if p['id'] == podcast_id), None)
        if not podcast:
            print("Podcast not found")
            return False

        print(f"\nUpdating episodes for: {podcast['title']}")

        root = self.fetch_rss_feed(podcast['feedUrl'])
        if root is None:
            return False

        channel = root.find('channel')
        items = channel.findall('item')

        itunes_ns = 'http://www.itunes.com/dtds/podcast-1.0.dtd'
        new_episodes = []

        for item in items:
            enclosure = item.find('enclosure')
            if enclosure is None or not enclosure.get('url'):
                continue

            episode = {
                'id': str(hash(enclosure.get('url'))),
                'title': self.extract_text(item, 'title'),
                'description': self.extract_text(item, 'description'),
                'pubDate': self.extract_text(item, 'pubDate'),
                'audioUrl': enclosure.get('url'),
                'duration': self.extract_text(item, 'duration', itunes_ns),
                'downloaded': False,
                'localPath': None
            }

            new_episodes.append(episode)

        self.library['episodes'][podcast_id] = new_episodes
        print(f"✓ Found {len(new_episodes)} episodes")
        self.save_library()
        return True

    def download_episode(self, podcast_id, episode_id):
        """Download a single episode"""
        podcast = next((p for p in self.library['podcasts'] if p['id'] == podcast_id), None)
        if not podcast:
            print("Podcast not found")
            return False

        episodes = self.library['episodes'].get(podcast_id, [])
        episode = next((e for e in episodes if e['id'] == episode_id), None)
        if not episode:
            print("Episode not found")
            return False

        if episode['downloaded']:
            print(f"Episode already downloaded: {episode['title']}")
            return True

        # Create episode directory
        podcast_dir = self.podcasts_dir / self.sanitize_filename(podcast['title'])
        podcast_dir.mkdir(exist_ok=True)

        # Determine file extension
        parsed_url = urlparse(episode['audioUrl'])
        filename = unquote(os.path.basename(parsed_url.path))
        if not filename or len(filename) > 200:
            ext = '.mp3'  # Default
            if 'audioUrl' in episode:
                if '.m4a' in episode['audioUrl']:
                    ext = '.m4a'
                elif '.ogg' in episode['audioUrl']:
                    ext = '.ogg'
            filename = f"{self.sanitize_filename(episode['title'])}{ext}"

        filepath = podcast_dir / filename

        print(f"\nDownloading: {episode['title']}")
        print(f"  To: {filepath}")

        try:
            response = requests.get(episode['audioUrl'], stream=True, timeout=REQUEST_TIMEOUT * 3)
            response.raise_for_status()

            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0

            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            progress = (downloaded / total_size) * 100
                            print(f"\r  Progress: {progress:.1f}%", end='', flush=True)

            print(f"\n✓ Downloaded: {filepath.name}")

            # Update episode info
            episode['downloaded'] = True
            episode['localPath'] = str(filepath.relative_to(self.podcasts_dir))
            self.save_library()
            return True

        except Exception as e:
            print(f"\n✗ Error downloading: {e}")
            if filepath.exists():
                filepath.unlink()
            return False

    def list_podcasts(self):
        """List all podcasts"""
        if not self.library['podcasts']:
            print("No podcasts in library")
            return

        print("\n=== Your Podcasts ===")
        for i, podcast in enumerate(self.library['podcasts'], 1):
            episodes = self.library['episodes'].get(podcast['id'], [])
            downloaded = sum(1 for e in episodes if e.get('downloaded', False))
            print(f"{i}. {podcast['title']}")
            print(f"   Episodes: {len(episodes)} ({downloaded} downloaded)")

    def list_episodes(self, podcast_id):
        """List episodes for a podcast"""
        podcast = next((p for p in self.library['podcasts'] if p['id'] == podcast_id), None)
        if not podcast:
            print("Podcast not found")
            return

        episodes = self.library['episodes'].get(podcast_id, [])
        if not episodes:
            print(f"\nNo episodes found. Run 'update {podcast_id}' first")
            return

        print(f"\n=== Episodes: {podcast['title']} ===")
        for i, episode in enumerate(episodes, 1):
            status = "✓" if episode.get('downloaded', False) else "○"
            print(f"{i}. {status} {episode['title']}")
            if episode.get('localPath'):
                print(f"   Local: {episode['localPath']}")

def main():
    import sys

    manager = PodcastManager()

    if len(sys.argv) < 2:
        print("Offline Podcast Manager")
        print(f"Downloads folder: {PODCASTS_DIR.absolute()}")
        print("\nUsage:")
        print("  python manager.py add <feed_url>         - Add a podcast")
        print("  python manager.py list                   - List all podcasts")
        print("  python manager.py update <podcast_id>    - Update episode list")
        print("  python manager.py download <podcast_id> <episode_id> - Download episode")
        print("  python manager.py episodes <podcast_id>  - List episodes")
        return

    command = sys.argv[1].lower()

    if command == 'add' and len(sys.argv) > 2:
        manager.add_podcast(sys.argv[2])

    elif command == 'list':
        manager.list_podcasts()

    elif command == 'update' and len(sys.argv) > 2:
        manager.update_episodes(sys.argv[2])

    elif command == 'download' and len(sys.argv) > 3:
        manager.download_episode(sys.argv[2], sys.argv[3])

    elif command == 'episodes' and len(sys.argv) > 2:
        manager.list_episodes(sys.argv[2])

    else:
        print("Invalid command")

if __name__ == '__main__':
    main()

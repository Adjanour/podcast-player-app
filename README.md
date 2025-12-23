# PodPlay - Modern Podcast Player

A minimal, functional, and modern podcast player web app with Apple-inspired glassmorphism design. Built with vanilla HTML, CSS, and JavaScript with a Python backend for offline downloads.

## Features

- **RSS Feed Support** - Add any podcast via RSS feed URL
- **Offline Downloads** - Download episodes to local folder for offline playback
- **Playback Speed Control** - Adjust speed from 0.5x to 2.0x
- **Keyboard Shortcuts** - Full keyboard control for power users
- **Search & Filter** - Search through episodes instantly
- **Auto-play Next Episode** - Queue functionality
- **Remember Playback Position** - Resume where you left off
- **Playlist Generator** - Export M3U playlists
- **Apple-inspired Design** - Beautiful glassmorphism UI with light/dark themes

## Quick Start

### Prerequisites

- Python 3.7 or higher
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. Clone or download this repository:

```bash
git clone https://github.com/yourusername/podcast-player-app.git
cd podcast-player-app
```

1. Install Python dependencies:

```bash
pip install requests
```

1. Start the server:

```bash
python server.py
```

1. Open your browser and navigate to:

```
http://localhost:8080/public/index.html
```

## Configuration

Edit `config.json` to customize the app:

```json
{
  "app": {
    "name": "PodPlay",
    "port": 8080,
    "downloadsFolder": "data/podcasts"
  },
  "ui": {
    "defaultTheme": "light",
    "quickAddFeeds": [...]
  },
  "playback": {
    "defaultSpeed": 1.0,
    "availableSpeeds": [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0],
    "skipBackSeconds": 15,
    "skipForwardSeconds": 15
  }
}
```

### Configuration Options

- **app.name** - Application name displayed in header
- **app.port** - Server port (default: 8080)
- **app.downloadsFolder** - Where to save downloaded episodes
- **ui.defaultTheme** - Default theme: "light" or "dark"
- **ui.quickAddFeeds** - Preset podcast feeds for quick access
- **playback.defaultSpeed** - Initial playback speed
- **playback.availableSpeeds** - Speed options available to users
- **playback.skipBackSeconds** - Seconds to skip backward
- **playback.skipForwardSeconds** - Seconds to skip forward

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space or K | Play/Pause |
| ← or J | Skip back 15 seconds |
| → or L | Skip forward 15 seconds |
| F | Open search |
| M | Toggle mute |
| N | Play next episode |
| Esc | Close search modal |

## Usage

### Adding Podcasts

1. Enter an RSS feed URL in the input field
2. Click "Add Podcast" or press Enter
3. Or click one of the quick-add buttons for popular podcasts

### Downloading Episodes

1. Browse to a podcast and view its episodes
2. Click the "Download" button on any episode
3. Episodes are saved to `data/podcasts/` folder
4. Downloaded files can be played in any media player

### Playing Episodes

1. Click on a podcast to view episodes
2. Click the "Play" button on any episode
3. Use the sticky player controls at the bottom
4. Playback position is automatically saved

### Searching Episodes

1. Press `F` key or click the search icon
2. Type to filter episodes in real-time
3. Press `Esc` to close search

### Generating Playlists

1. View a podcast's episodes
2. Click the playlist icon in the header
3. An M3U playlist file will be downloaded

## Project Structure

```
podcast-player-app/
├── public/
│   ├── index.html       # Main HTML file
│   ├── styles.css       # Glassmorphism styling
│   └── app.js           # Application logic
├── data/
│   └── podcasts/        # Downloaded episodes
├── server.py            # Python HTTP server with API
├── manager.py           # CLI podcast manager
├── config.json          # App configuration
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## API Endpoints

The Python server provides these endpoints:

- `GET /api/fetch-feed?url=<feed_url>` - Fetch RSS feed (CORS proxy)
- `GET /api/download?url=<audio_url>&title=<episode_title>` - Download episode
- `GET /api/podcasts` - Get list of downloaded podcasts
- `GET /Podcasts/<filename>` - Serve downloaded audio files

## CLI Tool

Use `manager.py` for advanced podcast management:

```bash
# List all podcasts
python manager.py list

# Add a podcast
python manager.py add <rss_url>

# Download an episode
python manager.py download <podcast_id> <episode_id>

# Remove a podcast
python manager.py remove <podcast_id>
```

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires modern browser support for:

- CSS backdrop-filter (glassmorphism)
- HTML5 audio
- IndexedDB (for podcast storage)
- Fetch API

## Troubleshooting

### Podcasts not loading

- Check that the Python server is running
- Verify the RSS feed URL is valid
- Check browser console for errors

### Downloads not working

- Ensure the `data/podcasts/` folder exists
- Check Python server console for error messages
- Verify write permissions

### Images not displaying

- Some podcast feeds use different image formats
- The app tries multiple methods to extract artwork
- A default placeholder will show if no image is found

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Credits

Built with vanilla JavaScript, no frameworks required. Inspired by Apple's design language and modern podcast apps.

## Support

For issues or questions, please open an issue on GitHub.

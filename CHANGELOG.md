# Changelog

## [1.2.0] - Premium Features

### Added
- **Audio Visualizer** - Real-time frequency visualization with animated gradient bars
  - Web Audio API integration
  - Canvas-based rendering
  - Theme-aware gradient colors
  - Auto-initializes on playback
- **Sleep Timer** - Auto-pause playback after set duration
  - Quick presets: 5, 10, 15, 30, 60 minutes
  - Live countdown display
  - Smooth 4-second fade-out before pause
  - Visual indicator when active
  - Cancel anytime
- **Social Sharing** - Share what you're listening to
  - Beautiful preview card with episode artwork
  - Shows current playback timestamp
  - Copy to clipboard
  - Share directly to X/Twitter

### Enhanced
- Added Google Fonts integration (Raleway, Funnel Display, Elms Sans)
- Improved typography with custom font stacks
- Enhanced player UI with new control buttons
- Modal-based interfaces with glassmorphism effects

## [1.1.0] - IndexedDB Migration

### Changed
- **Migrated from localStorage to IndexedDB** for unlimited storage
- Better performance with async operations
- Proper database schema with indices for faster queries

### Benefits
- No more 5-10MB storage limits
- Can store unlimited podcasts and episodes
- Faster data access with indexed queries
- Better data integrity with structured storage

## [1.0.0] - Initial Release

### Features

- RSS feed parser with local server proxy (fast!)
- Offline downloads to configurable folder
- Apple-inspired glassmorphism UI design
- Light/dark theme toggle
- Playback speed control (0.5x - 2x)
- Keyboard shortcuts for power users
- Search and filter episodes
- Auto-play next episode
- Remember playback position
- M3U playlist generator
- Responsive design

### Technical

- Vanilla JavaScript (no frameworks)
- Python backend server
- Config-driven architecture
- IndexedDB for podcast library (unlimited storage)
- DOMParser for RSS/XML parsing
- Improved iTunes image extraction (6 fallback methods)

### Configuration

- All settings in `config.json`
- Customizable port, downloads folder
- Configurable quick-add feeds
- Adjustable playback speeds and skip intervals

### Files

- `public/index.html` - Main application
- `public/styles.css` - Glassmorphism styling
- `public/app.js` - Application logic
- `server.py` - HTTP server with RSS proxy and download API
- `manager.py` - CLI tool for podcast management
- `config.json` - Configuration file
- `.gitignore` - Git ignore rules
- `README.md` - Documentation

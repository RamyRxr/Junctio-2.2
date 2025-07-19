# Junction 2.2.0 - Media Compression Guide

## Overview

Junction is a donation management system that allows users to register donors, track donations, and collect media evidence of sacrifices. This guide focuses on the media compression functionality that optimizes images and videos before uploading them to Supabase.

## Table of Contents

1. [Installation](#installation)
2. [Media Compression Features](#media-compression-features)
3. [Implementation Details](#implementation-details)
4. [Usage](#usage)
5. [Troubleshooting](#troubleshooting)

## Installation

### Prerequisites

- Node.js 14+ installed
- npm 6+ installed
- PostgreSQL database
- Supabase account with storage bucket created

### Required Dependencies

Install the following dependencies to enable media compression:

```bash
# Navigate to the client directory
cd client

# Install ffmpeg for video compression
npm install @ffmpeg/ffmpeg@0.11.0 @ffmpeg/core@0.11.0

# Install craco for webpack configuration
npm install @craco/craco file-loader
```

### Configuration Files

1. **Create craco.config.js in the client directory:**

```bash
# Create craco.config.js in client directory
touch client/craco.config.js
```

With the following content:

```javascript
module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add WASM support
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        fs: false,
        path: false,
      };
      
      // Handle ffmpeg WASM files
      webpackConfig.module.rules.push({
        test: /\.wasm$/,
        type: 'javascript/auto',
        loader: 'file-loader',
        options: {
          name: 'static/media/[name].[hash:8].[ext]',
        },
      });
      
      return webpackConfig;
    },
  },
};
```

2. **Update package.json scripts:**

Edit the scripts section in client/package.json:

```json
"scripts": {
  "start": "craco start",
  "build": "craco build",
  "test": "craco test",
  "eject": "react-scripts eject"
}
```

3. **Add Cross-Origin Isolation Headers to the server:**

Edit server/index.js to include these headers:

```javascript
// Add Cross-Origin Isolation headers for WASM
app.use((req, res, next) => {
  res.header("Cross-Origin-Embedder-Policy", "require-corp");
  res.header("Cross-Origin-Opener-Policy", "same-origin");
  next();
});
```

## Media Compression Features

### Image Compression

- Reduces image file size by 50-70% using canvas compression
- Preserves reasonable quality (60% of original)
- Automatically resizes large images (max width: 1200px)
- Works entirely client-side (no server processing needed)

### Video Compression

- Reduces video file size by 60-70% using ffmpeg.wasm
- Dynamically adjusts bitrate based on video duration
- Creates video thumbnails for preview
- Transcodes to MP4 format with H.264 encoding
- Max resolution: 1280px width (720p)
- Audio is compressed to 128kbps AAC

## Implementation Details

### Key Files

1. **mediaCompression.js** - Core utilities for compression
   - `compressImage()` - Compresses images using canvas
   - `compressVideo()` - Compresses videos using ffmpeg.wasm
   - `createVideoThumbnail()` - Generates thumbnails from videos
   - `getVideoMetadata()` - Extracts video metadata

2. **MediaUploader.js** - Component for handling uploads
   - Manages file input and preview
   - Shows compression progress
   - Handles both image and video uploads

### Technical Process

#### Image Compression

1. User selects image(s)
2. Each image is loaded into a canvas
3. Canvas dimensions are adjusted if needed
4. Image is re-rendered at 60% quality
5. Compressed image is converted to a File object
6. Original image is replaced with compressed version

#### Video Compression

1. User selects a video
2. Thumbnail is immediately generated and shown
3. Video is loaded into ffmpeg.wasm
4. Optimal bitrate is calculated based on file size and duration
5. Video is transcoded with these parameters:
   - Codec: H.264 video + AAC audio
   - Preset: 'fast' (balance of speed/compression)
   - Resolution: Scaled to max 720p
   - Variable bitrate with constraints
6. Compressed video replaces original in the upload queue

## Usage

### Uploading Media with Compression

1. Navigate to an Agent Dashboard
2. Select a donor from the list
3. Click on the image or video upload area
4. Select files to upload
5. Wait for compression to complete (progress bar will show)
6. Click "Mark as Done" to upload the compressed files

### Compression Statistics

- Console logs will show compression statistics:
  - Original size
  - Compressed size
  - Percentage reduction

## Troubleshooting

### Common Issues

1. **Video compression not working**
   - Ensure SharedArrayBuffer is available (requires secure context)
   - Check that Cross-Origin headers are set correctly
   - Verify ffmpeg.wasm is loaded properly (check console)

2. **"SharedArrayBuffer is not defined" error**
   - Make sure your server has the proper COOP/COEP headers
   - Use HTTPS or localhost (required for SharedArrayBuffer)

3. **Media compression is slow**
   - Video compression is CPU-intensive and may take time
   - Large videos (>10MB) can take 30+ seconds to compress
   - Consider adding a maximum file size limit

4. **Out of memory errors**
   - Large videos can exhaust browser memory
   - Implement maximum video duration/size restrictions
   - Recommend users to trim very long videos before uploading

### Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support with proper headers
- Safari: Limited support for video compression
- Mobile browsers: Variable support, test extensively

---

## Credits

This project uses the following libraries for media compression:
- [@ffmpeg/ffmpeg](https://github.com/ffmpegwasm/ffmpeg.wasm) - WebAssembly version of FFmpeg
- [HTML5 Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API) - For image compression
# Junction 2.2.0

## Overview

Junction is a full-stack donation management system for Qurbani (sacrifice) operations. It allows organizations to register donors, assign agents, track and split donations (sheep and cow shares), collect and compress media evidence (images/videos), and automatically sync and send media to Supabase and Telegram—even when offline.

---

## Table of Contents

1. [Features](#features)
2. [System Architecture](#system-architecture)
3. [Installation & Setup](#installation--setup)
4. [Running the Project](#running-the-project)
5. [Usage Guide](#usage-guide)
6. [Offline & Sync Features](#offline--sync-features)
7. [Telegram Integration](#telegram-integration)
8. [Testing](#testing)
9. [Troubleshooting](#troubleshooting)
10. [Credits](#credits)

---

## Features

- **Donor Registration:** Register sheep and cow donors with full details.
- **Agent Assignment:** Split donors among agents, track agent progress.
- **Donation Tracking:** Real-time dashboard with statistics, analytics, and agent workspaces.
- **Media Upload & Compression:** Upload images/videos, compress them client-side for fast uploads.
- **Offline Support:** Work offline, queue uploads, and sync automatically when back online.
- **Supabase Storage:** All media is stored in Supabase; uploads are retried if offline.
- **Telegram Notifications:** Automatically send media to donors via Telegram when online.
- **Modern UI:** Beautiful, responsive dashboard with analytics and filters.

---

## System Architecture

- **Frontend:** React (with hooks, context, Tailwind CSS, recharts for analytics)
- **Backend:** Node.js (Express), PostgreSQL, Supabase Storage, Telegram Bot API
- **Media Compression:** ffmpeg.wasm for video, Canvas API for images
- **Offline Sync:** LocalStorage/IndexedDB queue, auto-sync on reconnect

---

## Installation & Setup

### Prerequisites

- Node.js 14+
- npm 6+
- PostgreSQL database
- Supabase account with a storage bucket
- Telegram bot token (for notifications)

### 1. Clone the Repository

```bash
git clone https://github.com/RamyRxr/Junctio-2.2.git
cd junction-2.2.0
```

### 2. Install Dependencies

#### Backend

```bash
cd server
npm install
```

#### Frontend

```bash
cd ../client
npm install
```

### 3. Environment Variables

#### Supabase

Create a `.env` file in `client/`:

```
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Telegram

Create a `.env` file in `server/`:

```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHANNEL_ID=your_channel_id
```

#### Database

Configure your PostgreSQL connection in `server/config/db.js`.

---

## Running the Project

### 1. Start the Backend

```bash
cd server
npm start
```

### 2. Start the Frontend

```bash
cd ../client
npm start
```

- The frontend runs on [http://localhost:3000](http://localhost:3000)
- The backend runs on [http://localhost:5000](http://localhost:5000)

---

## Usage Guide

### 1. Register Donors

- Go to "Register New Donor"
- Fill in donor details (name, WhatsApp, type, price, etc.)
- For cows, each donor is 1/7 share

### 2. Split Donors Among Agents

- Go to "Donor List"
- Click "Split Donors Between Agents"
- Assign donors to agents for field work

### 3. Agent Dashboard

- Each agent sees their assigned donors
- For each donor:
  - Upload images/videos of the sacrifice
  - Media is compressed automatically
  - If offline, uploads are queued

### 4. Mark as Done

- After uploading media, click "Mark as Done"
- Media is uploaded to Supabase
- If offline, media is queued and uploaded automatically when online

### 5. Dashboard & Analytics

- View real-time stats, pending/completed donations, and agent progress
- Interactive graphs show donation values over time

---

## Offline & Sync Features

- **Work Offline:** All actions (register, upload, mark done) work offline
- **Media Queue:** Images/videos are stored locally if offline
- **Auto Sync:** When back online, all queued media is uploaded to Supabase and Telegram automatically
- **No Data Loss:** All actions are retried until successful

---

## Telegram Integration

- When a donor's media is uploaded, the system sends the image/video to the donor's Telegram (if number/channel is set)
- Works automatically after sync if the action was performed offline
- Uses Telegram Bot API (configured in server/.env)

---

## Media Compression Details

- **Images:** Compressed to ~60% quality, resized to max 1200px width
- **Videos:** Compressed to 720p, H.264, with audio at 128kbps AAC, using ffmpeg.wasm
- **Thumbnails:** Video thumbnails are generated for preview

---

## Testing

### Run Backend Tests

```bash
cd server
npm test
```

### Run Frontend Tests

```bash
cd client
npm test
```

- Use the UI to test all flows: donor registration, agent assignment, media upload, offline/online transitions, and Telegram notifications.

---

## Troubleshooting

- **Supabase Upload Fails:** Check your Supabase credentials and bucket permissions.
- **Telegram Not Sending:** Ensure your bot token and channel ID are correct and the bot is an admin in the channel.
- **Offline Sync Not Working:** Make sure your browser supports IndexedDB/LocalStorage and you have not disabled cookies.
- **Video Compression Slow:** Large videos may take time; try smaller files or faster hardware.

---

## Credits

- [Supabase](https://supabase.com/) for storage and authentication
- [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) for video compression
- [Telegram Bot API](https://core.telegram.org/bots/api) for notifications
- [React](https://react.dev/), [Express](https://expressjs.com/), [PostgreSQL](https://www.postgresql.org/)

---

## License

MIT License

---

**Junction 2.2.0** — Modern, offline-first donation management for Qurbani operations, with seamless media and messaging integration.
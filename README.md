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

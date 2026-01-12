# VideoForge

Browser-based video converter that processes files locally using WebAssembly. Your files never leave your device.

**Live Demo:** https://video-forge-web.vercel.app

## Features

- Drag & drop or click to upload video files
- Queue management with real-time status
- Two processing modes:
  - **Fast (Copy)** - Remux without re-encoding (instant)
  - **Re-encode (H.264)** - Full transcoding for maximum compatibility
- Download individual files or all as ZIP
- Toast notifications for user feedback
- Dark theme UI (Raycast/Linear style)
- 100% client-side processing - no server uploads

## Supported Formats

**Input:** TS, MTS, M2TS, MP4, MKV, MOV, AVI

**Output:** MP4 (H.264 + AAC)

## Local Development

```bash
# Clone the repository
git clone https://github.com/rudolfjeffery6/video-forge-web.git
cd video-forge-web

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

Open http://localhost:3000 in your browser.

## Tech Stack

- [Next.js 15](https://nextjs.org/) - React framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [JSZip](https://stuk.github.io/jszip/) - ZIP file generation
- [FFmpeg.wasm](https://ffmpegwasm.netlify.app/) - Video processing (coming soon)

## Deployment

This project is deployed on [Vercel](https://vercel.com). Any push to `main` triggers automatic deployment.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/rudolfjeffery6/video-forge-web)

## Roadmap

- [x] UI/UX with queue management
- [x] Mock conversion flow
- [x] Toast notifications
- [x] Download All as ZIP
- [ ] **FFmpeg.wasm integration** (real conversion)
- [ ] Progress bar from FFmpeg events
- [ ] Batch processing optimization
- [ ] Video preview thumbnails
- [ ] Custom output settings (bitrate, resolution)

## Privacy

VideoForge processes all files locally in your browser using WebAssembly. No files are uploaded to any server. Your media stays on your device.

## License

MIT

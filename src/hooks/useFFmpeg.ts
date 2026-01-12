'use client'

import { useState, useRef, useCallback } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

interface ConversionProgress {
  progress: number
  time?: number
  duration?: number
}

interface UseFFmpegReturn {
  loaded: boolean
  loading: boolean
  error: string | null
  load: () => Promise<boolean>
  convert: (
    file: File,
    mode: 'fast' | 'reencode',
    onProgress: (progress: ConversionProgress) => void
  ) => Promise<Blob | null>
  cancel: () => void
}

export function useFFmpeg(): UseFFmpegReturn {
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ffmpegRef = useRef<FFmpeg | null>(null)
  const abortRef = useRef(false)

  const load = useCallback(async (): Promise<boolean> => {
    if (loaded) return true
    if (loading) return false

    setLoading(true)
    setError(null)

    try {
      const ffmpeg = new FFmpeg()
      ffmpegRef.current = ffmpeg

      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })

      setLoaded(true)
      setLoading(false)
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load FFmpeg'
      setError(message)
      setLoading(false)
      return false
    }
  }, [loaded, loading])

  const convert = useCallback(
    async (
      file: File,
      mode: 'fast' | 'reencode',
      onProgress: (progress: ConversionProgress) => void
    ): Promise<Blob | null> => {
      const ffmpeg = ffmpegRef.current
      if (!ffmpeg || !loaded) {
        setError('FFmpeg not loaded')
        return null
      }

      abortRef.current = false
      setError(null)

      try {
        const inputName = 'input' + getExtension(file.name)
        const outputName = 'output.mp4'

        ffmpeg.on('progress', ({ progress, time }) => {
          if (abortRef.current) return
          onProgress({
            progress: Math.min(progress * 100, 99),
            time,
          })
        })

        ffmpeg.on('log', ({ message }) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('[FFmpeg]', message)
          }
        })

        await ffmpeg.writeFile(inputName, await fetchFile(file))

        const args =
          mode === 'fast'
            ? ['-i', inputName, '-c', 'copy', '-movflags', '+faststart', outputName]
            : [
                '-i',
                inputName,
                '-c:v',
                'libx264',
                '-preset',
                'fast',
                '-crf',
                '23',
                '-c:a',
                'aac',
                '-b:a',
                '128k',
                '-movflags',
                '+faststart',
                outputName,
              ]

        await ffmpeg.exec(args)

        if (abortRef.current) {
          await cleanup(ffmpeg, inputName, outputName)
          return null
        }

        const data = await ffmpeg.readFile(outputName)
        await cleanup(ffmpeg, inputName, outputName)

        onProgress({ progress: 100 })

        // Convert FileData to Blob - data is Uint8Array from ffmpeg
        return new Blob([data as unknown as BlobPart], { type: 'video/mp4' })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Conversion failed'
        setError(message)
        return null
      }
    },
    [loaded]
  )

  const cancel = useCallback(() => {
    abortRef.current = true
  }, [])

  return { loaded, loading, error, load, convert, cancel }
}

function getExtension(filename: string): string {
  const match = filename.match(/\.[^.]+$/)
  return match ? match[0].toLowerCase() : '.mp4'
}

async function cleanup(ffmpeg: FFmpeg, ...files: string[]) {
  for (const file of files) {
    try {
      await ffmpeg.deleteFile(file)
    } catch {
      // Ignore cleanup errors
    }
  }
}

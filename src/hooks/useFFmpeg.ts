'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

interface ConversionProgress {
  progress: number
  time?: number
  duration?: number
}

interface DebugInfo {
  userAgent: string
  crossOriginIsolated: boolean
  error: string
  failedUrl?: string
  timestamp: string
}

interface UseFFmpegReturn {
  loaded: boolean
  loading: boolean
  error: string | null
  debugInfo: DebugInfo | null
  isIsolated: boolean
  load: () => Promise<boolean>
  convert: (
    file: File,
    mode: 'fast' | 'reencode',
    onProgress: (progress: ConversionProgress) => void
  ) => Promise<Blob | null>
  cancel: () => void
  copyDebugInfo: () => void
}

export function useFFmpeg(): UseFFmpegReturn {
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [isIsolated, setIsIsolated] = useState(false)
  const ffmpegRef = useRef<FFmpeg | null>(null)
  const abortRef = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsIsolated(window.crossOriginIsolated === true)
    }
  }, [])

  const load = useCallback(async (): Promise<boolean> => {
    if (loaded) return true
    if (loading) return false

    setLoading(true)
    setError(null)
    setDebugInfo(null)

    const createDebugInfo = (errorMsg: string, failedUrl?: string): DebugInfo => ({
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      crossOriginIsolated: typeof window !== 'undefined' ? window.crossOriginIsolated === true : false,
      error: errorMsg,
      failedUrl,
      timestamp: new Date().toISOString(),
    })

    // Check SharedArrayBuffer support
    if (typeof SharedArrayBuffer === 'undefined') {
      const msg = 'SharedArrayBuffer not available. Please use Chrome/Edge/Firefox with HTTPS.'
      console.error('[FFmpeg]', msg)
      setError(msg)
      setDebugInfo(createDebugInfo(msg))
      setLoading(false)
      return false
    }

    // Check crossOriginIsolated
    if (typeof window !== 'undefined' && !window.crossOriginIsolated) {
      console.warn('[FFmpeg] crossOriginIsolated is false. SharedArrayBuffer may not work.')
    }

    try {
      const ffmpeg = new FFmpeg()
      ffmpegRef.current = ffmpeg

      // Log FFmpeg messages
      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg Log]', message)
      })

      // Use local files from /public/ffmpeg/
      const baseURL = window.location.origin + '/ffmpeg'

      console.log('[FFmpeg] Loading from baseURL:', baseURL)

      // Convert to blob URLs for proper loading
      const coreURL = await toBlobURL(
        `${baseURL}/ffmpeg-core.js`,
        'text/javascript'
      )
      const wasmURL = await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        'application/wasm'
      )

      console.log('[FFmpeg] Blob URLs created successfully')

      // Load FFmpeg with blob URLs
      await ffmpeg.load({
        coreURL,
        wasmURL,
      })

      console.log('[FFmpeg] Loaded successfully!')
      setLoaded(true)
      setLoading(false)
      return true
    } catch (err) {
      const errorMessage = err instanceof Error
        ? `${err.name}: ${err.message}`
        : String(err) || 'Failed to load FFmpeg'
      const errorStack = err instanceof Error ? err.stack : undefined

      console.error('[FFmpeg] Load failed:', errorMessage)
      if (errorStack) console.error('[FFmpeg] Stack:', errorStack)

      // Capture additional error context
      let fullError = errorMessage
      if (err instanceof Error && err.cause) {
        fullError += ` | Cause: ${String(err.cause)}`
      }

      const debug = createDebugInfo(fullError)
      setDebugInfo(debug)
      setError(fullError)
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

        console.log('[FFmpeg] Converting:', file.name, 'Mode:', mode)

        ffmpeg.on('progress', ({ progress, time }) => {
          if (abortRef.current) return
          onProgress({
            progress: Math.min(progress * 100, 99),
            time,
          })
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
        console.log('[FFmpeg] Conversion complete!')

        return new Blob([data as unknown as BlobPart], { type: 'video/mp4' })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Conversion failed'
        console.error('[FFmpeg] Conversion error:', message)
        setError(message)
        return null
      }
    },
    [loaded]
  )

  const cancel = useCallback(() => {
    abortRef.current = true
  }, [])

  const copyDebugInfo = useCallback(() => {
    if (debugInfo) {
      const text = `VideoForge Debug Info:
User Agent: ${debugInfo.userAgent}
Cross-Origin Isolated: ${debugInfo.crossOriginIsolated}
Error: ${debugInfo.error}
${debugInfo.failedUrl ? `Failed URL: ${debugInfo.failedUrl}` : ''}
Timestamp: ${debugInfo.timestamp}`

      navigator.clipboard.writeText(text).catch(console.error)
    }
  }, [debugInfo])

  return { loaded, loading, error, debugInfo, isIsolated, load, convert, cancel, copyDebugInfo }
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

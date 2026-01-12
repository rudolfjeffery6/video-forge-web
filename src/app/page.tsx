'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import JSZip from 'jszip'

type FileStatus = 'queued' | 'converting' | 'completed' | 'error'

interface QueueItem {
  id: string
  file: File
  status: FileStatus
  progress: number
  error?: string
}

type ProcessingMode = 'fast' | 'reencode'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[], onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm animate-slide-in ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : toast.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-primary/10 border-primary/30 text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
          </span>
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      ))}
    </div>
  )
}

export default function Home() {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [showModeModal, setShowModeModal] = useState(false)
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('fast')
  const [errorLog, setErrorLog] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [isZipping, setIsZipping] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const processingRef = useRef(false)

  const showToast = useCallback((type: Toast['type'], message: string) => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, type, message }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1))
    }, 4000)
    return () => clearTimeout(timer)
  }, [toasts])

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: QueueItem[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued' as FileStatus,
      progress: 0,
    }))
    setQueue((prev) => [...prev, ...newItems])
    showToast('info', `Added ${newItems.length} file${newItems.length > 1 ? 's' : ''} to queue`)
  }, [showToast])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files)
      }
    },
    [addFiles]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files)
        e.target.value = ''
      }
    },
    [addFiles]
  )

  const simulateConversion = useCallback(async (item: QueueItem) => {
    return new Promise<void>((resolve) => {
      const duration = 3000 + Math.random() * 2000
      const startTime = Date.now()

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime
        const progress = Math.min((elapsed / duration) * 100, 100)

        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, progress, status: 'converting' } : q
          )
        )

        if (progress >= 100) {
          clearInterval(interval)
          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id ? { ...q, status: 'completed', progress: 100 } : q
            )
          )
          resolve()
        }
      }, 50)
    })
  }, [])

  const startProcessing = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true

    const queuedItems = queue.filter((q) => q.status === 'queued')
    showToast('info', `Processing ${queuedItems.length} file${queuedItems.length > 1 ? 's' : ''}...`)

    for (const item of queuedItems) {
      await simulateConversion(item)
    }

    showToast('success', `All ${queuedItems.length} file${queuedItems.length > 1 ? 's' : ''} converted!`)
    processingRef.current = false
  }, [queue, simulateConversion, showToast])

  const downloadFile = useCallback((item: QueueItem) => {
    const outputName = item.file.name.replace(/\.[^.]+$/, '.mp4')
    const blob = new Blob(['Mock MP4 content - this is a demo file'], {
      type: 'video/mp4',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = outputName
    a.click()
    URL.revokeObjectURL(url)
    showToast('success', `Downloaded: ${outputName}`)
  }, [showToast])

  const downloadAllAsZip = useCallback(async () => {
    const completedItems = queue.filter((q) => q.status === 'completed')
    if (completedItems.length === 0) return

    setIsZipping(true)
    showToast('info', 'Preparing ZIP archive...')

    try {
      const zip = new JSZip()

      for (const item of completedItems) {
        const outputName = item.file.name.replace(/\.[^.]+$/, '.mp4')
        const mockContent = `Mock MP4 content for ${outputName} - this is a demo file`
        zip.file(outputName, mockContent)
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `videoforge-output-${Date.now()}.zip`
      a.click()
      URL.revokeObjectURL(url)

      showToast('success', `Downloaded ${completedItems.length} files as ZIP`)
    } catch {
      showToast('error', 'Failed to create ZIP archive')
    } finally {
      setIsZipping(false)
    }
  }, [queue, showToast])

  const removeItem = useCallback((id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id))
  }, [])

  const clearCompleted = useCallback(() => {
    const count = queue.filter((q) => q.status === 'completed').length
    setQueue((prev) => prev.filter((q) => q.status !== 'completed'))
    showToast('info', `Cleared ${count} completed file${count > 1 ? 's' : ''}`)
  }, [queue, showToast])

  const hasQueued = queue.some((q) => q.status === 'queued')
  const hasCompleted = queue.some((q) => q.status === 'completed')
  const isProcessing = queue.some((q) => q.status === 'converting')
  const completedCount = queue.filter((q) => q.status === 'completed').length

  return (
    <>
      {/* Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-solid border-border-dark bg-background-dark/80 backdrop-blur-md px-6 py-4 lg:px-10">
        <div className="flex items-center gap-4 text-white">
          <div className="size-8 text-primary">
            <svg
              className="w-full h-full"
              fill="none"
              viewBox="0 0 48 48"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8.57829 8.57829C5.52816 11.6284 3.451 15.5145 2.60947 19.7452C1.76794 23.9758 2.19984 28.361 3.85056 32.3462C5.50128 36.3314 8.29667 39.7376 11.8832 42.134C15.4698 44.5305 19.6865 45.8096 24 45.8096C28.3135 45.8096 32.5302 44.5305 36.1168 42.134C39.7033 39.7375 42.4987 36.3314 44.1494 32.3462C45.8002 28.361 46.2321 23.9758 45.3905 19.7452C44.549 15.5145 42.4718 11.6284 39.4217 8.57829L24 24L8.57829 8.57829Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <h2 className="text-white text-xl font-bold tracking-tight">
            VideoForge
          </h2>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> System
              Ready
            </span>
          </div>
          <div className="h-8 w-[1px] bg-border-dark hidden md:block" />
          <button
            onClick={() => setShowModeModal(true)}
            className="text-xs font-mono text-primary/70 uppercase tracking-widest border border-primary/20 px-2 py-1 rounded hover:bg-primary/10 transition-colors"
          >
            Mode: {processingMode === 'fast' ? 'Fast' : 'Re-encode'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-6 lg:p-12 grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Left Column */}
        <section className="xl:col-span-7 flex flex-col h-full gap-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Dashboard
            </h1>
            <span className="text-xs font-mono text-primary/70 uppercase tracking-widest border border-primary/20 px-2 py-1 rounded">
              V 2.4.0 (Stable)
            </span>
          </div>

          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-surface-dark/50 p-12 lg:py-24 transition-all cursor-pointer overflow-hidden ${
              isDragging
                ? 'border-primary bg-surface-dark scale-[1.02]'
                : 'border-border-dark hover:border-primary/50 hover:bg-surface-dark'
            } group`}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at center, rgba(29, 158, 201, 0.08) 0%, transparent 70%)',
              }}
            />
            <div className="relative z-10 flex flex-col items-center gap-6 max-w-md text-center">
              <div className="relative size-20 rounded-full bg-gradient-to-b from-surface-dark to-surface-darker shadow-inner flex items-center justify-center ring-1 ring-border-dark group-hover:scale-110 transition-transform duration-300">
                <span className="material-symbols-outlined text-4xl text-slate-500 group-hover:text-primary transition-colors">
                  upload_file
                </span>
                <div className="absolute -bottom-1 -right-1 bg-primary text-background-dark rounded-full p-1.5 shadow-lg">
                  <span className="material-symbols-outlined text-sm font-bold">
                    add
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white tracking-tight group-hover:text-primary transition-colors">
                  {queue.length === 0 ? 'Ready to Forge' : 'Add More Files'}
                </h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Drag and drop video files here to begin processing.
                  <br className="hidden sm:block" />
                  Supports TS, MP4, MKV, MOV, and AVI containers.
                </p>
              </div>
              <button className="mt-4 flex items-center gap-2 bg-primary text-white text-sm font-bold h-10 px-6 rounded-lg hover:bg-primary/90 hover:shadow-glow transition-all active:scale-95">
                <span>Select Files</span>
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*,.ts,.mts,.m2ts"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Queue */}
          {queue.length > 0 && (
            <div className="rounded-xl border border-border-dark bg-surface-dark overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border-dark flex-wrap gap-2">
                <h3 className="text-white font-bold">
                  Queue ({queue.length} files)
                </h3>
                <div className="flex gap-2 flex-wrap">
                  {completedCount > 1 && (
                    <button
                      onClick={downloadAllAsZip}
                      disabled={isZipping}
                      className="text-xs font-bold text-white bg-emerald-600 px-4 py-1.5 rounded hover:bg-emerald-500 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {isZipping ? 'progress_activity' : 'folder_zip'}
                      </span>
                      {isZipping ? 'Zipping...' : `Download All (${completedCount})`}
                    </button>
                  )}
                  {hasCompleted && (
                    <button
                      onClick={clearCompleted}
                      className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded border border-border-dark hover:border-slate-500 transition-colors"
                    >
                      Clear Completed
                    </button>
                  )}
                  {hasQueued && !isProcessing && (
                    <button
                      onClick={startProcessing}
                      className="text-xs font-bold text-white bg-primary px-4 py-1.5 rounded hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-sm">
                        play_arrow
                      </span>
                      Start
                    </button>
                  )}
                </div>
              </div>
              <div className="divide-y divide-border-dark max-h-80 overflow-y-auto log-scroll">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 p-4 hover:bg-surface-darker/50 transition-colors"
                  >
                    <div className="shrink-0">
                      {item.status === 'queued' && (
                        <span className="material-symbols-outlined text-slate-500">
                          schedule
                        </span>
                      )}
                      {item.status === 'converting' && (
                        <span className="material-symbols-outlined text-primary animate-spin">
                          progress_activity
                        </span>
                      )}
                      {item.status === 'completed' && (
                        <span className="material-symbols-outlined text-emerald-500">
                          check_circle
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span className="material-symbols-outlined text-red-500">
                          error
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {item.file.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-slate-500 text-xs">
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        {item.status === 'converting' && (
                          <span className="text-primary text-xs font-mono">
                            {Math.round(item.progress)}%
                          </span>
                        )}
                      </div>
                      {item.status === 'converting' && (
                        <div className="mt-2 w-full h-1 bg-surface-darker rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-100 rounded-full"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === 'completed' && (
                        <button
                          onClick={() => downloadFile(item)}
                          className="text-xs font-bold text-primary border border-primary/30 px-3 py-1.5 rounded hover:bg-primary/10 transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">
                            download
                          </span>
                          Download
                        </button>
                      )}
                      {item.status !== 'converting' && (
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-slate-500 hover:text-red-400 transition-colors p-1"
                        >
                          <span className="material-symbols-outlined text-lg">
                            close
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Privacy Card */}
          <div className="rounded-xl border border-border-dark bg-surface-dark p-5 flex flex-col sm:flex-row items-start gap-4 shadow-sm">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
              <span className="material-symbols-outlined">verified_user</span>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-white text-base font-bold">
                Local Processing Guarantee
              </p>
              <p className="text-slate-400 text-sm leading-normal max-w-lg">
                Your privacy is paramount. VideoForge processes all media
                locally on your device using WebAssembly. No files are ever
                uploaded to an external server.
              </p>
            </div>
          </div>
        </section>

        {/* Right Column */}
        <aside className="xl:col-span-5 flex flex-col gap-8 relative">
          <div className="absolute -left-4 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-border-dark to-transparent hidden xl:block" />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-border-dark bg-surface-dark p-4 text-center">
              <p className="text-2xl font-bold text-white">
                {queue.filter((q) => q.status === 'queued').length}
              </p>
              <p className="text-xs text-slate-500 mt-1">Queued</p>
            </div>
            <div className="rounded-xl border border-border-dark bg-surface-dark p-4 text-center">
              <p className="text-2xl font-bold text-primary">
                {queue.filter((q) => q.status === 'converting').length}
              </p>
              <p className="text-xs text-slate-500 mt-1">Processing</p>
            </div>
            <div className="rounded-xl border border-border-dark bg-surface-dark p-4 text-center">
              <p className="text-2xl font-bold text-emerald-500">
                {completedCount}
              </p>
              <p className="text-xs text-slate-500 mt-1">Completed</p>
            </div>
          </div>

          {/* Mode Info */}
          <div className="rounded-xl border border-border-dark bg-surface-dark p-5">
            <h3 className="text-white font-bold mb-3">Current Mode</h3>
            <div
              className={`rounded-lg border p-4 ${
                processingMode === 'fast'
                  ? 'border-primary bg-primary/5'
                  : 'border-amber-500/30 bg-amber-500/5'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-bold text-sm">
                  {processingMode === 'fast' ? 'Fast (Copy)' : 'Re-encode (H.264)'}
                </span>
                <span
                  className={`flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    processingMode === 'fast'
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : 'text-amber-400 bg-amber-500/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {processingMode === 'fast' ? 'bolt' : 'tune'}
                  </span>
                  {processingMode === 'fast' ? 'Instant' : 'HQ'}
                </span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                {processingMode === 'fast'
                  ? 'Remuxing only. Retains original stream data. Best for changing containers.'
                  : 'Full transcoding. Maximum compatibility across web & devices.'}
              </p>
            </div>
            <button
              onClick={() => setShowModeModal(true)}
              className="mt-4 w-full text-xs text-slate-400 hover:text-white border border-border-dark hover:border-slate-500 py-2 rounded transition-colors"
            >
              Change Mode
            </button>
          </div>

          {/* Error Log Demo */}
          {errorLog && (
            <div className="bg-surface-dark border border-red-500/20 shadow-[0_0_30px_-10px_rgba(239,68,68,0.15)] rounded-xl overflow-hidden">
              <div className="bg-red-500/5 border-b border-red-500/10 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-red-500/10 text-red-500 p-1.5 rounded-md">
                    <span className="material-symbols-outlined text-lg">
                      warning
                    </span>
                  </div>
                  <div>
                    <h3 className="text-red-100 font-bold text-sm">
                      Processing Error
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setErrorLog(null)}
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
              <div className="bg-surface-darker p-4 font-mono text-xs log-scroll max-h-48 overflow-y-auto">
                <pre className="text-red-400 whitespace-pre-wrap">{errorLog}</pre>
              </div>
            </div>
          )}
        </aside>
      </main>

      {/* Mode Selection Modal */}
      {showModeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-dark border border-border-dark rounded-xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-white text-lg font-bold">Processing Mode</h3>
                <p className="text-slate-500 text-xs mt-1">
                  Select how you want to handle the output
                </p>
              </div>
              <button
                onClick={() => setShowModeModal(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-3">
              <label
                className={`group relative flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-all ${
                  processingMode === 'fast'
                    ? 'border-primary bg-primary/5'
                    : 'border-border-dark hover:bg-surface-darker hover:border-slate-500'
                }`}
                onClick={() => setProcessingMode('fast')}
              >
                <div className="mt-1">
                  <div
                    className={`relative flex items-center justify-center w-5 h-5 rounded-full border-2 ${
                      processingMode === 'fast'
                        ? 'border-primary'
                        : 'border-slate-600'
                    }`}
                  >
                    {processingMode === 'fast' && (
                      <div className="w-2.5 h-2.5 bg-primary rounded-full" />
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-bold text-sm">
                      Fast (Copy)
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      <span className="material-symbols-outlined text-sm">
                        bolt
                      </span>
                      Instant
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Remuxing only. Retains original stream data. Best for
                    changing containers (e.g. TS to MP4).
                  </p>
                </div>
              </label>

              <label
                className={`group relative flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-all ${
                  processingMode === 'reencode'
                    ? 'border-primary bg-primary/5'
                    : 'border-border-dark hover:bg-surface-darker hover:border-slate-500'
                }`}
                onClick={() => setProcessingMode('reencode')}
              >
                <div className="mt-1">
                  <div
                    className={`relative flex items-center justify-center w-5 h-5 rounded-full border-2 ${
                      processingMode === 'reencode'
                        ? 'border-primary'
                        : 'border-slate-600'
                    }`}
                  >
                    {processingMode === 'reencode' && (
                      <div className="w-2.5 h-2.5 bg-primary rounded-full" />
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-medium text-sm">
                      Re-encode (H.264)
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      <span className="material-symbols-outlined text-sm">
                        tune
                      </span>
                      HQ
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Full transcoding. Maximum compatibility across web &
                    devices. Slower, depends on CPU.
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowModeModal(false)}
                className="bg-white text-black hover:bg-slate-200 text-sm font-bold py-2 px-6 rounded-lg transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

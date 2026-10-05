import { spawn, execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.resolve(__dirname, 'garment_from_photo.py')
const MAX_BODY = 18 * 1024 * 1024

function pythonCommand(): { bin: string; prefix: string[] } {
  if (process.env.PYTHON) return { bin: process.env.PYTHON, prefix: [] }
  return process.platform === 'win32'
    ? { bin: 'python', prefix: [] }
    : { bin: 'python3', prefix: [] }
}

function readBody(req: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('Photo is too large (max 18 MB)'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function decodePhoto(raw: Buffer): Buffer {
  try {
    const payload = JSON.parse(raw.toString('utf8')) as { imageBase64?: string }
    if (!payload.imageBase64) throw new Error('missing image')
    return Buffer.from(payload.imageBase64, 'base64')
  } catch {
    return raw
  }
}

export function garmentFromPhotoPlugin(): Plugin {
  let reconstructing = false
  return {
    name: 'garment-from-photo',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const route = req.url?.split('?')[0]
        const reconstruction = route === '/api/garment-reconstruction'
        if (!reconstruction && route !== '/api/garment-from-photo') return next()
        if (req.headers.origin && !['http:', 'https:'].some(protocol => req.headers.origin === `${protocol}//${req.headers.host}`)) {
          res.statusCode = 403
          res.end('Origin not allowed')
          return
        }
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, provider: reconstruction ? 'azure-garment-reconstruction-v1' : 'local-seam-trace' }))
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        if (reconstruction && reconstructing) {
          res.statusCode = 409
          res.end(`${JSON.stringify({ type: 'error', error: 'Another garment is processing. Try again when it finishes.' })}\n`)
          return
        }
        if (reconstruction) reconstructing = true
        let tmpDir = ''
        try {
          const raw = await readBody(req)
          const payload = reconstruction ? JSON.parse(raw.toString('utf8')) : null
          if (reconstruction && (typeof payload?.imageBase64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.imageBase64))) throw new Error('Expected a base64 image upload')
          const bytes = reconstruction ? Buffer.from(payload.imageBase64, 'base64') : decodePhoto(raw)
          if (bytes.length > 12 * 1024 * 1024) throw new Error('Image is too large (maximum 12 MB)')
          tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ceriga-garment-'))
          const photoPath = path.join(tmpDir, 'photo.png')
          await writeFile(photoPath, bytes)
          const env = { ...process.env, ...loadEnv(server.config.mode, server.config.root, '') }
          const localPython = path.join(server.config.root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
          const localPotrace = path.join(server.config.root, '.venv/tools/potrace-1.16.win64/potrace.exe')
          if (!env.POTRACE && !env.POTRACE_EXE && existsSync(localPotrace)) env.POTRACE = localPotrace
          const { bin, prefix } = pythonCommand()
          const child = spawn(env.PYTHON || (existsSync(localPython) ? localPython : bin), [...prefix, '-u', SCRIPT, photoPath, ...(reconstruction ? ['--reconstruct'] : [])], {
            cwd: __dirname,
            env: { ...env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' },
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
          })
          let stdout = ''
          let stderr = ''
          const cancel = () => {
            if (!child.pid || child.exitCode !== null) return
            if (process.platform === 'win32') execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {})
            else child.kill('SIGTERM')
          }
          res.on('close', cancel)
          const timer = setTimeout(() => {
            if (!res.writableEnded && !res.destroyed) res.end(`${JSON.stringify({ type: 'error', error: 'Garment reconstruction timed out. Retry.' })}\n`)
            cancel()
          }, 900_000)
          child.stdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString('utf8')
            if (stdout.length > 24_000_000) {
              if (!res.writableEnded && !res.destroyed) res.end(`${JSON.stringify({ type: 'error', error: 'Garment output is too large.' })}\n`)
              cancel()
              return
            }
            if (!res.writableEnded && !res.destroyed) res.write(chunk)
          })
          child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString('utf8')
            server.config.logger.error(chunk.toString('utf8'))
          })
          child.on('error', (error) => {
            if (!res.writableEnded) {
              res.end(`${JSON.stringify({ type: 'error', ok: false, error: error.message })}\n`)
            }
          })
          child.on('close', async (code) => {
            clearTimeout(timer)
            res.off('close', cancel)
            if (reconstruction) reconstructing = false
            if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)
            if (res.writableEnded) return
            const hasError = stdout.includes('"type": "error"') || stdout.includes('"type":"error"')
            if (code && !hasError) {
              res.write(`${JSON.stringify({
                type: 'error',
                ok: false,
                error: (reconstruction ? '' : stderr.trim().split('\n').slice(-6).join(' ').slice(0, 500))
                  || `Garment trace exited ${code}`,
              })}\n`)
            }
            res.end()
          })
        } catch (error) {
          if (reconstruction) reconstructing = false
          if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)
          const message = error instanceof Error ? error.message : 'Garment upload failed'
          if (!res.writableEnded) {
            res.end(`${JSON.stringify({ type: 'error', ok: false, error: message })}\n`)
          }
        }
      })
    },
  }
}

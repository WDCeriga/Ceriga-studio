import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

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
  return {
    name: 'garment-from-photo',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== '/api/garment-from-photo') return next()
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, provider: 'local-seam-trace' }))
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        let tmpDir = ''
        try {
          const bytes = decodePhoto(await readBody(req))
          tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ceriga-garment-'))
          const photoPath = path.join(tmpDir, 'photo.png')
          await writeFile(photoPath, bytes)
          const { bin, prefix } = pythonCommand()
          const child = spawn(bin, [...prefix, '-u', SCRIPT, photoPath], {
            cwd: __dirname,
            env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' },
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
          })
          let stdout = ''
          let stderr = ''
          child.stdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString('utf8')
            res.write(chunk)
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
            if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)
            if (res.writableEnded) return
            const hasError = stdout.includes('"type": "error"') || stdout.includes('"type":"error"')
            if (code && !hasError) {
              res.write(`${JSON.stringify({
                type: 'error',
                ok: false,
                error: stderr.trim().split('\n').slice(-6).join(' ').slice(0, 500)
                  || `Garment trace exited ${code}`,
              })}\n`)
            }
            res.end()
          })
        } catch (error) {
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

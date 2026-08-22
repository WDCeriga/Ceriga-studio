import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv, type Plugin } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.resolve(__dirname, 'collar_from_photo.py')
const MAX_BODY = 14 * 1024 * 1024

function pythonCommand(): { bin: string; prefix: string[] } {
  if (process.env.PYTHON) return { bin: process.env.PYTHON, prefix: [] }
  if (process.platform === 'win32') return { bin: 'python', prefix: [] }
  return { bin: 'python3', prefix: [] }
}

function readBody(req: NodeJS.ReadableStream, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('Photo is too large (max 12 MB)'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function decodePhoto(raw: Buffer): Buffer {
  const text = raw.toString('utf8').replace(/^\uFEFF/, '')
  try {
    const payload = JSON.parse(text) as { imageBase64?: string; image?: string }
    const b64 = payload.imageBase64 || payload.image
    if (!b64) throw new Error('missing image')
    return Buffer.from(b64, 'base64')
  } catch {
    return raw
  }
}

export function collarFromPhotoPlugin(): Plugin {
  return {
    name: 'collar-from-photo',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url !== '/api/collar-from-photo') return next()

        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
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
          const env = loadEnv(server.config.mode, server.config.root, '')
          const raw = await readBody(req, MAX_BODY)
          const bytes = decodePhoto(raw)
          tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ceriga-collar-'))
          const photoPath = path.join(tmpDir, 'photo.png')
          await writeFile(photoPath, bytes)

          const { bin, prefix } = pythonCommand()
          const child = spawn(bin, [...prefix, '-u', SCRIPT, photoPath], {
            cwd: __dirname,
            env: {
              ...process.env,
              ...env,
              PYTHONUNBUFFERED: '1',
              PYTHONIOENCODING: 'utf-8',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
          })

          let stderr = ''
          let stdout = ''
          child.stderr.on('data', (chunk: Buffer) => {
            const text = chunk.toString('utf8')
            stderr += text
            server.config.logger.error(text)
          })
          child.stdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString('utf8')
            res.write(chunk)
          })

          child.on('error', (err) => {
            res.write(
              `${JSON.stringify({
                type: 'error',
                ok: false,
                error: err.message || 'Could not start Python',
              })}\n`,
            )
            res.end()
          })

          child.on('close', async (code) => {
            try {
              if (tmpDir) await rm(tmpDir, { recursive: true, force: true })
            } catch {
              /* ignore */
            }
            if (res.writableEnded) return
            const alreadyErrored = stdout.includes('"type": "error"') || stdout.includes('"type":"error"')
            if (code && code !== 0 && !alreadyErrored) {
              const detail = stderr.trim().split('\n').slice(-8).join(' ').slice(0, 500)
              res.write(
                `${JSON.stringify({
                  type: 'error',
                  ok: false,
                  error: detail || `Collar trace exited ${code}`,
                })}\n`,
              )
            }
            res.end()
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Upload failed'
          if (tmpDir) {
            try {
              await rm(tmpDir, { recursive: true, force: true })
            } catch {
              /* ignore */
            }
          }
          if (!res.headersSent) res.statusCode = 400
          if (!res.writableEnded) {
            res.end(JSON.stringify({ type: 'error', ok: false, error: message }))
          }
        }
      })
    },
  }
}

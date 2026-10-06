import { spawn, execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
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

type InputType = 'auto' | 'photo' | 'trace-only'
type Upload = { bytes: Buffer; inputType: InputType; view: 'front' | 'back' }

function decodeUpload(raw: Buffer): Upload {
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(raw.toString('utf8'))
  } catch {
    throw new Error('Expected a JSON base64 image upload')
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Expected a JSON image object')
  const encoded = payload.imageBase64
  if (typeof encoded !== 'string' || !encoded.length || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('Expected a base64 image upload')
  const bytes = Buffer.from(encoded, 'base64')
  if (!bytes.length || bytes.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) throw new Error('Invalid base64 image upload')
  if (bytes.length > 12 * 1024 * 1024) throw new Error('Image is too large (maximum 12 MB)')
  const inputType = payload.inputType === undefined ? 'auto' : payload.inputType
  if (inputType !== 'auto' && inputType !== 'photo' && inputType !== 'trace-only') throw new Error('inputType must be auto, photo or trace-only')
  const view = payload.requestedView === undefined ? 'front' : payload.requestedView
  if (view !== 'front' && view !== 'back') throw new Error('requestedView must be front or back')
  if (payload.backImageBase64 != null && payload.backImageBase64 !== '') {
    throw new Error('Paired back uploads are not supported. Import the front first, then upload the back with requestedView="back".')
  }
  return { bytes, inputType, view }
}

function decodePhoto(raw: Buffer): Buffer {
  // The legacy endpoint also accepts raw image bytes; JSON is never a fallback raster.
  if (raw.toString('utf8', 0, 32).trimStart().startsWith('{')) return decodeUpload(raw).bytes
  if (!raw.length || raw.length > 12 * 1024 * 1024) throw new Error('Image must be between 1 byte and 12 MB')
  return raw
}

export function garmentFromPhotoPlugin(): Plugin {
  let reconstructing = false
  return {
    name: 'garment-from-photo',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const route = req.url?.split('?')[0]
        const reconstruction = route === '/api/garment-reconstruction'
        const detection = route === '/api/garment-input-type'
        if (!reconstruction && !detection && route !== '/api/garment-from-photo') return next()
        if (req.headers.origin && !['http:', 'https:'].some(protocol => req.headers.origin === `${protocol}//${req.headers.host}`)) {
          res.statusCode = 403
          res.end('Origin not allowed')
          return
        }
        if (req.method === 'GET' && !detection) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, provider: reconstruction ? 'garment-input-router-v1' : 'local-seam-trace' }))
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        res.setHeader('Content-Type', detection ? 'application/json; charset=utf-8' : 'application/x-ndjson; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        if (reconstruction && reconstructing) {
          res.statusCode = 409
          res.end(`${JSON.stringify({ type: 'error', error: 'Another garment is processing. Try again when it finishes.' })}\n`)
          return
        }
        if (reconstruction) reconstructing = true
        let tmpDir = ''
        const fail = (error: string, status = 500) => {
          if (res.writableEnded || res.destroyed) return
          if (!res.headersSent) res.statusCode = status
          res.end(`${JSON.stringify({ type: 'error', ok: false, error })}\n`)
        }
        try {
          const raw = await readBody(req)
          const upload = reconstruction || detection ? decodeUpload(raw) : null
          const bytes = upload ? upload.bytes : decodePhoto(raw)
          tmpDir = await mkdtemp(path.join(server.config.root, '.garment-upload-'))
          const photoPath = path.join(tmpDir, 'photo.png')
          await writeFile(photoPath, bytes)
          const env = { ...process.env, ...loadEnv(server.config.mode, server.config.root, '') }
          const localPython = path.join(server.config.root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
          const localPotrace = path.join(server.config.root, '.venv/tools/potrace-1.16.win64/potrace.exe')
          if (!env.POTRACE && !env.POTRACE_EXE && existsSync(localPotrace)) env.POTRACE = localPotrace
          const { bin, prefix } = pythonCommand()
          const args = detection ? ['--detect-input'] : upload ? ['--input-type', upload.inputType, '--view', upload.view] : ['--local-only']
          const child = spawn(env.PYTHON || (existsSync(localPython) ? localPython : bin), [...prefix, '-u', SCRIPT, photoPath, ...args], {
            cwd: __dirname,
            env: { ...env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1', TMP: tmpDir, TEMP: tmpDir, TMPDIR: tmpDir },
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
            fail(detection ? 'Garment input detection timed out.' : 'Garment processing timed out. Retry.', 504)
            cancel()
          }, detection ? 30_000 : 900_000)
          child.stdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString('utf8')
            if (stdout.length > (detection ? 64_000 : 64_000_000)) {
              fail('Garment output is too large.')
              cancel()
              return
            }
            if (!detection && !res.writableEnded && !res.destroyed) res.write(chunk)
          })
          child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString('utf8')
            server.config.logger.error(chunk.toString('utf8'))
          })
          child.on('error', (error) => fail(error.message))
          child.on('close', async (code) => {
            clearTimeout(timer)
            res.off('close', cancel)
            if (reconstruction) reconstructing = false
            if (tmpDir) await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)
            if (res.writableEnded || res.destroyed) return
            if (detection) {
              try {
                const result = JSON.parse(stdout.trim())
                if (code !== 0 || result?.type === 'error') {
                  fail(result?.error || 'Input detection failed.', 422)
                } else if ((result?.mode === 'photo' || result?.mode === 'trace-only') && typeof result.confidence === 'number' && result.confidence >= 0 && result.confidence <= 1 && typeof result.reason === 'string') {
                  res.end(JSON.stringify(result))
                } else {
                  fail('Input detection returned an invalid response.')
                }
              } catch {
                fail('Input detection returned an invalid response.')
              }
              return
            }
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
          fail(message, 400)
        }
      })
    },
  }
}

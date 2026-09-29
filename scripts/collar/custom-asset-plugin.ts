import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadEnv, type Plugin } from 'vite';

export function customAssetPlugin(): Plugin {
  let active = false;
  return {
    name: 'custom-asset-upload',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== '/api/custom-assets') return next();
        response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        const send = (value: unknown) => {
          if (!response.destroyed && !response.writableEnded) response.write(`${JSON.stringify(value)}\n`);
        };
        const fail = (error: string, status = 400) => {
          if (!response.headersSent) response.statusCode = status;
          send({ type: 'error', error });
          response.end();
        };
        if (request.method !== 'POST') return fail('Method not allowed', 405);
        if (request.headers.origin && !['http:', 'https:'].some(protocol => request.headers.origin === `${protocol}//${request.headers.host}`)) return fail('Origin not allowed', 403);
        if (!request.headers['content-type']?.startsWith('application/json')) return fail('Expected JSON image upload', 415);
        if (active) return fail('Another custom asset is processing. Try again when it finishes.', 409);
        active = true;
        let directory = '';
        let child: ChildProcess | undefined;
        let cancelled = false;
        const cancel = () => {
          cancelled = true;
          if (!child?.pid || child.exitCode !== null) return;
          if (process.platform === 'win32') execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {});
          else child.kill('SIGTERM');
        };
        response.on('close', cancel);
        const timer = setTimeout(() => { fail('Processing timed out. Retry with a tighter crop.', 504); cancel(); }, 600_000);
        try {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of request) {
            size += chunk.length;
            if (size > 17 * 1024 * 1024) throw new Error('Image is too large (maximum 12 MB)');
            chunks.push(Buffer.from(chunk));
          }
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!payload || !['collar', 'sleeve', 'pocket'].includes(payload.contextCategory) || payload.category !== payload.contextCategory) throw new Error('Wrong selected asset type: upload category must match the builder section. Reopen Upload from Neck / Collar, Sleeves or Trims & Details.');
          if (!payload || typeof payload.image !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.image)) throw new Error('Invalid image upload');
          const image = Buffer.from(payload.image, 'base64');
          if (image.length > 12 * 1024 * 1024) throw new Error('Image is too large (maximum 12 MB)');
          const options = Object.fromEntries(['category', 'contextCategory', 'detailType', 'source', 'view', 'side', 'fit', 'garmentType', 'crop'].map(key => [key, payload[key]]));
          directory = await mkdtemp(path.join(os.tmpdir(), 'ceriga-custom-asset-'));
          await writeFile(path.join(directory, 'image'), image);
          await writeFile(path.join(directory, 'request.json'), JSON.stringify(options));
          if (cancelled) return;
          const root = server.config.root;
          const env = { ...process.env, ...loadEnv(server.config.mode, root, '') };
          const localPython = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
          const python = env.PYTHON || (existsSync(localPython) ? localPython : process.platform === 'win32' ? 'python' : 'python3');
          const localPotrace = path.join(root, '.venv/tools/potrace-1.16.win64/potrace.exe');
          if (!env.POTRACE && !env.POTRACE_EXE && existsSync(localPotrace)) env.POTRACE = localPotrace;
          await new Promise<void>((resolve, reject) => {
            child = spawn(python, ['-u', path.join(root, 'scripts/collar/custom_asset_pipeline.py'), path.join(directory, 'image'), path.join(directory, 'request.json')], {
              cwd: root, env: { ...env, PYTHONIOENCODING: 'utf-8' }, windowsHide: true,
              stdio: ['ignore', 'pipe', 'pipe'],
            });
            let pending = '';
            let total = 0;
            let result: unknown;
            let error = '';
            child.stdout?.setEncoding('utf8');
            child.stdout?.on('data', (text: string) => {
              if (cancelled) return;
              total += text.length;
              if (total > 12_000_000) { fail('Trace output is too large. Use a cleaner reference.'); cancel(); return; }
              pending += text;
              const lines = pending.split('\n');
              pending = lines.pop() ?? '';
              for (const line of lines) {
                try {
                  const message = JSON.parse(line);
                  if (message.type === 'progress') send({ type: 'progress', step: message.step, label: message.label });
                  else if (message.type === 'result') result = message.asset;
                  else if (message.type === 'error') error = String(message.error).slice(0, 500);
                } catch { error = 'Processing returned an invalid response.'; }
              }
            });
            child.stderr?.resume();
            child.once('error', () => reject(new Error('Could not start Python. Configure the project virtual environment.')));
            child.once('close', code => {
              if (!cancelled) {
                if (code !== 0 || error || !result) fail(error || 'Processing failed. Check the local tracing runtime and retry.');
                else { send({ type: 'result', asset: result }); response.end(); }
              }
              resolve();
            });
          });
        } catch (error) {
          if (!cancelled) fail(error instanceof SyntaxError ? 'Invalid upload request' : error instanceof Error ? error.message : 'Upload failed');
        } finally {
          clearTimeout(timer);
          response.off('close', cancel);
          if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
          active = false;
        }
      });
    },
  };
}
import { fsyncSync } from 'node:fs'

/**
 * Platform facts the plugin depends on that Windows does not have: POSIX user/group ids, permission bits, and the
 * ability to flush a directory. On Windows a file has no uid and no mode bits to inspect; the user's profile
 * directory already keeps other accounts out, so the ownership and permission checks are skipped there. On every
 * POSIX platform (Linux, macOS) the checks run exactly as before.
 */
export const POSIX = process.platform !== 'win32'

/** The current user's id; 0 where the platform has none (the value is never compared on those platforms). */
export const currentUid = () => (typeof process.getuid === 'function' ? process.getuid() : 0)
export const currentGid = () => (typeof process.getgid === 'function' ? process.getgid() : 0)

/** True when `stat` belongs to the current user and neither group nor others may read, write or execute it. */
export const ownedAndPrivate = stat => !POSIX || (stat.uid === currentUid() && !(stat.mode & 0o077))

/** True when `stat` belongs to the current user (no statement about permission bits). */
export const ownedByCurrentUser = stat => !POSIX || stat.uid === currentUid()

/**
 * fsync an open descriptor, as far as the platform allows. Windows refuses it for descriptors opened read-only
 * (directories included) with EPERM, which is not a reason to fail an otherwise durable write there.
 */
export function syncFd(fd) {
  try { fsyncSync(fd) } catch (error) { if (error.code !== 'EPERM') throw error }
}

/**
 * Pin one agent to direct (native) tool calls. DSH up to 0.2.1 did this with tools.presentAs('native'); 0.2.2 removed
 * that call and made the presentation a per-scope executor instead, the same native executor package the deployment
 * itself mounts. Nothing to do when the host offers neither (the agent then keeps the deployment's executor).
 * Resolves once the agent is pinned, or when it could not be (said in the log; the agent then inherits).
 */
export function presentNatively(agentCtx) {
  const tools = agentCtx.tools
  if (typeof tools.presentAs === 'function') return tools.presentAs('native')
  if (typeof tools.setExecutor !== 'function') return Promise.resolve()
  return import('@deepseek-ai/dsh-tool-executor-native')
    .then(module => { tools.setExecutor(new module.NativeToolExecutor(agentCtx)) })
    .catch(error => { agentCtx.logger?.warn?.('mira-projects: could not pin the agent to native tool calls', error) })
}

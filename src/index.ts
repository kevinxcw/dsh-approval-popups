import type { Context } from '@deepseek-ai/cordis'

/** Stable Loader identity; must equal the package name the Client bundle uses. */
export const name = 'dsh-approval-popups'

/**
 * Client-only plugin. The Host half exists so the package satisfies the bundle
 * contract and so the Loader row has a real entry point; it registers nothing.
 *
 * @param _ctx - Host root context, unused.
 */
export function apply(_ctx: Context): void {
  // Intentionally empty.
}

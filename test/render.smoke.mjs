import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * Render the registered overlay component with the real React server renderer.
 * This catches a card that would otherwise crash the whole `shell.overlay`
 * entry at runtime; the Browser-only pieces are replaced by stubs.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Style tags created by the bundle, newest last (one install per apply). */
const styleTags = []

let cachedBundle

async function loadBundle() {
  if (cachedBundle !== undefined) return cachedBundle
  let captured

  globalThis.window = {
    __ModuleLoader__: {
      load({ id, factory }) {
        captured = { id, factory }
      },
    },
  }
  globalThis.document = {
    visibilityState: 'visible',
    createElement: () => {
      const element = { dataset: {}, textContent: '', remove() {} }
      styleTags.push(element)
      return element
    },
    head: { appendChild() {} },
  }

  await import('../lib/client.js')
  if (captured === undefined) throw new Error('bundle did not register through __ModuleLoader__')
  cachedBundle = captured
  return cachedBundle
}

const t = (key, params) => (params === undefined ? key : `${key}|${JSON.stringify(params)}`)

function createHarness({ sessions, initialStatus }) {
  const listeners = new Set()
  const effects = []
  let status = initialStatus
  let registered
  let injected

  const ctx = {
    effect(fn) {
      const dispose = fn()
      effects.push(dispose)
      return () => dispose?.()
    },
    locale: {
      register: () => () => {},
      bind: () => t,
      resolveText: (value) => value.en ?? '',
    },
    sessions: { list: { getSnapshot: () => ({ byId: sessions }) } },
    uiSession: {
      sessionStatus: {
        getSnapshot: () => status,
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      },
    },
    uiWorkspace: { openSession() {} },
    slots: {
      inject(_name, callback) {
        callback()
      },
      register(_options, component) {
        registered = { options: _options, component }
        return () => {}
      },
    },
  }

  return {
    apply: async () => {
      const bundle = await loadBundle()
      const module = bundle.factory((name) => {
        if (name === 'react') return React
        throw new Error(`unexpected require: ${name}`)
      })
      module.apply(ctx)
      return { component: registered.component, props: registered.options.inject() }
    },
    publish(next) {
      status = next
      for (const listener of [...listeners]) listener()
    },
    teardown() {
      for (const dispose of effects) dispose?.()
    },
  }
}

function render(component, props, sessions) {
  const useSessions = (selector) => selector({ byId: sessions })
  const usePanelInfo = (selector) => selector({ activePanelId: null })
  return renderToStaticMarkup(
    React.createElement(component, { ...props, t, useSessions, usePanelInfo }),
  )
}

const sessionsOf = (overrides = {}) => ({
  s1: { id: 's1', title: 'Session one', retainedBy: { mainView: 0 }, ...overrides.s1 },
})

const approval = {
  key: 'approval:1',
  kind: 'approval',
  toolName: 'bash',
  reason: 'needs escalation',
  answer: async () => {},
}

test('approval card renders decision buttons', async () => {
  const harness = createHarness({
    sessions: sessionsOf(),
    initialStatus: new Map([['s1', { running: false, completionUnread: false }]]),
  })
  const { component, props } = await harness.apply()

  harness.publish(new Map([['s1', {
    running: false,
    pendingInteraction: approval,
    completionUnread: false,
  }]]))
  const html = render(component, props, sessionsOf())

  assert.match(html, /att-card/)
  assert.match(html, /att-btn/)
  assert.match(html, /needs escalation/)
  assert.match(html, /Session one/)
  assert.match(html, /approval\.allowOnce/)
  assert.match(html, /approval\.reject/)
  harness.teardown()
})

test('question card renders options, custom input, and submit', async () => {
  const harness = createHarness({
    sessions: sessionsOf(),
    initialStatus: new Map([['s1', { running: false, completionUnread: false }]]),
  })
  const { component, props } = await harness.apply()

  harness.publish(new Map([['s1', {
    running: false,
    completionUnread: false,
    pendingInteraction: {
      key: 'question:1',
      kind: 'question',
      answer: async () => {},
      questions: [{
        id: 'q1',
        question: 'Which branch?',
        options: [{ label: 'main', description: 'the default' }, { label: 'next' }],
      }],
    },
  }]]))
  const html = render(component, props, sessionsOf())

  assert.match(html, /Which branch\?/)
  assert.match(html, /att-opt/)
  assert.match(html, /main/)
  assert.match(html, /the default/)
  assert.match(html, /att-input/)
  assert.match(html, /question\.submit/)
  harness.teardown()
})

test('plan review card renders the plan and both decisions', async () => {
  const harness = createHarness({
    sessions: sessionsOf(),
    initialStatus: new Map([['s1', { running: false, completionUnread: false }]]),
  })
  const { component, props } = await harness.apply()

  harness.publish(new Map([['s1', {
    running: false,
    completionUnread: false,
    pendingInteraction: {
      key: 'question:2',
      kind: 'plan-review',
      answer: async () => {},
      questions: [{
        id: 'q2',
        question: 'Review this plan?',
        detail: '1. do the thing',
        options: [{ label: 'Approve' }, { label: 'Reject' }],
        intent: { kind: 'plan-review', approve: 'Approve', reject: 'Reject' },
      }],
    },
  }]]))
  const html = render(component, props, sessionsOf())

  assert.match(html, /att-plan/)
  assert.match(html, /1\. do the thing/)
  assert.match(html, /plan\.approve/)
  assert.match(html, /plan\.decline/)
  harness.teardown()
})

test('finished session produces one aggregated card', async () => {
  const harness = createHarness({
    sessions: sessionsOf(),
    initialStatus: new Map([['s1', { running: true, completionUnread: false }]]),
  })
  const { component, props } = await harness.apply()

  harness.publish(new Map([['s1', { running: false, completionUnread: false }]]))
  await sleep(1750)
  const html = render(component, props, sessionsOf())

  assert.match(html, /att-card/)
  assert.match(html, /Session one/)
  assert.match(html, /dismiss/)
  harness.teardown()
})

test('the Session on screen renders no pending card', async () => {
  const sessions = sessionsOf({ s1: { retainedBy: { mainView: 1 } } })
  const harness = createHarness({
    sessions,
    initialStatus: new Map([['s1', { running: false, completionUnread: false }]]),
  })
  const { component, props } = await harness.apply()

  harness.publish(new Map([['s1', {
    running: false,
    pendingInteraction: approval,
    completionUnread: false,
  }]]))
  const html = render(component, props, sessions)

  assert.equal(html, '')
  harness.teardown()
})

/**
 * Regression: overflow:hidden gives a flex item an automatic minimum height of
 * zero. Without flex:none a card with several questions shrank to the stack's
 * max-height and clipped its own actions row, so the submit button vanished.
 */
test('multi-question card keeps its height and its submit row', async () => {
  const harness = createHarness({
    sessions: sessionsOf(),
    initialStatus: new Map([['s1', { running: false, completionUnread: false }]]),
  })
  const { component, props } = await harness.apply()
  const css = styleTags.map((tag) => tag.textContent).join('\n')

  assert.match(css, /\.att-root\{[^}]*overflow-y:auto/)
  assert.match(css, /\.att-card\{[^}]*flex:none/)

  harness.publish(new Map([['s1', {
    running: false,
    completionUnread: false,
    pendingInteraction: {
      key: 'question:3',
      kind: 'question',
      answer: async () => {},
      questions: [
        { id: 'q1', question: 'Which branch?', options: [{ label: 'main' }] },
        { id: 'q2', question: 'Which remote?', options: [{ label: 'origin' }, { label: 'upstream' }] },
        { id: 'q3', question: 'Anything else?' },
      ],
    },
  }]]))
  const html = render(component, props, sessionsOf())

  assert.equal((html.match(/att-qtext/g) ?? []).length, 3)
  assert.equal((html.match(/att-input/g) ?? []).length, 3)
  assert.match(html, /question\.skip/)
  assert.match(html, /question\.submit/)
  assert.ok(
    html.lastIndexOf('question.submit') > html.lastIndexOf('att-input'),
    'submit must follow the last question block',
  )
  harness.teardown()
})

/**
 * The palette must come from the theme alias tokens. The shipped brand fill is
 * monochrome — near-black in light, near-white in dark — so a hard-coded white
 * label made the primary button unreadable in dark mode; the surface token has
 * the same problem (bg-overlay is a mid grey in dark). These assertions keep
 * the tokens that carry that fix.
 */
test('palette follows the active theme instead of light-only colors', async () => {
  const harness = createHarness({
    sessions: sessionsOf(),
    initialStatus: new Map([['s1', { running: false, completionUnread: false }]]),
  })
  await harness.apply()
  const css = styleTags.map((tag) => tag.textContent).join('\n')

  assert.match(
    css,
    /\.att-btn\[data-variant="primary"\]\{[^}]*color:var\(--dsw-alias-label-primary-foreground\)/,
  )
  assert.match(css, /\.att-btn\[data-variant="primary"\]:hover[^{]*\{[^}]*button-primary-hover/)
  assert.match(css, /light-dark\(var\(--dsw-alias-bg-overlay\),var\(--dsw-alias-bg-layer-1\)\)/)
  assert.match(css, /--dsw-alias-interactive-bg-hover/)
  assert.match(css, /--dsw-alias-label-tertiary/)
  assert.equal(css.includes('color:#fff'), false, 'no hard-coded white label')
  assert.doesNotMatch(css, /#f6f7f8|#f0f1f3|#1b1c1f|#2f6fed|#8a8f98|#e3e5e8|#d4d7db|#fafafa/)
  harness.teardown()
})

import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * Exercise the Client bundle's attention store without a browser: the bundle
 * registers through `window.__ModuleLoader__`, so this harness captures the
 * factory, stubs React/DOM, and drives the session-status source the same way
 * the shipped UI does.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

let cachedBundle

async function loadBundle() {
  if (cachedBundle !== undefined) return cachedBundle
  let captured

  const audio = { oscillators: 0 }

  class FakeAudioContext {
    constructor() {
      this.state = 'running'
      this.currentTime = 0
      this.destination = {}
    }

    createOscillator() {
      audio.oscillators += 1
      return {
        type: 'sine',
        frequency: { setValueAtTime() {} },
        connect() {},
        start() {},
        stop() {},
      }
    }

    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
      }
    }

    resume() {
      this.state = 'running'
      return Promise.resolve()
    }

    close() {
      return Promise.resolve()
    }
  }

  globalThis.window = {
    __ModuleLoader__: {
      load({ id, factory }) {
        captured = { id, factory }
      },
    },
    AudioContext: FakeAudioContext,
    addEventListener() {},
    removeEventListener() {},
  }
  globalThis.document = {
    visibilityState: 'visible',
    createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
    head: { appendChild() {} },
  }

  await import('../lib/client.js')
  if (captured === undefined) throw new Error('bundle did not register through __ModuleLoader__')
  cachedBundle = captured
  cachedBundle.audio = audio
  return cachedBundle
}

function fakeReact() {
  return {
    createElement() {},
    Children: { toArray: (value) => value },
    useState: () => [undefined, () => {}],
    useSyncExternalStore: () => undefined,
  }
}

const locale = {
  register: () => () => {},
  bind: () => (key, params) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`),
  resolveText: (value) => value.en ?? '',
}

function createHarness({ sessions, initialStatus }) {
  const listeners = new Set()
  let status = initialStatus
  const effects = []
  let registered
  let injected

  const ctx = {
    effect(fn) {
      const dispose = fn()
      effects.push(dispose)
      return () => dispose?.()
    },
    locale,
    sessions: {
      list: { getSnapshot: () => ({ byId: sessions }) },
    },
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
        injected = callback()
      },
      register(_options, component) {
        registered = { options: _options, component }
        return () => {}
      },
    },
  }

  const publish = (next) => {
    status = next
    for (const listener of [...listeners]) listener()
  }

  return {
    apply: async () => {
      const bundle = await loadBundle()
      const module = bundle.factory((name) => {
        if (name === 'react') return fakeReact()
        throw new Error(`unexpected require: ${name}`)
      })
      module.apply(ctx)
      const props = registered.options.inject()
      return { options: registered.options, store: props.store }
    },
    publish,
    teardown() {
      for (const dispose of effects) dispose?.()
    },
  }
}

const sessionsOf = (overrides = {}) => ({
  s1: { id: 's1', title: 'Session one', retainedBy: { mainView: 0 }, ...overrides.s1 },
  s2: { id: 's2', title: 'Session two', retainedBy: { mainView: 0 }, ...overrides.s2 },
})

const approval = {
  key: 'approval:1',
  kind: 'approval',
  toolName: 'bash',
  reason: 'needs escalation',
  answer: async () => {},
}

test('register id and overlay entry are stable', async () => {
  const harness = createHarness({ sessions: sessionsOf(), initialStatus: new Map() })
  const { options } = await harness.apply()
  assert.equal(options.name, 'shell.overlay')
  assert.equal(options.id, 'dsh-approval-popups.stack')
  harness.teardown()
})

test('pending interactions are collected and cleared', async () => {
  const harness = createHarness({
    sessions: sessionsOf(),
    initialStatus: new Map([['s1', { running: false, completionUnread: false }]]),
  })
  const { store } = await harness.apply()

  harness.publish(new Map([['s1', {
    running: false,
    pendingInteraction: approval,
    completionUnread: false,
  }]]))
  assert.equal(store.getSnapshot().pending.length, 1)
  assert.equal(store.getSnapshot().pending[0].sessionId, 's1')

  harness.publish(new Map([['s1', { running: false, completionUnread: false }]]))
  assert.equal(store.getSnapshot().pending.length, 0)
  harness.teardown()
})

test('subagent sessions never surface', async () => {
  const harness = createHarness({
    sessions: { s1: { id: 's1', title: 'child', origin: 'subagent', retainedBy: { mainView: 0 } } },
    initialStatus: new Map([['s1', { running: false, completionUnread: false }]]),
  })
  const { store } = await harness.apply()

  harness.publish(new Map([['s1', {
    running: false,
    pendingInteraction: approval,
    completionUnread: false,
  }]]))
  assert.equal(store.getSnapshot().pending.length, 0)
  harness.teardown()
})

test('a finished background session is announced after the settle delay', async () => {
  const harness = createHarness({
    sessions: sessionsOf(),
    initialStatus: new Map([['s1', { running: true, completionUnread: false }]]),
  })
  const { store } = await harness.apply()

  harness.publish(new Map([['s1', { running: false, completionUnread: false }]]))
  assert.equal(store.getSnapshot().completions.length, 0)
  await sleep(1750)
  assert.equal(store.getSnapshot().completions.length, 1)
  assert.equal(store.getSnapshot().completions[0].sessionId, 's1')

  store.dismiss('s1')
  assert.equal(store.getSnapshot().completions.length, 0)
  harness.teardown()
})

test('a session waiting for approval does not count as finished', async () => {
  const harness = createHarness({
    sessions: sessionsOf(),
    initialStatus: new Map([['s1', { running: true, completionUnread: false }]]),
  })
  const { store } = await harness.apply()

  harness.publish(new Map([['s1', {
    running: false,
    pendingInteraction: approval,
    completionUnread: false,
  }]]))
  await sleep(1750)
  assert.equal(store.getSnapshot().completions.length, 0)
  harness.teardown()
})

test('the session already on screen is not announced', async () => {
  const harness = createHarness({
    sessions: sessionsOf({ s1: { retainedBy: { mainView: 1 } } }),
    initialStatus: new Map([['s1', { running: true, completionUnread: false }]]),
  })
  const { store } = await harness.apply()

  harness.publish(new Map([['s1', { running: false, completionUnread: false }]]))
  await sleep(1750)
  assert.equal(store.getSnapshot().completions.length, 0)
  harness.teardown()
})

test('restarting a session withdraws its completion notice', async () => {
  const harness = createHarness({
    sessions: sessionsOf(),
    initialStatus: new Map([['s1', { running: true, completionUnread: false }]]),
  })
  const { store } = await harness.apply()

  harness.publish(new Map([['s1', { running: false, completionUnread: false }]]))
  await sleep(1750)
  assert.equal(store.getSnapshot().completions.length, 1)

  harness.publish(new Map([['s1', { running: true, completionUnread: false }]]))
  assert.equal(store.getSnapshot().completions.length, 0)
  harness.teardown()
})

test('a new request rings the chime exactly once', async () => {
  const harness = createHarness({
    sessions: sessionsOf(),
    initialStatus: new Map([['s1', { running: false, completionUnread: false }]]),
  })
  const { store } = await harness.apply()
  const audio = cachedBundle.audio
  audio.oscillators = 0

  harness.publish(new Map([['s1', {
    running: false,
    pendingInteraction: approval,
    completionUnread: false,
  }]]))
  assert.equal(audio.oscillators, 2, 'two-note attention chime')

  harness.publish(new Map([['s1', {
    running: false,
    pendingInteraction: approval,
    completionUnread: false,
  }]]))
  assert.equal(audio.oscillators, 2, 'the same request does not ring twice')
  harness.teardown()
})

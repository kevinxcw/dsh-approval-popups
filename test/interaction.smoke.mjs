import assert from 'node:assert/strict'
import test from 'node:test'

import React from 'react'
import TestRenderer, { act } from 'react-test-renderer'

/**
 * Drive the question card's real handlers: the selected look must move to the
 * custom field on focus, back to an option on click, and both must stay usable
 * for a multi-select question.
 */

globalThis.IS_REACT_ACT_ENVIRONMENT = true

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
  return cachedBundle
}

const t = (key, params) => (params === undefined ? key : `${key}|${JSON.stringify(params)}`)

function createHarness({ sessions, initialStatus }) {
  const listeners = new Set()
  const effects = []
  let status = initialStatus
  let registered

  const ctx = {
    effect(fn) {
      const dispose = fn()
      effects.push(dispose)
      return () => dispose?.()
    },
    locale: { register: () => () => {}, bind: () => t, resolveText: (value) => value.en ?? '' },
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
      register(options, component) {
        registered = { options, component }
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

const sessions = { s1: { id: 's1', title: 'Session one', retainedBy: { mainView: 0 } } }

async function mountQuestion(question) {
  const harness = createHarness({
    sessions,
    initialStatus: new Map([['s1', { running: false, completionUnread: false }]]),
  })
  const { component, props } = await harness.apply()
  harness.publish(new Map([['s1', {
    running: false,
    completionUnread: false,
    pendingInteraction: {
      key: `question:${question.id}`,
      kind: 'question',
      answer: async () => {},
      questions: [question],
    },
  }]]))

  const useSessions = (selector) => selector({ byId: sessions })
  const usePanelInfo = (selector) => selector({ activePanelId: null })
  let tree
  act(() => {
    tree = TestRenderer.create(React.createElement(component, {
      ...props, t, useSessions, usePanelInfo,
    }))
  })
  return { tree, harness }
}

const optionNodes = (tree, label) => tree.root.findAll((node) => (
  node.type === 'button' && node.props.className === 'att-opt' && node.findByType('span').props.children === label
))

const selected = (tree, label) => optionNodes(tree, label)[0].props['data-selected']

function textareaOf(tree) {
  return tree.root.findByType('textarea')
}

test('focusing the field moves the selected look off the option, text is kept', async () => {
  const { tree, harness } = await mountQuestion({
    id: 'q1',
    question: 'Which branch?',
    options: [{ label: 'main' }, { label: 'next' }],
  })

  assert.equal(selected(tree, 'main'), 'false')
  assert.equal(textareaOf(tree).props['data-active'], 'false')

  act(() => optionNodes(tree, 'main')[0].props.onClick())
  assert.equal(selected(tree, 'main'), 'true')
  assert.equal(textareaOf(tree).props['data-active'], 'false')

  act(() => textareaOf(tree).props.onFocus())
  assert.equal(selected(tree, 'main'), 'false')
  assert.equal(textareaOf(tree).props['data-active'], 'true')

  act(() => textareaOf(tree).props.onChange({ target: { value: 'typed answer' } }))
  assert.equal(selected(tree, 'main'), 'false')
  assert.equal(textareaOf(tree).props.value, 'typed answer')
  assert.equal(textareaOf(tree).props['data-active'], 'true')

  act(() => optionNodes(tree, 'next')[0].props.onClick())
  assert.equal(selected(tree, 'next'), 'true')
  assert.equal(selected(tree, 'main'), 'false')
  assert.equal(textareaOf(tree).props.value, 'typed answer', 'text survives but is inactive')
  assert.equal(textareaOf(tree).props['data-active'], 'false')

  harness.teardown()
})

test('multi-select keeps options and the custom field active together', async () => {
  const { tree, harness } = await mountQuestion({
    id: 'q2',
    question: 'Pick any',
    multiSelect: true,
    options: [{ label: 'a' }, { label: 'b' }],
  })

  act(() => optionNodes(tree, 'a')[0].props.onClick())
  act(() => textareaOf(tree).props.onFocus())
  act(() => textareaOf(tree).props.onChange({ target: { value: 'plus this' } }))

  assert.equal(selected(tree, 'a'), 'true')
  assert.equal(textareaOf(tree).props['data-active'], 'true')

  act(() => optionNodes(tree, 'b')[0].props.onClick())
  assert.equal(selected(tree, 'a'), 'true')
  assert.equal(selected(tree, 'b'), 'true')
  assert.equal(textareaOf(tree).props['data-active'], 'true')

  harness.teardown()
})

test('a free-text question starts with the field active', async () => {
  const { tree, harness } = await mountQuestion({ id: 'q3', question: 'Anything else?' })

  assert.equal(textareaOf(tree).props['data-active'], 'true')
  harness.teardown()
})

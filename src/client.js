window.__ModuleLoader__.load({
  id: 'dsh-approval-popups',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    /** Locale namespace owned by this plugin. */
    const NS = 'attention'

    /** Fixed slot id: a fresh id beside the shipped overlay entries. */
    const STACK_ID = 'dsh-approval-popups.stack'

    /** How long a session must stay idle before it counts as finished. */
    const SETTLE_MS = 1600

    /** How many completions one card lists before collapsing the rest. */
    const COMPLETION_ROWS = 4

    /** How many completions the store keeps. */
    const COMPLETION_LIMIT = 12

    const zh = {
      'region': '待处理提醒',
      'kind.approval': '等待审批',
      'kind.question': '等待回答',
      'kind.plan': '计划待审',
      'kind.done': '已结束',
      'approval.headline': '工具 {toolName} 请求越权执行',
      'approval.allowOnce': '允许一次',
      'approval.reject': '拒绝',
      'plan.approve': '批准计划',
      'plan.decline': '打回',
      'question.submit': '提交回答',
      'question.skip': '跳过',
      'question.unskip': '取消跳过',
      'question.custom': '或输入你的回答…',
      'done.n': '{n} 个会话已结束',
      'done.more': '还有 {n} 个会话未列出',
      'open': '打开',
      'dismiss': '知道了',
      'unnamed': '未命名会话',
      'error': '提交失败：{message}',
      'error.unsupported': '当前版本不支持在此处提交，请打开会话处理',
    }

    const en = {
      'region': 'Pending attention',
      'kind.approval': 'Waiting for approval',
      'kind.question': 'Waiting for answer',
      'kind.plan': 'Plan awaiting review',
      'kind.done': 'Finished',
      'approval.headline': 'Tool {toolName} requests privileged execution',
      'approval.allowOnce': 'Allow once',
      'approval.reject': 'Reject',
      'plan.approve': 'Approve plan',
      'plan.decline': 'Send back',
      'question.submit': 'Submit answer',
      'question.skip': 'Skip',
      'question.unskip': 'Unskip',
      'question.custom': 'Or type your answer…',
      'done.n': '{n} sessions finished',
      'done.more': '{n} more not listed',
      'open': 'Open',
      'dismiss': 'Dismiss',
      'unnamed': 'Untitled session',
      'error': 'Could not submit: {message}',
      'error.unsupported': 'This version cannot submit from here; open the session',
    }

    const CSS = [
      // Colors come only from theme alias tokens, so the stack follows whatever
      // theme is active (built-in light/dark or a third-party theme). Two token
      // choices carry the dark-mode fix: --dsw-alias-bg-overlay is light-only in
      // practice (its dark value is a mid grey), so the surface falls back to
      // bg-layer-1 in dark; and the brand fill is monochrome, so its label needs
      // --dsw-alias-label-primary-foreground (white on black in light,
      // near-black on white in dark) instead of a hard-coded white.
      '.att-root{position:fixed;right:18px;bottom:18px;z-index:80;display:flex;flex-direction:column;gap:10px;',
      'width:min(420px,calc(100vw - 32px));max-height:min(72vh,760px);overflow-y:auto;pointer-events:auto;',
      'font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);',
      'scrollbar-width:thin;scrollbar-color:var(--dsw-alias-scrollbar-bg-l2) transparent;',
      'overscroll-behavior:contain}',
      '.att-root *{box-sizing:border-box}',
      '.att-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);',
      // flex:none is load-bearing: overflow:hidden makes the automatic minimum
      // height of a flex item zero, so without it a tall card (many questions)
      // shrinks to the stack's max-height and clips its own submit row.
      'border-radius:12px;flex:none;box-shadow:var(--dsw-elevation-prominent,0 12px 30px rgba(0,0,0,.16));',
      'overflow:hidden;animation:att-in .16s ease-out}',
      '@supports (color:light-dark(#000,#fff)){',
      '.att-card{background:light-dark(var(--dsw-alias-bg-overlay),var(--dsw-alias-bg-layer-1))}}',
      '.att-card[data-tone="warn"]{border-color:var(--dsw-alias-state-warn-primary)}',
      '.att-head{display:flex;align-items:center;gap:8px;padding:9px 12px;min-height:38px;',
      'background:var(--dsw-alias-bg-layer-2);border-bottom:1px solid var(--dsw-alias-border-l1)}',
      '.att-dot{flex:none;width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-state-idle-primary)}',
      '.att-dot[data-tone="warn"]{background:var(--dsw-alias-state-warn-primary);',
      'box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-warn-primary) 18%,transparent)}',
      '.att-dot[data-tone="done"]{background:var(--dsw-alias-state-success-primary)}',
      '.att-kind{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.att-title{flex:1;min-width:0;padding:0;border:0;background:transparent;font:inherit;font-size:12px;',
      'color:var(--dsw-alias-label-tertiary);text-align:right;cursor:pointer;overflow:hidden;',
      'text-overflow:ellipsis;white-space:nowrap}',
      '.att-title:hover{color:var(--dsw-alias-label-primary);text-decoration:underline}',
      '.att-body{display:flex;flex-direction:column;gap:8px;padding:12px}',
      '.att-qtext{margin:0;font-size:13px;color:var(--dsw-alias-label-primary);',
      'white-space:pre-wrap;word-break:break-word}',
      '.att-qhead{font-size:11px;letter-spacing:.02em;text-transform:uppercase;',
      'color:var(--dsw-alias-label-tertiary)}',
      '.att-mono{font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);',
      'font-size:12px;color:var(--dsw-alias-label-secondary);word-break:break-all}',
      '.att-plan{max-height:140px;overflow:auto;margin:0;padding:8px 10px;border-radius:8px;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);',
      'color:var(--dsw-alias-label-secondary);',
      'font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px;line-height:18px;',
      'white-space:pre-wrap}',
      '.att-opt{display:flex;flex-direction:column;gap:2px;width:100%;padding:7px 9px;border-radius:8px;',
      'border:1px solid var(--dsw-alias-border-l1);background:transparent;color:inherit;',
      'font:inherit;font-size:12px;text-align:left;cursor:pointer}',
      '.att-opt:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}',
      '.att-opt[data-selected="true"]{border-color:var(--dsw-alias-brand-primary);',
      'background:color-mix(in srgb,var(--dsw-alias-brand-primary) 10%,transparent)}',
      '.att-opt[data-selected="true"]:hover:not(:disabled){',
      'background:color-mix(in srgb,var(--dsw-alias-brand-primary) 16%,transparent)}',
      '.att-opt:disabled{opacity:.6;cursor:default}',
      '.att-opt-desc{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}',
      '.att-input{width:100%;min-height:52px;max-height:132px;resize:vertical;padding:7px 9px;border-radius:8px;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);',
      'color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px}',
      '.att-input::placeholder{color:var(--dsw-alias-label-tertiary)}',
      '.att-input{transition:border-color .12s ease,background-color .12s ease}',
      '.att-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}',
      '.att-input[data-active="true"]{border-color:var(--dsw-alias-brand-primary);',
      'background:color-mix(in srgb,var(--dsw-alias-brand-primary) 6%,transparent)}',
      '.att-actions{display:flex;justify-content:flex-end;gap:8px}',
      '.att-btn{height:28px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);',
      'background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;',
      'cursor:pointer;white-space:nowrap;transition:background-color .12s ease,box-shadow .12s ease}',
      '.att-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}',
      '.att-btn:disabled{opacity:.5;cursor:default}',
      '.att-btn[data-variant="primary"]{background:var(--dsw-alias-brand-primary);',
      'border-color:transparent;color:var(--dsw-alias-label-primary-foreground)}',
      '.att-btn[data-variant="primary"]:hover:not(:disabled){',
      'background-color:var(--dsw-alias-button-primary-hover);box-shadow:var(--dsw-shadow-lv1)}',
      '.att-btn[data-variant="primary"]:active:not(:disabled){',
      'background-color:var(--dsw-alias-button-primary-hover);',
      'box-shadow:inset 0 0 0 999px var(--dsw-alias-interactive-bg-hover)}',
      '.att-btn[data-variant="danger"]{color:var(--dsw-alias-state-error-primary)}',
      '.att-btn[data-variant="danger"]:hover:not(:disabled){',
      'background:var(--dsw-alias-interactive-bg-hover-danger)}',
      '.att-grow{flex:1}',
      '.att-rows{display:flex;flex-direction:column;gap:2px}',
      '.att-row{display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;border:0;border-radius:8px;',
      'background:transparent;color:inherit;font:inherit;font-size:13px;text-align:left;cursor:pointer}',
      '.att-row:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.att-row-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.att-row-action{flex:none;font-size:12px;color:var(--dsw-alias-brand-primary)}',
      '.att-more{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.att-error{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary);',
      'word-break:break-word}',
      '.att-skip{align-self:flex-start;padding:0;border:0;background:transparent;font:inherit;font-size:11px;',
      'color:var(--dsw-alias-label-tertiary);cursor:pointer;text-decoration:underline}',
      '.att-skip:hover{color:var(--dsw-alias-label-primary)}',
      '@keyframes att-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
      '@media (prefers-reduced-motion:reduce){.att-card{animation:none}}',
      '.att-btn:focus-visible,.att-opt:focus-visible,.att-row:focus-visible,.att-title:focus-visible{',
      'outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}',
    ].join('')

    /** Install the plugin stylesheet; the Cordis effect removes it on unload. */
    function installStyles() {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-approval-popups'
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => tag.remove()
    }

    function messageOf(cause) {
      return cause instanceof Error ? cause.message : String(cause)
    }

    /**
     * Narrow a question batch to the plan-review presentation, mirroring the
     * shipped planner card: one question carrying the plan as detail and the
     * named approve option.
     *
     * @param questions - the request's whole question batch.
     * @returns The narrowed review, or undefined for the generic flow.
     */
    function planReviewOf(questions) {
      if (questions.length !== 1) return undefined
      const question = questions[0]
      const intent = question.intent
      if (intent === undefined || intent.kind !== 'plan-review') return undefined
      if (typeof question.detail !== 'string' || question.detail === '') return undefined
      if (question.multiSelect === true) return undefined
      const options = Array.isArray(question.options) ? question.options : []
      const approve = options.find((option) => option.label === intent.approve)
      if (approve === undefined) return undefined
      const decline = options.find((option) => option.label !== intent.approve)
      return {
        id: question.id,
        question: question.question,
        plan: question.detail,
        approveLabel: approve.label,
        declineLabel: decline === undefined ? intent.reject : decline.label,
      }
    }

    /**
     * Short synthesized attention tone. No audio asset ships with the plugin.
     * Browsers gate audio behind a user gesture, so the context is created on
     * the first interaction and every later notification reuses it.
     *
     * @returns `listen` for the one-time unlock effect and `play` for notices.
     */
    function createChime() {
      let context

      const ensure = () => {
        if (context !== undefined) return context
        const Ctor = typeof window === 'undefined'
          ? undefined
          : (window.AudioContext ?? window.webkitAudioContext)
        if (Ctor === undefined) return undefined
        try {
          context = new Ctor()
        } catch {
          context = undefined
        }
        return context
      }

      const resume = () => {
        const audio = ensure()
        if (audio === undefined || audio.state !== 'suspended') return
        audio.resume().catch(() => {})
      }

      const note = (audio, frequency, start, duration, peak) => {
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, start)
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(peak, start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
        oscillator.connect(gain)
        gain.connect(audio.destination)
        oscillator.start(start)
        oscillator.stop(start + duration + 0.03)
      }

      return {
        listen() {
          if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {}
          const unlock = () => resume()
          window.addEventListener('pointerdown', unlock, { capture: true, passive: true })
          window.addEventListener('keydown', unlock, { capture: true })
          return () => {
            window.removeEventListener('pointerdown', unlock, { capture: true })
            window.removeEventListener('keydown', unlock, { capture: true })
            const audio = context
            if (audio !== undefined) {
              try {
                audio.close().catch(() => {})
              } catch {
                // A closed or unavailable context must never break teardown.
              }
            }
          }
        },
        play(kind) {
          const audio = ensure()
          if (audio === undefined) return
          if (audio.state !== 'running') {
            resume()
            return
          }
          try {
            const now = audio.currentTime + 0.02
            if (kind === 'done') {
              note(audio, 660, now, 0.18, 0.05)
              return
            }
            note(audio, 740, now, 0.12, 0.06)
            note(audio, 988, now + 0.1, 0.16, 0.06)
          } catch {
            // Best effort: a blocked AudioContext must never break the card.
          }
        },
      }
    }

    /**
     * Client-side attention store. Pending interactions are read from the
     * shipped `uiSession.sessionStatus` projection; completion is the edge of a
     * session's live running flag, debounced so a between-turn gap does not
     * announce a finish.
     *
     * @param ctx - Client root context with `sessions` and `uiSession`.
     * @param notify - Called for each newly arrived request or finish.
     * @returns Subscription surface plus the two dismiss actions.
     */
    function createAttentionStore(ctx, notify) {
      let pendingItems = []
      let completions = []
      let snapshot = { pending: [], completions }
      const listeners = new Set()
      const lastRunning = new Map()
      const timers = new Map()
      let primed = false
      let armed = false
      let disposed = false

      const statusOf = () => {
        const source = ctx.uiSession === undefined ? undefined : ctx.uiSession.sessionStatus
        return source === undefined ? undefined : source.getSnapshot()
      }

      const emit = () => {
        snapshot = { pending: pendingItems, completions }
        for (const listener of [...listeners]) listener()
      }

      const rowOf = (id) => {
        const list = ctx.sessions === undefined ? undefined : ctx.sessions.list
        const snapshotValue = list === undefined ? undefined : list.getSnapshot()
        return snapshotValue === undefined ? undefined : snapshotValue.byId[id]
      }

      const isSubagent = (id) => {
        const row = rowOf(id)
        return row !== undefined && (row.origin === 'subagent' || row.subagent != null)
      }

      const currentSessionId = () => {
        const list = ctx.sessions === undefined ? undefined : ctx.sessions.list
        const snapshotValue = list === undefined ? undefined : list.getSnapshot()
        if (snapshotValue === undefined) return undefined
        for (const id of Object.keys(snapshotValue.byId)) {
          if ((snapshotValue.byId[id].retainedBy?.mainView ?? 0) > 0) return id
        }
        return undefined
      }

      const cancel = (id) => {
        const timer = timers.get(id)
        if (timer === undefined) return
        clearTimeout(timer)
        timers.delete(id)
      }

      const removeCompletion = (id) => {
        if (!completions.some((entry) => entry.sessionId === id)) return false
        completions = completions.filter((entry) => entry.sessionId !== id)
        return true
      }

      const schedule = (id) => {
        if (timers.has(id)) return
        timers.set(id, setTimeout(() => {
          timers.delete(id)
          if (disposed) return
          const state = statusOf()?.get(id)
          if (state !== undefined && (state.running === true || state.pendingInteraction !== undefined)) return
          if (isSubagent(id)) return
          const visibleNow = typeof document === 'undefined' || document.visibilityState === 'visible'
          if (id === currentSessionId() && visibleNow) return
          completions = [
            { sessionId: id, at: Date.now() },
            ...completions.filter((entry) => entry.sessionId !== id),
          ].slice(0, COMPLETION_LIMIT)
          emit()
          notify('done')
        }, SETTLE_MS))
      }

      const syncPending = (map) => {
        const incoming = []
        for (const [id, state] of map) {
          const pending = state.pendingInteraction
          if (pending === undefined || isSubagent(id)) continue
          incoming.push({
            sessionId: id,
            key: String(pending.key ?? id),
            kind: String(pending.kind ?? 'question'),
            pending,
          })
        }
        const known = new Set(pendingItems.map((item) => item.key))
        const fresh = incoming.filter((item) => !known.has(item.key))
        if (armed && fresh.length > 0) notify('pending')
        const byKey = new Map(incoming.map((item) => [item.key, item]))
        const kept = pendingItems
          .filter((item) => byKey.has(item.key))
          .map((item) => byKey.get(item.key))
        const next = [...fresh, ...kept]
        const same = pendingItems.length === next.length
          && pendingItems.every((item, index) => item.key === next[index].key && item.pending === next[index].pending)
        if (same) return false
        pendingItems = next
        return true
      }

      const syncRunning = (map) => {
        if (!primed) {
          for (const [id, state] of map) lastRunning.set(id, state.running === true)
          primed = true
          return false
        }
        let changed = false
        for (const [id, state] of map) {
          const now = state.running === true
          const was = lastRunning.get(id) === true
          lastRunning.set(id, now)
          if (now) {
            cancel(id)
            if (removeCompletion(id)) changed = true
            continue
          }
          if (!was) continue
          if (state.pendingInteraction !== undefined) continue
          if (isSubagent(id)) continue
          schedule(id)
        }
        return changed
      }

      const refresh = () => {
        if (disposed) return
        const map = statusOf()
        if (map === undefined) return
        const pendingChanged = syncPending(map)
        const runningChanged = syncRunning(map)
        if (pendingChanged || runningChanged) emit()
        armed = true
      }

      return {
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        getSnapshot() {
          return snapshot
        },
        refresh,
        dispose() {
          disposed = true
          for (const timer of timers.values()) clearTimeout(timer)
          timers.clear()
          listeners.clear()
        },
        dismiss(sessionId) {
          if (!removeCompletion(sessionId)) return
          emit()
        },
        dismissAll() {
          if (completions.length === 0) return
          completions = []
          emit()
        },
      }
    }

    /** Shared card chrome: tone dot, kind label, and a Session title that opens it. */
    function CardShell({ tone, kind, title, onOpen, children }) {
      return h(
        'section',
        { className: 'att-card', 'data-tone': tone },
        h(
          'header',
          { className: 'att-head' },
          h('span', { className: 'att-dot', 'data-tone': tone }),
          h('span', { className: 'att-kind' }, kind),
          h(
            'button',
            {
              type: 'button',
              className: 'att-title',
              title,
              onClick: onOpen,
            },
            title,
          ),
        ),
        h('div', { className: 'att-body' }, React.Children.toArray(children)),
      )
    }

    /** One pending approval: the same one-shot decision the composer card offers. */
    function ApprovalCard({ item, t, titleOf, openSession, resolveText }) {
      const pending = item.pending
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)

      const reason = pending.displayReason !== undefined && pending.displayReason !== null
        ? resolveText(pending.displayReason)
        : typeof pending.reason === 'string' ? pending.reason : ''
      const toolName = typeof pending.toolName === 'string' ? pending.toolName : ''
      const headline = reason === ''
        ? t('approval.headline', { toolName: toolName === '' ? '?' : toolName })
        : reason

      const answer = (outcome) => {
        if (busy) return
        if (typeof pending.answer !== 'function') {
          setError(t('error.unsupported'))
          return
        }
        setBusy(true)
        setError(null)
        Promise.resolve()
          .then(() => pending.answer(outcome))
          .catch((cause) => {
            setBusy(false)
            setError(t('error', { message: messageOf(cause) }))
          })
      }

      return h(
        CardShell,
        {
          tone: 'warn',
          kind: t('kind.approval'),
          title: titleOf(item.sessionId),
          onOpen: () => openSession(item.sessionId),
        },
        h('p', { className: 'att-qtext' }, headline),
        toolName !== '' && reason !== '' ? h('div', { className: 'att-mono' }, toolName) : null,
        error === null ? null : h('p', { className: 'att-error' }, error),
        h(
          'div',
          { className: 'att-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'att-btn',
              'data-variant': 'danger',
              disabled: busy,
              onClick: () => answer('rejected'),
            },
            t('approval.reject'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'att-btn',
              'data-variant': 'primary',
              disabled: busy,
              onClick: () => answer('allowed-once'),
            },
            t('approval.allowOnce'),
          ),
        ),
      )
    }

    /** One plan waiting for approval: the plan text plus approve / send back. */
    function PlanReviewCard({ item, plan, t, titleOf, openSession }) {
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)

      const answer = (label) => {
        if (busy) return
        if (typeof item.pending.answer !== 'function') {
          setError(t('error.unsupported'))
          return
        }
        setBusy(true)
        setError(null)
        Promise.resolve()
          .then(() => item.pending.answer({ answers: [{ id: plan.id, selected: [label] }] }))
          .catch((cause) => {
            setBusy(false)
            setError(t('error', { message: messageOf(cause) }))
          })
      }

      return h(
        CardShell,
        {
          tone: 'warn',
          kind: t('kind.plan'),
          title: titleOf(item.sessionId),
          onOpen: () => openSession(item.sessionId),
        },
        h('p', { className: 'att-qtext' }, plan.question),
        h('pre', { className: 'att-plan' }, plan.plan),
        error === null ? null : h('p', { className: 'att-error' }, error),
        h(
          'div',
          { className: 'att-actions' },
          typeof plan.declineLabel !== 'string' ? null : h(
            'button',
            {
              type: 'button',
              className: 'att-btn',
              'data-variant': 'danger',
              disabled: busy,
              onClick: () => answer(plan.declineLabel),
            },
            t('plan.decline'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'att-btn',
              'data-variant': 'primary',
              disabled: busy,
              onClick: () => answer(plan.approveLabel),
            },
            t('plan.approve'),
          ),
        ),
      )
    }

    /** One generic question batch: options, custom text, per-question skip. */
    function QuestionCard({ item, questions, t, titleOf, openSession }) {
      const pending = item.pending
      const [drafts, setDrafts] = React.useState(() => questions.map((question) => ({
        selected: [],
        custom: '',
        skipped: false,
        // Single-select: options and the custom field are mutually exclusive on
        // submit, so one of them owns the visual selected state. Multi-select
        // submits both, so the field keeps its own highlight beside them.
        mode: Array.isArray(question.options) && question.options.length > 0 ? 'option' : 'custom',
      })))
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState(null)

      const update = (index, patch) => {
        setDrafts((current) => current.map((draft, position) => (
          position === index ? { ...draft, ...patch } : draft
        )))
      }

      const toggle = (index, label, multi) => {
        setDrafts((current) => current.map((draft, position) => {
          if (position !== index) return draft
          const selected = multi === true
            ? (draft.selected.includes(label)
              ? draft.selected.filter((value) => value !== label)
              : [...draft.selected, label])
            : [label]
          return {
            ...draft,
            selected,
            skipped: false,
            mode: multi === true ? draft.mode : 'option',
          }
        }))
      }

      /** Focusing the field takes the selection (single-select) without clearing text. */
      const activate = (index) => {
        setDrafts((current) => current.map((draft, position) => (
          position === index && draft.mode !== 'custom' ? { ...draft, mode: 'custom' } : draft
        )))
      }

      const complete = drafts.every((draft, index) => {
        if (draft.skipped) return true
        const question = questions[index]
        if (question.multiSelect === true) {
          return draft.selected.length > 0 || draft.custom.trim() !== ''
        }
        if (draft.mode === 'custom') return draft.custom.trim() !== ''
        return draft.selected.length > 0
      })

      const submit = () => {
        if (busy) return
        if (typeof pending.answer !== 'function') {
          setError(t('error.unsupported'))
          return
        }
        const answers = questions.map((question, index) => {
          const draft = drafts[index]
          if (draft.skipped) return { id: question.id, selected: [] }
          const custom = draft.custom.trim()
          if (question.multiSelect === true) {
            return {
              id: question.id,
              selected: draft.selected,
              ...(custom === '' ? {} : { custom }),
            }
          }
          if (draft.mode === 'custom') {
            return {
              id: question.id,
              selected: [],
              ...(custom === '' ? {} : { custom }),
            }
          }
          return { id: question.id, selected: draft.selected }
        })
        setBusy(true)
        setError(null)
        Promise.resolve()
          .then(() => pending.answer({ answers }))
          .catch((cause) => {
            setBusy(false)
            setError(t('error', { message: messageOf(cause) }))
          })
      }

      return h(
        CardShell,
        {
          tone: 'warn',
          kind: t('kind.question'),
          title: titleOf(item.sessionId),
          onOpen: () => openSession(item.sessionId),
        },
        h(
          'div',
          { className: 'att-rows' },
          questions.map((question, index) => h(
            'div',
            { key: question.id ?? String(index), className: 'att-body', style: { padding: 0 } },
            question.header === undefined || question.header === ''
              ? null
              : h('div', { className: 'att-qhead' }, question.header),
            h('p', { className: 'att-qtext' }, question.question),
            typeof question.detail !== 'string' || question.detail === ''
              ? null
              : h('pre', { className: 'att-plan' }, question.detail),
            ...(Array.isArray(question.options) ? question.options : []).map((option) => h(
              'button',
              {
                key: option.label,
                type: 'button',
                className: 'att-opt',
                'data-selected': (
                  question.multiSelect === true
                    ? drafts[index].selected.includes(option.label)
                    : drafts[index].mode === 'option' && drafts[index].selected.includes(option.label)
                ) ? 'true' : 'false',
                disabled: busy,
                onClick: () => toggle(index, option.label, question.multiSelect),
              },
              h('span', { className: 'att-opt-label' }, option.label),
              typeof option.description === 'string' && option.description !== ''
                ? h('span', { className: 'att-opt-desc' }, option.description)
                : null,
            )),
            h('textarea', {
              className: 'att-input',
              rows: 2,
              value: drafts[index].custom,
              disabled: busy,
              placeholder: t('question.custom'),
              'data-active': drafts[index].mode === 'custom' ? 'true' : 'false',
              onFocus: () => activate(index),
              onChange: (event) => update(index, {
                custom: event.target.value,
                mode: 'custom',
              }),
            }),
            questions.length > 1
              ? h(
                'button',
                {
                  type: 'button',
                  className: 'att-skip',
                  disabled: busy,
                  onClick: () => update(index, {
                    skipped: !drafts[index].skipped,
                    selected: [],
                    custom: '',
                    mode: 'option',
                  }),
                },
                drafts[index].skipped ? t('question.unskip') : t('question.skip'),
              )
              : null,
          )),
        ),
        error === null ? null : h('p', { className: 'att-error' }, error),
        h(
          'div',
          { className: 'att-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'att-btn',
              'data-variant': 'primary',
              disabled: busy || !complete,
              onClick: submit,
            },
            t('question.submit'),
          ),
        ),
      )
    }

    /** Route one pending interaction to its presentation. */
    function PendingCard(props) {
      const { item } = props
      if (item.kind === 'approval') return h(ApprovalCard, props)
      const questions = Array.isArray(item.pending.questions) ? item.pending.questions : []
      const plan = planReviewOf(questions)
      if (plan !== undefined) return h(PlanReviewCard, { ...props, plan })
      return h(QuestionCard, { ...props, questions })
    }

    /** One aggregated card for sessions that finished while you were elsewhere. */
    function CompletionCard({ completions, t, titleOf, openSession, store }) {
      const shown = completions.slice(0, COMPLETION_ROWS)
      const extra = completions.length - shown.length
      return h(
        'section',
        { className: 'att-card' },
        h(
          'header',
          { className: 'att-head' },
          h('span', { className: 'att-dot', 'data-tone': 'done' }),
          h('span', { className: 'att-kind' }, t('kind.done')),
          h(
            'span',
            { className: 'att-kind', style: { marginLeft: 'auto', opacity: 0.8 } },
            completions.length === 1 ? '' : t('done.n', { n: completions.length }),
          ),
        ),
        h(
          'div',
          { className: 'att-body' },
          h(
            'div',
            { className: 'att-rows' },
            shown.map((entry) => h(
              'button',
              {
                key: entry.sessionId,
                type: 'button',
                className: 'att-row',
                title: titleOf(entry.sessionId),
                onClick: () => {
                  openSession(entry.sessionId)
                  store.dismiss(entry.sessionId)
                },
              },
              h('span', { className: 'att-row-title' }, titleOf(entry.sessionId)),
              h('span', { className: 'att-row-action' }, t('open')),
            )),
          ),
          extra > 0 ? h('div', { className: 'att-more' }, t('done.more', { n: extra })) : null,
          h(
            'div',
            { className: 'att-actions' },
            h(
              'button',
              { type: 'button', className: 'att-btn att-grow', onClick: () => store.dismissAll() },
              t('dismiss'),
            ),
          ),
        ),
      )
    }

    /**
     * Frame-wide stack. Pending cards for the Session already on screen are
     * hidden because the shipped composer takeover shows the same request.
     */
    function AttentionStack(props) {
      const { store, t, openSession, resolveText, useSessions, usePanelInfo } = props
      const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
      const byId = useSessions((state) => state.byId)
      const currentId = useSessions((state) => {
        const rows = state.byId === undefined ? {} : state.byId
        for (const id of Object.keys(rows)) {
          if ((rows[id].retainedBy?.mainView ?? 0) > 0) return id
        }
        return undefined
      })
      const panelActive = usePanelInfo((info) => info.activePanelId !== null)

      const title = (id) => {
        const row = byId === undefined ? undefined : byId[id]
        const value = row !== undefined && typeof row.title === 'string' ? row.title.trim() : ''
        return value === '' ? t('unnamed') : value
      }

      const visible = snapshot.pending.filter((item) => (
        panelActive === true || item.sessionId !== currentId
      ))

      const cards = visible.map((item) => h(PendingCard, {
        key: `${item.sessionId}::${item.key}`,
        item,
        t,
        titleOf: title,
        openSession,
        resolveText,
      }))

      if (snapshot.completions.length > 0) {
        cards.push(h(CompletionCard, {
          key: 'att-completions',
          completions: snapshot.completions,
          t,
          titleOf: title,
          openSession,
          store,
        }))
      }

      if (cards.length === 0) return null
      return h(
        'div',
        { className: 'att-root', role: 'region', 'aria-label': t('region') },
        cards,
      )
    }

    const inject = ['slots', 'locale', 'sessions', 'uiSession', 'uiWorkspace']

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-approval-popups: dictionaries')
      ctx.effect(() => installStyles(), 'dsh-approval-popups: styles')

      const chime = createChime()
      ctx.effect(() => chime.listen(), 'dsh-approval-popups: audio unlock')
      const store = createAttentionStore(ctx, (kind) => chime.play(kind))

      ctx.effect(() => {
        const read = () => store.refresh()
        const dispose = ctx.uiSession.sessionStatus.subscribe(read)
        read()
        return () => {
          dispose()
          store.dispose()
        }
      }, 'dsh-approval-popups: session status')

      const openSession = (sessionId) => {
        try {
          ctx.uiWorkspace.openSession(sessionId)
        } catch (error) {
          console.error('[dsh-approval-popups] could not open session', error)
        }
      }

      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: STACK_ID,
        order: 80,
        locale: NS,
        inject: () => ({
          store,
          openSession,
          resolveText: (value) => ctx.locale.resolveText(value),
        }),
      }, AttentionStack))
    }

    return {
      name: 'dsh-approval-popups-client',
      inject,
      apply,
    }
  },
})

import { useCallback, useEffect, useMemo, useState } from 'react'
import ChatSidebar from '../components/chat/ChatSidebar'
import ChatThreadView from '../components/chat/ChatThreadView'
import ChatComposer from '../components/chat/ChatComposer'
import ContextDrawer from '../components/chat/ContextDrawer'
import HelpModal from '../components/dashboard/HelpModal'
import UpgradeModal from '../components/dashboard/UpgradeModal'
import ModelCatalogModal from '../components/chat/ModelCatalogModal'
import SafetyRecoveryModal from '../components/chat/SafetyRecoveryModal'
import { BrandLockup, PanelRightIcon } from '../BrandSystem'
import '../chat-workspace.css'

const API_URL = 'http://127.0.0.1:8000/api/v1'
const ACTIVE_STATUSES = new Set(['pending', 'parsing', 'validating', 'generating', 'compiling', 'backtesting'])
const DEFAULT_MODEL = {
  providerId: 'gemini',
  providerLabel: 'Google Gemini',
  modelId: 'gemini-2.5-flash',
  modelLabel: 'Gemini 2.5 Flash',
  qualityMode: 'balanced',
}

function buildAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

function deriveExpandedRuns(thread) {
  if (!thread?.runs?.length) return {}
  const latestFailed = [...thread.runs].reverse().find((run) => run.status === 'failed')
  return latestFailed ? { [latestFailed.id]: true } : {}
}

export default function ChatWorkspacePage({
  token,
  username,
  billing,
  onRefreshBilling,
  onLogout,
  onOpenBillingPortal,
  onCheckout,
}) {
  const [catalog, setCatalog] = useState(null)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)
  const [searchQuery, setSearchQuery] = useState('')
  const [chats, setChats] = useState([])
  const [selectedThreadId, setSelectedThreadId] = useState(null)
  const [thread, setThread] = useState(null)
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [selectedRun, setSelectedRun] = useState(null)
  const [expandedRuns, setExpandedRuns] = useState({})
  const [prompt, setPrompt] = useState('')
  const [sending, setSending] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [activeTab, setActiveTab] = useState('code')
  const [showHelp, setShowHelp] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showSafetyModal, setShowSafetyModal] = useState(false)
  const [safetyData, setSafetyData] = useState(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [loadingChats, setLoadingChats] = useState(false)

  const headers = useMemo(() => buildAuthHeaders(token), [token])
  const usedCount = billing?.daily_used ?? 0
  const usedMax = 5
  const isPro = billing?.is_pro ?? false
  const filteredChats = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase()
    if (!needle) return chats
    return chats.filter((chat) => chat.title.toLowerCase().includes(needle))
  }, [chats, searchQuery])

  const runsById = useMemo(() => {
    const map = {}
    for (const run of thread?.runs || []) {
      map[run.id] = run
    }
    return map
  }, [thread])

  const selectedModelLabel = `${selectedModel.providerLabel} - ${selectedModel.modelLabel}`
  const shouldPollThread = useMemo(
    () => thread?.runs?.some((run) => ACTIVE_STATUSES.has(run.status)) || false,
    [thread]
  )

  const loadModels = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/models`, { headers })
      if (!res.ok) return
      const data = await res.json()
      setCatalog(data)
      const provider = data.providers?.[0]
      const model = provider?.models?.[0]
      if (provider && model) {
        setSelectedModel({
          providerId: provider.id,
          providerLabel: provider.label,
          modelId: model.id,
          modelLabel: model.label,
          qualityMode: 'balanced',
        })
      }
    } catch {
      // Keep local fallback selection if model catalog is unavailable.
    }
  }, [headers])

  const loadChats = useCallback(async () => {
    setLoadingChats(true)
    try {
      const res = await fetch(`${API_URL}/chats`, { headers })
      if (!res.ok) return
      const data = await res.json()
      setChats(data)
      if (!selectedThreadId && data.length > 0) {
        setSelectedThreadId(data[0].id)
      }
    } finally {
      setLoadingChats(false)
    }
  }, [headers, selectedThreadId])

  const loadThread = useCallback(async (threadId) => {
    if (!threadId) {
      setThread(null)
      return
    }

    const res = await fetch(`${API_URL}/chats/${threadId}`, { headers })
    if (!res.ok) return
    const data = await res.json()
    setThread(data)

    setExpandedRuns((current) => {
      if (Object.keys(current).length) return current
      return deriveExpandedRuns(data)
    })

    const defaultRunId = selectedRunId && data.runs.some((run) => run.id === selectedRunId)
      ? selectedRunId
      : data.latest_run_id
    setSelectedRunId(defaultRunId || null)
  }, [headers, selectedRunId])

  const loadRun = useCallback(async (runId) => {
    if (!runId) {
      setSelectedRun(null)
      return
    }

    const res = await fetch(`${API_URL}/runs/${runId}`, { headers })
    if (!res.ok) return
    const data = await res.json()
    setSelectedRun(data)
  }, [headers])

  useEffect(() => {
    loadModels()
    loadChats()
  }, [loadChats, loadModels])

  useEffect(() => {
    if (!selectedThreadId) {
      setThread(null)
      return
    }
    loadThread(selectedThreadId)
  }, [loadThread, selectedThreadId])

  useEffect(() => {
    loadRun(selectedRunId)
  }, [loadRun, selectedRunId])

  useEffect(() => {
    if (selectedRunId) {
      setShowContext(true)
    }
  }, [selectedRunId])

  useEffect(() => {
    if (!shouldPollThread || !selectedThreadId) return
    const id = setInterval(() => {
      loadThread(selectedThreadId)
      if (selectedRunId) loadRun(selectedRunId)
    }, 2000)
    return () => clearInterval(id)
  }, [loadRun, loadThread, selectedRunId, selectedThreadId, shouldPollThread])

  const handleCreateChat = async () => {
    const res = await fetch(`${API_URL}/chats`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    })
    if (!res.ok) return
    const data = await res.json()
    setChats((prev) => [data, ...prev])
    setSelectedThreadId(data.id)
    setThread({ id: data.id, title: data.title, updated_at: data.updated_at, latest_run_id: null, messages: [], runs: [] })
    setSelectedRunId(null)
    setSelectedRun(null)
    setExpandedRuns({})
    setShowSidebar(false)
  }

  const handleSelectChat = (threadId) => {
    setSelectedThreadId(threadId)
    setShowSidebar(false)
  }

  const handleSend = async (event, overrides = {}) => {
    event.preventDefault()
    const outgoingPrompt = overrides.prompt ?? prompt
    const displayMessage = overrides.displayMessage

    if (!outgoingPrompt.trim()) return
    if (!isPro && billing && billing.tries_remaining <= 0) {
      setShowUpgrade(true)
      return
    }

    let threadId = selectedThreadId
    if (!threadId) {
      const chatRes = await fetch(`${API_URL}/chats`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })
      if (!chatRes.ok) return
      const newChat = await chatRes.json()
      threadId = newChat.id
      setChats((prev) => [newChat, ...prev])
      setSelectedThreadId(threadId)
    }

    setSending(true)
    const res = await fetch(`${API_URL}/chats/${threadId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: outgoingPrompt,
        display_message: displayMessage,
        provider: selectedModel.providerId,
        model: selectedModel.modelId,
        quality_mode: selectedModel.qualityMode,
      }),
    })
    setSending(false)

    if (res.status === 429) {
      setShowUpgrade(true)
      return
    }
    if (!res.ok) {
      alert('Unable to submit the strategy right now.')
      return
    }

    const data = await res.json()
    setPrompt('')
    setSelectedThreadId(data.thread_id)
    setSelectedRunId(data.run_id)
    setExpandedRuns({ [data.run_id]: true })
    await loadChats()
    await loadThread(data.thread_id)
    await loadRun(data.run_id)
    await onRefreshBilling?.()
  }

  const handleOpenSafety = () => {
    if (!selectedRun?.parsed_strategy) return
    setSafetyData(selectedRun.parsed_strategy)
    setShowSafetyModal(true)
  }

  const handleSubmitSafety = async (jsonString) => {
    setShowSafetyModal(false)
    setSafetyData(null)

    const fakeEvent = { preventDefault() {} }
    await handleSend(fakeEvent, {
      prompt: jsonString,
      displayMessage: 'Adjusted safety parameters and retried the strategy.',
    })
  }

  const handleBilling = async () => {
    if (billing?.has_portal) {
      await onOpenBillingPortal()
    } else {
      setShowUpgrade(true)
    }
  }

  const handleCheckout = async () => {
    setCheckoutLoading(true)
    await onCheckout()
    setCheckoutLoading(false)
  }

  return (
    <div className="chat-workspace-page">
      <header className="chat-workspace-topnav">
        <div className="chat-workspace-topnav__left">
          <button type="button" className="chat-workspace-topnav__menu" onClick={() => setShowSidebar(true)}>
            Chats
          </button>
          <BrandLockup label="SmartTrade AI" />
        </div>
        <div className="chat-workspace-topnav__right">
          <span className={`chat-workspace-badge ${isPro ? 'pro' : ''}`}>
            {isPro ? 'PRO' : `${usedCount}/${usedMax} today`}
          </span>
          <button type="button" className="chat-workspace-topnav__ghost" onClick={handleBilling}>
            Billing
          </button>
          <button type="button" className="chat-workspace-topnav__ghost" onClick={() => setShowHelp(true)}>
            Help
          </button>
          <span className="chat-workspace-topnav__user">{username}</span>
          <button type="button" className="chat-workspace-topnav__ghost" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="chat-workspace-shell">
        <ChatSidebar
          chats={filteredChats}
          selectedThreadId={selectedThreadId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateChat={handleCreateChat}
          onSelectChat={handleSelectChat}
          mobileOpen={showSidebar}
          onCloseMobile={() => setShowSidebar(false)}
        />

        <main className="chat-workspace-main">
          <div className="chat-workspace-main__header">
            <div>
              <span className="chat-thread__kicker">Strategy conversation</span>
              <h1>{thread?.title || 'New strategy conversation'}</h1>
              <p>
                Keep one strategy topic in this thread, refine it through follow-up prompts,
                and inspect each run in the right-side tabs.
              </p>
            </div>
            <button type="button" className="chat-workspace-main__drawer" onClick={() => setShowContext((current) => !current)}>
              <PanelRightIcon />
              <span>{showContext ? 'Hide panel' : 'Show panel'}</span>
            </button>
          </div>

          {loadingChats && !thread ? (
            <div className="chat-workspace-empty-state">
              <p>Loading your recent strategy chats...</p>
            </div>
          ) : (
            <ChatThreadView
              thread={thread}
              runsById={runsById}
              selectedRunId={selectedRunId}
              runDetail={selectedRun}
              expandedRuns={expandedRuns}
              onSelectRun={setSelectedRunId}
              onToggleRunExpand={(runId) =>
                setExpandedRuns((current) => ({
                  ...current,
                  [runId]: !current[runId],
                }))
              }
              onUseExample={setPrompt}
              onOpenSafetyModal={handleOpenSafety}
            />
          )}

          <ChatComposer
            prompt={prompt}
            onPromptChange={setPrompt}
            onSubmit={handleSend}
            loading={sending}
            modelLabel={selectedModelLabel}
            onOpenModelPicker={() => setShowModelPicker(true)}
          />
        </main>

        <ContextDrawer
          open={showContext}
          onToggle={() => setShowContext((current) => !current)}
          selectedRun={selectedRun}
          token={token}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      <ModelCatalogModal
        open={showModelPicker}
        catalog={catalog}
        selectedModel={selectedModel}
        onClose={() => setShowModelPicker(false)}
        onSelect={(model) => {
          setSelectedModel(model)
          setShowModelPicker(false)
        }}
      />

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showUpgrade && (
        <UpgradeModal
          checkoutLoading={checkoutLoading}
          onClose={() => setShowUpgrade(false)}
          onCheckout={handleCheckout}
        />
      )}
      <SafetyRecoveryModal
        open={showSafetyModal}
        initialData={safetyData}
        onClose={() => {
          setShowSafetyModal(false)
          setSafetyData(null)
        }}
        onSubmit={handleSubmitSafety}
      />
    </div>
  )
}

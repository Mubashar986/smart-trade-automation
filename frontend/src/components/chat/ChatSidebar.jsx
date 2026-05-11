import { MessageIcon, PlusIcon, SearchIcon } from '../../BrandSystem'

function formatUpdatedAt(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function ChatSidebar({
  chats,
  selectedThreadId,
  searchQuery,
  onSearchChange,
  onCreateChat,
  onSelectChat,
  mobileOpen,
  onCloseMobile,
}) {
  return (
    <>
      {mobileOpen && <button type="button" className="chat-sidebar__backdrop" onClick={onCloseMobile} />}
      <aside className={`chat-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="chat-sidebar__top">
          <span className="chat-sidebar__section-title">Chats</span>
          <button type="button" className="chat-sidebar__new" onClick={onCreateChat}>
            <PlusIcon />
            <span>New chat</span>
          </button>
        </div>

        <label className="chat-sidebar__search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search chats"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>

        <div className="chat-sidebar__section">
          <span className="chat-sidebar__section-title">Recent chats</span>
          <div className="chat-sidebar__list">
            {chats.length === 0 ? (
              <div className="chat-sidebar__empty">
                <p>No chats yet.</p>
                <small>Create a new chat to start your first strategy conversation.</small>
              </div>
            ) : (
              chats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  className={`chat-sidebar__item ${selectedThreadId === chat.id ? 'active' : ''}`}
                  onClick={() => onSelectChat(chat.id)}
                >
                  <span className="chat-sidebar__item-icon">
                    <MessageIcon />
                  </span>
                  <span className="chat-sidebar__item-copy">
                    <strong>{chat.title}</strong>
                    <small>Updated {formatUpdatedAt(chat.updated_at)}</small>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

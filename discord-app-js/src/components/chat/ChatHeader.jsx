import { memo } from 'react';

function ChatHeader({
  isDm,
  targetName,
  channel,
  conversation,
  onBack,
  onToggleVoiceCall,
  isVoiceCallActive,
  voiceCallPhase,
}) {
  return (
    <header className="chat-area__header">
      <div className="chat-area__header-info">
        {isDm && onBack && (
          <button
            type="button"
            className="chat-area__header-back-btn"
            onClick={onBack}
            title="Geri"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
        )}
        <span className="chat-area__header-hash">{isDm ? '@' : '#'}</span>
        <h2 className="chat-area__header-name">{targetName}</h2>
        {!isDm && (
          <>
            <div className="chat-area__header-divider" />
            <p className="chat-area__header-topic">
              {channel.description || `Welcome to #${channel.name}`}
            </p>
          </>
        )}
      </div>

      {isDm && onToggleVoiceCall && (
        <div className="chat-area__header-actions">
          <button
            type="button"
            className={`chat-area__call-btn ${isVoiceCallActive ? 'chat-area__call-btn--active' : ''}`}
            onClick={() => onToggleVoiceCall(conversation)}
            title={isVoiceCallActive ? 'Görüşmeyi bitir' : 'Sesli arama başlat'}
          >
            <span className="material-symbols-outlined">
              {isVoiceCallActive ? 'call_end' : 'call'}
            </span>
            <span className="chat-area__call-btn-label">
              {isVoiceCallActive
                ? 'Bitir'
                : ['starting', 'ringing'].includes(voiceCallPhase)
                  ? 'Aranıyor...'
                  : 'Sesli Ara'}
            </span>
          </button>
        </div>
      )}
    </header>
  );
}

export default memo(ChatHeader);

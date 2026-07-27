import { memo } from 'react';
import { COMMON_EMOJIS } from '../../utils/constants';

function EmojiPicker({ onClose, onSelect }) {
  return (
    <div className="chat-area__emoji-picker">
      <div className="chat-area__emoji-picker-header">
        <span className="material-symbols-outlined chat-area__emoji-picker-icon">
          sentiment_satisfied
        </span>
        <span className="chat-area__emoji-picker-title">Emoji Seç</span>
        <button type="button" className="chat-area__emoji-picker-close" onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="chat-area__emoji-picker-grid">
        {COMMON_EMOJIS.map((emoji, index) => (
          <button
            key={index}
            type="button"
            className="chat-area__emoji-item"
            onClick={() => onSelect(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function GifPicker({ search, onSearch, onClose, loading, gifs, onSelect }) {
  return (
    <div className="chat-area__gif-picker">
      <div className="chat-area__gif-picker-header">
        <span className="material-symbols-outlined chat-area__gif-picker-icon">gif_box</span>
        <input
          className="chat-area__gif-picker-search"
          type="text"
          placeholder="GIF ara..."
          value={search}
          onChange={onSearch}
          autoFocus
        />
        <button type="button" className="chat-area__gif-picker-close" onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="chat-area__gif-picker-grid">
        {loading ? (
          <div className="chat-area__gif-picker-loading">
            <div className="chat-area__loading-spinner chat-area__loading-spinner--small" />
          </div>
        ) : gifs.length === 0 ? (
          <p className="chat-area__gif-picker-empty">GIF bulunamadı.</p>
        ) : (
          gifs.map((gif) => (
            <button
              key={gif.id}
              type="button"
              className="chat-area__gif-item"
              onClick={() => onSelect(gif)}
              title={gif.title}
            >
              <img
                src={gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url}
                alt={gif.title}
                loading="lazy"
              />
            </button>
          ))
        )}
      </div>
      <div className="chat-area__gif-picker-footer">Powered by Tenor</div>
    </div>
  );
}

function ChatComposer({
  showEmojiPicker,
  onCloseEmojiPicker,
  onSelectEmoji,
  showGifPicker,
  gifSearch,
  onGifSearch,
  onCloseGifPicker,
  gifLoading,
  gifs,
  onSelectGif,
  onSubmit,
  fileInputRef,
  onFileChange,
  onFileUploadClick,
  isUploading,
  composerRef,
  placeholder,
  value,
  onChange,
  onKeyDown,
  onToggleGifPicker,
  onToggleEmojiPicker,
}) {
  return (
    <div className="chat-area__input-wrapper">
      {showEmojiPicker && (
        <EmojiPicker onClose={onCloseEmojiPicker} onSelect={onSelectEmoji} />
      )}

      {showGifPicker && (
        <GifPicker
          search={gifSearch}
          onSearch={onGifSearch}
          onClose={onCloseGifPicker}
          loading={gifLoading}
          gifs={gifs}
          onSelect={onSelectGif}
        />
      )}

      <form className="chat-area__input-bar" onSubmit={onSubmit}>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          multiple
          onChange={onFileChange}
        />
        <button
          type="button"
          className="chat-area__input-action-btn"
          title="Dosya Ekle"
          onClick={onFileUploadClick}
          disabled={isUploading}
        >
          {isUploading ? (
            <div
              className="chat-area__loading-spinner chat-area__loading-spinner--small"
              style={{ width: '20px', height: '20px' }}
            />
          ) : (
            <span className="material-symbols-outlined">add_circle</span>
          )}
        </button>

        <textarea
          ref={composerRef}
          className="chat-area__input"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
        />
        <div className="chat-area__input-actions">
          <button
            type="button"
            className={`chat-area__input-action-btn${showGifPicker ? ' chat-area__input-action-btn--active' : ''}`}
            title="GIF"
            onClick={onToggleGifPicker}
          >
            <span className="material-symbols-outlined">gif_box</span>
          </button>
          <button
            type="button"
            className={`chat-area__input-action-btn${showEmojiPicker ? ' chat-area__input-action-btn--active' : ''}`}
            title="Emoji"
            onClick={onToggleEmojiPicker}
          >
            <span className="material-symbols-outlined">sentiment_satisfied</span>
          </button>
          <button type="submit" className="chat-area__input-action-btn" title="Gönder">
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default memo(ChatComposer);

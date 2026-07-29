import { memo } from 'react';

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;
const IMAGE_PATTERN = /\.(jpeg|jpg|gif|png|webp)(?:[?#].*)?$/;
const VIDEO_PATTERN = /\.(mp4|webm|ogg)(?:[?#].*)?$/;

function getYouTubeVideoId(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const candidate = host === 'youtu.be'
      ? parsed.pathname.slice(1).split('/')[0]
      : host === 'youtube.com' && parsed.pathname === '/watch'
        ? parsed.searchParams.get('v')
        : null;
    return /^[A-Za-z0-9_-]{11}$/.test(candidate || '') ? candidate : null;
  } catch {
    return null;
  }
}

function MessageContent({ content }) {
  if (!content) return null;

  return content.split(URL_PATTERN).map((part, index) => {
    if (!part.match(URL_PATTERN)) {
      return <span key={index}>{part}</span>;
    }

    const url = part;
    const lowerUrl = url.toLowerCase();

    if (IMAGE_PATTERN.test(lowerUrl) || lowerUrl.includes('imgur.com')) {
      return (
        <div key={index} className="chat-area__media-preview">
          <img src={url} alt="attachment" className="chat-area__preview-img" loading="lazy" />
        </div>
      );
    }

    if (VIDEO_PATTERN.test(lowerUrl)) {
      return (
        <div key={index} className="chat-area__media-preview">
          <video src={url} controls className="chat-area__preview-video" preload="metadata" />
        </div>
      );
    }

    const youtubeVideoId = getYouTubeVideoId(url);
    if (youtubeVideoId) {
      return (
        <div key={index} className="chat-area__media-preview">
          <iframe
            className="chat-area__preview-youtube"
            src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}`}
            title="YouTube video player"
            frameBorder="0"
            allow="encrypted-media; picture-in-picture; fullscreen"
            loading="lazy"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            allowFullScreen
          />
        </div>
      );
    }

    return (
      <a
        key={index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="chat-area__message-link"
      >
        {url}
      </a>
    );
  });
}

export default memo(MessageContent);

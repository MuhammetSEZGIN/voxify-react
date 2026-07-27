import { memo } from 'react';

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;
const IMAGE_PATTERN = /\.(jpeg|jpg|gif|png|webp)$/;
const VIDEO_PATTERN = /\.(mp4|webm|ogg)$/;
const YOUTUBE_PATTERN = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^& \n]+)/;

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

    const youtubeMatch = url.match(YOUTUBE_PATTERN);
    if (youtubeMatch) {
      return (
        <div key={index} className="chat-area__media-preview">
          <iframe
            className="chat-area__preview-youtube"
            src={`https://www.youtube.com/embed/${youtubeMatch[1]}`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
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

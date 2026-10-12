import { Icon } from '../Icon'

/**
 * The topic's video. Only ever an iframe of the validated embed URL the API returns
 * (YouTube/Vimeo), never arbitrary HTML, and never autoplaying. Topics without a video get a
 * compact note instead of an empty player. Give it key={topic.id} so a topic switch reloads it.
 */
export function TopicPlayer({ topic }) {
  if (!topic.videoEmbedUrl) {
    return (
      <div className="learn-player learn-player--empty">
        <span className="learn-player__empty-icon" aria-hidden="true">
          <Icon name="videoOff" size={22} />
        </span>
        <div>
          <p className="learn-player__empty-title">No video for this topic</p>
          <p className="learn-player__empty-text">Read the notes below, then mark the topic complete when you are done.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="learn-player">
      <iframe
        src={topic.videoEmbedUrl}
        title={`Video: ${topic.title}`}
        loading="lazy"
        allow="fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}

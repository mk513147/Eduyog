export function ProgressBar({ progress, label = 'Course progress', size = 'md' }) {
  const { percent, completedTopics, totalTopics } = progress
  return (
    <div className={`progress progress--${size}`}>
      <div className="progress__header">
        <span className="progress__label">{label}</span>
        <span className="progress__value">{percent}%</span>
      </div>
      <div
        className="progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}%, ${completedTopics} of ${totalTopics} topics completed`}
      >
        <div className="progress__fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="progress__meta">
        {completedTopics} of {totalTopics} topics completed
      </span>
    </div>
  )
}

import { Component } from 'react'

// Shown if a lazy-loaded page cannot be fetched (offline, a deploy replaced the chunk) or throws
// while rendering, instead of leaving a blank screen.
export class RouteBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="eduyog-route-message" role="alert">
        <p>This page could not be loaded.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    )
  }
}

export function RouteLoading() {
  return (
    <div className="eduyog-route-message" role="status">
      Loading…
    </div>
  )
}

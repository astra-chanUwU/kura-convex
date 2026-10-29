import { Component, type ReactNode } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import styles from './App.module.css'

type AppProps = {
  url: string
}

export default function App({ url }: AppProps) {
  return (
    <main className={styles.shell}>
      <p className={styles.eyebrow}>Kura Convex</p>
      <h1>Self-hosted Convex on this machine.</h1>
      <p className={styles.lede}>
        The app and the backend both run here. This page calls{' '}
        <code>site.status</code>.
      </p>
      {url ? (
        <ErrorBoundary>
          <Status url={url} />
        </ErrorBoundary>
      ) : (
        <section className={styles.card}>
          <h2>No Convex URL</h2>
          <p>
            Start <code>pnpm dev</code>.
          </p>
        </section>
      )}
    </main>
  )
}

function Status({ url }: { url: string }) {
  const status = useQuery(api.site.status)

  return (
    <section className={styles.card}>
      <h2>{status ? status.name : 'Connecting'}</h2>
      <dl>
        <div>
          <dt>Backend</dt>
          <dd>
            <code>{url}</code>
          </dd>
        </div>
        <div>
          <dt>Query</dt>
          <dd>
            {status
              ? status.ok
                ? 'site.status ok'
                : 'site.status failed'
              : 'Waiting for site.status'}
          </dd>
        </div>
      </dl>
    </section>
  )
}

type BoundaryProps = {
  children: ReactNode
}

type BoundaryState = {
  message: string | null
}

class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { message: null }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return {
      message: error instanceof Error ? error.message : 'The Convex query failed.',
    }
  }

  render() {
    if (this.state.message) {
      return (
        <section className={styles.card}>
          <h2>Could not reach Convex</h2>
          <p>{this.state.message}</p>
        </section>
      )
    }
    return this.props.children
  }
}

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
      <h1>Both backends run on this machine.</h1>
      <p className={styles.lede}>
        Local dev and the self-hosted Convex backend are separate deployments.
        This page is talking to whichever one the dev command started.
      </p>
      {url ? (
        <ErrorBoundary>
          <Status url={url} />
        </ErrorBoundary>
      ) : (
        <section className={styles.card}>
          <h2>No Convex URL</h2>
          <p>
            Start <code>pnpm dev</code> for the local backend, or{' '}
            <code>pnpm dev:self-hosted</code> for the Docker backend.
          </p>
        </section>
      )}
    </main>
  )
}

function Status({ url }: { url: string }) {
  const status = useQuery(api.site.status)
  const deployment = deploymentLabel(url)

  return (
    <section className={styles.card}>
      <h2>{status ? status.name : 'Connecting'}</h2>
      <dl>
        <div>
          <dt>Deployment</dt>
          <dd>{deployment}</dd>
        </div>
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

function deploymentLabel(url: string) {
  if (url.includes(':3210')) return 'Local dev'
  if (url.includes(':3220')) return 'Self-hosted'
  return 'Custom'
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

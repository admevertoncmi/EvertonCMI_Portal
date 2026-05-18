import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

let globalBrowserQueryClient: QueryClient | undefined = undefined

export const browserQueryClient = () => globalBrowserQueryClient!

export function Providers({ children }: {
  children: React.ReactNode
}) {
  if (typeof window === 'undefined') {
    // Server - create new each time
    const queryClient = new QueryClient()
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  } else {
    // Client - singleton
    if (!globalBrowserQueryClient) {
      globalBrowserQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
    }
    return (
      <QueryClientProvider client={globalBrowserQueryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

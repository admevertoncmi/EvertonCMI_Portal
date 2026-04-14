import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

let browserQueryClient: QueryClient | undefined = undefined

export const browserQueryClient = () => browserQueryClient!

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
    if (!browserQueryClient) {
      browserQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
    }
    return (
      <QueryClientProvider client={browserQueryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}



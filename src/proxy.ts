import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Configuração padrão do Supabase SSR para Middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Define as rotas que estamos protegendo
  const isAdminDashboard = request.nextUrl.pathname.startsWith('/admin/dashboard')
  const isEditorRoute = request.nextUrl.pathname.startsWith('/editor')

  // 1. Não está logado e tentou acessar área restrita? Chuta pro login.
  if (!user && (isAdminDashboard || isEditorRoute)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 2. Está logado? Verifica as permissões baseadas no Metadata.
  if (user) {
    const role = user.user_metadata?.role || 'editor'
    const isAdmin = role === 'admin'
    const isEditor = role === 'editor'
    const isDesigner = role === 'designer' // 🔥 O Segurança agora conhece o Designer!

    // Se tentar acessar o Admin e NÃO for Admin, joga pro Editor
    if (isAdminDashboard && !isAdmin) {
      return NextResponse.redirect(new URL('/editor', request.url))
    }

    // Se tentar acessar o Editor e não tiver permissão
    // 🔥 Agora o Designer também tem permissão para entrar na rota /editor
    if (isEditorRoute && !isEditor && !isDesigner && !isAdmin) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

// O Middleware só vai agir nessas rotas específicas:
export const config = {
  matcher: [
    '/admin/dashboard/:path*', 
    '/editor/:path*'
  ],
}
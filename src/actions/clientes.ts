'use server'

import { requireEquipe } from '@/lib/auth-guard'
import { comTipoCerto } from '@/lib/preparar-imagem'

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function cadastrarClienteComLogo(formData: FormData) {
  await requireEquipe()
  const nome = formData.get('nome') as string
  const telefone = formData.get('telefone') as string
  const wpp_suporte = formData.get('wpp_suporte') as string 
  const cor_marca = formData.get('cor_marca') as string || '#1e3a5f' // 👈 Captura a Cor
  const logoFile = formData.get('logo') as File
  
  let logoUrl = null

  if (logoFile && logoFile.size > 0) {
    const fileExt = logoFile.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `logos/${fileName}`

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('logos')
      .upload(filePath, logoFile)

    if (uploadError) throw new Error("Erro no upload da logo")

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('logos')
      .getPublicUrl(filePath)
    
    logoUrl = publicUrl
  }

  const { error } = await supabaseAdmin.from('clientes').insert([{
    nome,
    telefone,
    wpp_suporte,
    cor_marca, // 👈 Insere no banco
    logo_url: logoUrl,
    token_magico: crypto.randomUUID()
  }])

  if (error) throw error
  return { success: true }
}

// 👇 Atualiza para aceitar a cor e id do whatsapp
export async function editarCliente(id: string, dados: { nome: string, telefone: string, wpp_suporte?: string, cor_marca?: string, whatsapp_group_id?: string }) {
  await requireEquipe()
  const { error } = await supabaseAdmin.from('clientes').update(dados).eq('id', id)
  if (error) throw error
}

export async function cadastrarClienteCompleto(formData: FormData) {
  await requireEquipe()
  const nome = formData.get('nome') as string
  const telefone = formData.get('telefone') as string
  const wpp_suporte = formData.get('wpp_suporte') as string
  const cor_marca = formData.get('cor_marca') as string || '#1e3a5f'
  const whatsapp_group_id = formData.get('whatsapp_group_id') as string
  const logoFile = formData.get('logo') as File
  
  let logoUrl = null
  let aviso: string | undefined

  // Logo com tipo sempre válido (o bucket só aceita imagens e o celular às vezes manda sem tipo).
  // Se o logo falhar, o cliente é cadastrado do mesmo jeito e a tela avisa o motivo.
  if (logoFile && logoFile.size > 0) {
    const logo = comTipoCerto(logoFile)
    const fileName = `${Math.random().toString(36).slice(2)}.${logo.ext}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from('logos')
      .upload(fileName, logo.blob, { contentType: logo.type })

    if (uploadError) {
      aviso = `O logo não foi enviado: ${/size|exceed/i.test(uploadError.message) ? 'o arquivo passa de 5 MB' : /mime/i.test(uploadError.message) ? 'use PNG, JPG, WEBP, SVG ou GIF' : uploadError.message}`
    } else {
      logoUrl = supabaseAdmin.storage.from('logos').getPublicUrl(fileName).data.publicUrl
    }
  }

  const { error } = await supabaseAdmin.from('clientes').insert([
    { nome, telefone, wpp_suporte, cor_marca, whatsapp_group_id, logo_url: logoUrl, token_magico: crypto.randomUUID() } 
  ])

  if (error) throw error
  return { success: true, aviso }
}

export async function registrarLog(materialId: string, acao: string, detalhes: string, email?: string) {
  await requireEquipe()
  await supabaseAdmin.from('logs_material').insert([
    { material_id: materialId, acao, detalhes, usuario_email: email || 'Sistema' }
  ])
}
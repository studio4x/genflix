import { supabase } from '@/services/supabase/client'
// @ts-ignore - html2pdf doesn't have official types easily available
import html2pdf from 'html2pdf.js'

export async function exportModuleToPdf(courseTitle: string, moduleTitle: string, moduleId: string) {
  // Buscar os dados mais recentes das aulas diretamente do banco para garantir que o texto completo esteja lá
  const { data: latestLessons, error: lError } = await supabase
    .from('lessons')
    .select('*')
    .eq('module_id', moduleId)
    .order('position', { ascending: true })

  if (lError) throw lError
  const lessons = latestLessons || []

  // Criar o container temporário para o PDF
  const element = document.createElement('div')
  element.className = 'pdf-export-container'
  element.style.padding = '40px'
  element.style.background = '#ffffff'
  element.style.color = '#1e293b'
  element.style.fontFamily = 'Arial, sans-serif'

  // Cabeçalho Premium
  const headerHtml = `
    <div style="border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 40px; text-align: left;">
       <h4 style="color: #2563eb; font-size: 14px; font-weight: 800; text-transform: uppercase; margin: 0; letter-spacing: 2px;">HomeCare Match Academy</h4>
       <h1 style="font-size: 32px; font-weight: 900; color: #0f172a; margin: 10px 0 5px 0;">${courseTitle}</h1>
       <div style="display: flex; align-items: center; gap: 10px; margin-top: 15px;">
          <span style="background: #eff6ff; color: #2563eb; padding: 6px 14px; border-radius: 99px; font-size: 12px; font-weight: 900; text-transform: uppercase;">Módulo: ${moduleTitle}</span>
          <span style="color: #64748b; font-size: 12px; font-weight: 500;">Material de Apoio Digital • ${new Date().toLocaleDateString('pt-BR')}</span>
       </div>
    </div>
  `

  let contentHtml = ''
  
  // Processar Aulas
  for (const lesson of lessons) {
    contentHtml += `
      <div style="margin-bottom: 50px; page-break-inside: avoid;">
         <h2 style="font-size: 22px; font-weight: 800; color: #1e293b; border-left: 6px solid #2563eb; padding-left: 20px; margin-bottom: 25px;">${lesson.title}</h2>
         <div class="pdf-content" style="font-size: 15px; line-height: 1.8; color: #334155;">
            ${lesson.text_content || '<p>Conteúdo em vídeo ou material complementar.</p>'}
         </div>
      </div>
    `
  }

  // Rodapé
  const footerHtml = `
    <div style="margin-top: 80px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; font-weight: bold;">
       © ${new Date().getFullYear()} HomeCare Match. Todos os direitos reservados. 
       <br/>Reprodução proibida para fins comerciais.
    </div>
  `

  element.innerHTML = headerHtml + contentHtml + footerHtml

  // Estilos globais específicos para o PDF (para tabelas e listas vindo do Quill)
  const style = document.createElement('style')
  style.innerHTML = `
    .pdf-content h1, .pdf-content h2, .pdf-content h3 { color: #1e293b; margin-top: 25px; margin-bottom: 15px; }
    .pdf-content p { margin-bottom: 15px; }
    .pdf-content ul, .pdf-content ol { margin-bottom: 20px; padding-left: 25px; }
    .pdf-content li { margin-bottom: 8px; }
    .pdf-content table { width: 100%; border-collapse: collapse; margin: 25px 0; font-size: 13px; }
    .pdf-content th { background: #f8fafc; text-align: left; padding: 12px; border-bottom: 2px solid #e2e8f0; font-weight: 900; color: #2563eb; }
    .pdf-content td { padding: 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    .pdf-content tr:nth-child(even) { background: #fcfcfd; }
    .pdf-content b, .pdf-content strong { color: #0f172a; font-weight: 800; }
  `
  element.appendChild(style)

  const opt = {
    margin: 20,
    filename: `Material_${moduleTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
  }

  try {
    await (html2pdf() as any).set(opt).from(element).save()
  } catch (error) {
    console.error('Erro ao gerar PDF:', error)
    throw error
  }
}

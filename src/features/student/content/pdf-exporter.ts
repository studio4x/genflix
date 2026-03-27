import homeCareMatchLogoUrl from '@/assets/homecare-match-logo.jpg'
import { supabase } from '@/services/supabase/client'
// @ts-ignore - html2pdf doesn't have official types easily available
import html2pdf from 'html2pdf.js'

const PDF_FILENAME_PREFIX = 'Material'
const DEFAULT_LESSON_CONTENT = '<p>Conteúdo em vídeo ou material complementar.</p>'
const FOOTER_NOTICE =
  'Proibida a divulgação, reprodução ou compartilhamento deste material com terceiros sem autorização expressa da HomeCare Match.'

type LessonRow = {
  id: string
  title: string
  text_content: string | null
  youtube_url: string | null
  estimated_minutes: number | null
  position: number
}

type ModuleRow = {
  title: string
  description: string | null
  position: number
}

type PreparedImage = {
  dataUrl: string
  width: number
  height: number
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, totalMinutes)
  const hours = Math.floor(safeMinutes / 60)
  const remainingMinutes = safeMinutes % 60

  if (hours === 0) {
    return `${remainingMinutes} min`
  }

  if (remainingMinutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${remainingMinutes}min`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function buildLessonSupportInfo(lesson: LessonRow) {
  const items: string[] = []

  if (lesson.estimated_minutes) {
    items.push(`<span><strong>Duração estimada:</strong> ${lesson.estimated_minutes} min</span>`)
  }

  if (lesson.youtube_url) {
    const safeUrl = escapeHtml(lesson.youtube_url)
    items.push(
      `<span><strong>Vídeo complementar:</strong> <a href="${safeUrl}" target="_blank" rel="noreferrer">${safeUrl}</a></span>`,
    )
  }

  if (items.length === 0) {
    return ''
  }

  return `<div class="pdf-lesson-support">${items.join('')}</div>`
}

function buildCoverHtml(courseTitle: string, module: ModuleRow, lessons: LessonRow[], exportDate: string) {
  const totalMinutes = lessons.reduce((sum, lesson) => sum + (lesson.estimated_minutes ?? 0), 0)

  return `
    <section class="pdf-cover">
      <div class="pdf-cover-inner">
        <div class="pdf-cover-eyebrow">Material oficial do aluno</div>
        <h1>${escapeHtml(module.title)}</h1>
        <p class="pdf-cover-course">${escapeHtml(courseTitle)}</p>
        ${module.description ? `<p class="pdf-cover-description">${escapeHtml(module.description)}</p>` : ''}

        <div class="pdf-cover-grid">
          <div class="pdf-cover-card">
            <span class="pdf-cover-card-label">Módulo</span>
            <strong>${module.position}</strong>
          </div>
          <div class="pdf-cover-card">
            <span class="pdf-cover-card-label">Aulas</span>
            <strong>${lessons.length}</strong>
          </div>
          <div class="pdf-cover-card">
            <span class="pdf-cover-card-label">Carga estimada</span>
            <strong>${formatMinutes(totalMinutes)}</strong>
          </div>
          <div class="pdf-cover-card">
            <span class="pdf-cover-card-label">Emissão</span>
            <strong>${escapeHtml(exportDate)}</strong>
          </div>
        </div>

        <div class="pdf-cover-notice">
          Este material foi preparado para leitura estruturada, com paginação dedicada por aula e preservação dos elementos técnicos do conteúdo.
        </div>
      </div>
    </section>
  `
}

function buildLessonHtml(lesson: LessonRow, index: number, totalLessons: number) {
  return `
    <section class="pdf-lesson">
      <div class="pdf-lesson-header">
        <div class="pdf-lesson-kicker">Aula ${index + 1} de ${totalLessons}</div>
        <h2>${escapeHtml(lesson.title)}</h2>
        ${buildLessonSupportInfo(lesson)}
      </div>
      <div class="pdf-content">
        ${lesson.text_content || DEFAULT_LESSON_CONTENT}
      </div>
    </section>
  `
}

function attachTableWrappers(root: HTMLElement) {
  root.querySelectorAll('table').forEach((table) => {
    const parent = table.parentElement
    if (!parent || parent.classList.contains('pdf-table-block')) {
      return
    }

    const wrapper = document.createElement('div')
    wrapper.className = 'pdf-table-block'
    parent.insertBefore(wrapper, table)
    wrapper.appendChild(table)
  })
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Não foi possível carregar o logotipo da marca d\'água.'))
    image.src = url
  })
}

async function createTransparentImage(url: string, opacity: number): Promise<PreparedImage> {
  const image = await loadImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Não foi possível preparar a marca d\'água do PDF.')
  }

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.globalAlpha = opacity
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
  }
}

function fitImageWithin(
  imageWidth: number,
  imageHeight: number,
  maxWidth: number,
  maxHeight: number,
) {
  const ratio = Math.min(maxWidth / imageWidth, maxHeight / imageHeight)

  return {
    width: imageWidth * ratio,
    height: imageHeight * ratio,
  }
}

function applyPdfFinishing(pdf: any, watermark: PreparedImage) {
  const totalPages = pdf.internal.getNumberOfPages()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const watermarkBounds = fitImageWithin(
    watermark.width,
    watermark.height,
    pageWidth * 0.58,
    pageHeight * 0.34,
  )
  const watermarkX = (pageWidth - watermarkBounds.width) / 2
  const watermarkY = (pageHeight - watermarkBounds.height) / 2 - 8

  const legalLines = pdf.splitTextToSize(FOOTER_NOTICE, pageWidth - 50)

  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page)
    pdf.addImage(
      watermark.dataUrl,
      'PNG',
      watermarkX,
      watermarkY,
      watermarkBounds.width,
      watermarkBounds.height,
      undefined,
      'FAST',
    )

    pdf.setDrawColor(226, 232, 240)
    pdf.setLineWidth(0.25)
    pdf.line(12, pageHeight - 16, pageWidth - 12, pageHeight - 16)

    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(100, 116, 139)
    pdf.setFontSize(8)
    pdf.text(`pagina ${page} de ${totalPages}`, pageWidth - 12, pageHeight - 11.5, { align: 'right' })

    pdf.setFontSize(6.8)
    pdf.text(legalLines, pageWidth / 2, pageHeight - 7.2, { align: 'center' })
  }
}

function buildPdfStyles() {
  const style = document.createElement('style')
  style.innerHTML = `
    .pdf-export-container {
      width: 186mm;
      margin: 0 auto;
      background: #ffffff;
      color: #0f172a;
      font-family: Arial, sans-serif;
      box-sizing: border-box;
    }
    .pdf-cover,
    .pdf-lesson {
      position: relative;
      box-sizing: border-box;
      padding: 0 0 18mm 0;
      orphans: 3;
      widows: 3;
    }
    .pdf-cover {
      min-height: 255mm;
      display: flex;
      align-items: center;
      justify-content: center;
      page-break-after: always;
      break-after: page;
    }
    .pdf-cover-inner {
      border: 1px solid #dbeafe;
      border-radius: 18px;
      padding: 24mm 16mm;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
      box-shadow: 0 10px 35px rgba(15, 23, 42, 0.06);
    }
    .pdf-cover-eyebrow {
      display: inline-block;
      margin-bottom: 16px;
      padding: 7px 12px;
      border-radius: 999px;
      background: #eff6ff;
      color: #2563eb;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .pdf-cover h1 {
      margin: 0;
      font-size: 29px;
      line-height: 1.15;
      font-weight: 900;
      color: #0f172a;
    }
    .pdf-cover-course {
      margin: 12px 0 0 0;
      font-size: 16px;
      line-height: 1.5;
      color: #1d4ed8;
      font-weight: 700;
    }
    .pdf-cover-description {
      margin: 18px 0 0 0;
      font-size: 13px;
      line-height: 1.75;
      color: #475569;
    }
    .pdf-cover-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-top: 28px;
    }
    .pdf-cover-card {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 14px 16px;
      background: #ffffff;
    }
    .pdf-cover-card-label {
      display: block;
      margin-bottom: 6px;
      font-size: 10px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 800;
    }
    .pdf-cover-card strong {
      font-size: 18px;
      color: #0f172a;
      font-weight: 900;
    }
    .pdf-cover-notice {
      margin-top: 24px;
      padding: 14px 16px;
      border-radius: 14px;
      background: #eff6ff;
      color: #334155;
      font-size: 11px;
      line-height: 1.7;
    }
    .pdf-lesson {
      page-break-before: always;
      break-before: page;
    }
    .pdf-lesson-header {
      margin-bottom: 18px;
      padding: 0 0 14px 0;
      border-bottom: 2px solid #e2e8f0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .pdf-lesson-kicker {
      display: inline-block;
      margin-bottom: 10px;
      padding: 6px 12px;
      border-radius: 999px;
      background: #0f172a;
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .pdf-lesson-header h2 {
      margin: 0;
      font-size: 22px;
      line-height: 1.25;
      font-weight: 900;
      color: #0f172a;
    }
    .pdf-lesson-support {
      display: flex;
      flex-wrap: wrap;
      gap: 12px 20px;
      margin-top: 14px;
      color: #475569;
      font-size: 11px;
      line-height: 1.7;
    }
    .pdf-lesson-support a {
      color: #2563eb;
      text-decoration: none;
      word-break: break-all;
    }
    .pdf-content {
      font-size: 13.5px;
      line-height: 1.8;
      color: #334155;
    }
    .pdf-content h1,
    .pdf-content h2,
    .pdf-content h3,
    .pdf-content h4 {
      color: #0f172a;
      margin-top: 18px;
      margin-bottom: 10px;
      page-break-after: avoid;
      break-after: avoid;
    }
    .pdf-content p,
    .pdf-content ul,
    .pdf-content ol,
    .pdf-content blockquote,
    .pdf-content pre {
      margin-bottom: 12px;
    }
    .pdf-content ul,
    .pdf-content ol {
      padding-left: 22px;
    }
    .pdf-content li {
      margin-bottom: 6px;
    }
    .pdf-content img,
    .pdf-content figure,
    .pdf-content blockquote,
    .pdf-content pre,
    .pdf-content .ql-code-block-container,
    .pdf-content .ql-video,
    .pdf-content h1,
    .pdf-content h2,
    .pdf-content h3,
    .pdf-content h4 {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .pdf-table-block {
      margin: 18px 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .pdf-content table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin: 0;
      font-size: 11.5px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .pdf-content thead {
      display: table-header-group;
    }
    .pdf-content tbody,
    .pdf-content tr,
    .pdf-content td,
    .pdf-content th {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .pdf-content th {
      padding: 10px;
      text-align: left;
      font-weight: 800;
      color: #1d4ed8;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
    }
    .pdf-content td {
      padding: 9px 10px;
      vertical-align: top;
      border: 1px solid #dbeafe;
      background: #ffffff;
      word-break: break-word;
    }
    .pdf-content tr:nth-child(even) td {
      background: #f8fbff;
    }
    .pdf-content a {
      color: #2563eb;
      text-decoration: none;
      word-break: break-word;
    }
    .pdf-content strong,
    .pdf-content b {
      color: #0f172a;
      font-weight: 800;
    }
  `

  return style
}

export async function exportModuleToPdf(courseTitle: string, moduleTitle: string, moduleId: string) {
  const [lessonsResult, moduleResult] = await Promise.all([
    supabase
      .from('lessons')
      .select('id, title, text_content, youtube_url, estimated_minutes, position')
      .eq('module_id', moduleId)
      .order('position', { ascending: true }),
    supabase
      .from('course_modules')
      .select('title, description, position')
      .eq('id', moduleId)
      .single(),
  ])

  if (lessonsResult.error) throw lessonsResult.error
  if (moduleResult.error) throw moduleResult.error

  const lessons = (lessonsResult.data as LessonRow[]) ?? []
  const module = (moduleResult.data as ModuleRow | null) ?? {
    title: moduleTitle,
    description: null,
    position: 1,
  }

  const exportDate = formatDate(new Date())
  const element = document.createElement('div')
  element.className = 'pdf-export-container'
  element.style.position = 'fixed'
  element.style.left = '-20000px'
  element.style.top = '0'
  element.style.zIndex = '-1'

  element.innerHTML = [
    buildCoverHtml(courseTitle, module, lessons, exportDate),
    ...lessons.map((lesson, index) => buildLessonHtml(lesson, index, lessons.length)),
  ].join('')

  const style = buildPdfStyles()
  element.appendChild(style)
  document.body.appendChild(element)

  element.querySelectorAll<HTMLElement>('.pdf-content').forEach(attachTableWrappers)

  const opt = {
    margin: [12, 12, 20, 12],
    filename: `${PDF_FILENAME_PREFIX}_${module.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      letterRendering: true,
      scrollY: 0,
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: {
      mode: ['css', 'legacy'],
      before: '.pdf-lesson',
      after: '.pdf-cover',
      avoid: '.pdf-table-block, table, tr, td, th, .pdf-lesson-header, h1, h2, h3, h4, ul, ol, blockquote, pre',
    },
  }

  try {
    const watermark = await createTransparentImage(homeCareMatchLogoUrl, 0.08)
    const worker = (html2pdf() as any).set(opt).from(element).toPdf()
    const pdf = await worker.get('pdf')

    applyPdfFinishing(pdf, watermark)
    await worker.save()
  } catch (error) {
    console.error('Erro ao gerar PDF:', error)
    throw error
  } finally {
    document.body.removeChild(element)
  }
}

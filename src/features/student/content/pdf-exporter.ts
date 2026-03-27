import homeCareMatchLogoUrl from '@/assets/homecare-match-logo.jpg'
import { supabase } from '@/services/supabase/client'
// @ts-ignore - html2pdf doesn't have official types easily available
import html2pdf from 'html2pdf.js'

const PDF_FILENAME_PREFIX = 'Material'
const MATERIALS_BUCKET = 'materials'
const MATERIAL_URL_TTL_SECONDS = 60 * 60 * 24 * 30
const DEFAULT_LESSON_CONTENT = '<p>Conte\u00fado em v\u00eddeo ou material complementar.</p>'
const FOOTER_NOTICE =
  'Proibida a divulga\u00e7\u00e3o, reprodu\u00e7\u00e3o ou compartilhamento deste material com terceiros sem autoriza\u00e7\u00e3o expressa da HomeCare Match.'

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

type LessonMaterialRow = {
  id: string
  lesson_id: string
  storage_path: string
  file_name: string
}

type LessonMaterialLink = {
  fileName: string
  signedUrl: string
}

type LessonForPdf = LessonRow & {
  materials: LessonMaterialLink[]
}

type PreparedImage = {
  dataUrl: string
  width: number
  height: number
}

type LicenseContext = {
  studentDisplayName: string
  userCode: string
  releaseCode: string
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

function getDisplayName(fullName: string | null | undefined, email: string | null | undefined) {
  if (fullName?.trim()) {
    return fullName.trim()
  }

  if (email?.trim()) {
    return email.split('@')[0]
  }

  return 'Aluno'
}

function buildMaterialsHtml(materials: LessonMaterialLink[]) {
  if (materials.length === 0) {
    return ''
  }

  const items = materials
    .map(
      (material) =>
        `<li><a href="${escapeHtml(material.signedUrl)}" target="_blank" rel="noreferrer">${escapeHtml(material.fileName)}</a></li>`,
    )
    .join('')

  return `
    <div class="pdf-lesson-materials">
      <strong>Materiais complementares para download</strong>
      <ul>${items}</ul>
    </div>
  `
}

function buildLessonSupportInfo(lesson: LessonForPdf) {
  const items: string[] = []

  if (lesson.estimated_minutes) {
    items.push(`<span><strong>Dura\u00e7\u00e3o estimada:</strong> ${lesson.estimated_minutes} min</span>`)
  }

  if (lesson.youtube_url) {
    const safeUrl = escapeHtml(lesson.youtube_url)
    items.push(
      `<span><strong>V\u00eddeo complementar:</strong> <a href="${safeUrl}" target="_blank" rel="noreferrer">${safeUrl}</a></span>`,
    )
  }

  const supportHtml = items.length > 0
    ? `<div class="pdf-lesson-support">${items.join('')}</div>`
    : ''

  return supportHtml + buildMaterialsHtml(lesson.materials)
}

function buildCoverHtml(courseTitle: string, module: ModuleRow, lessons: LessonForPdf[], exportDate: string) {
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
            <span class="pdf-cover-card-label">M\u00f3dulo</span>
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
            <span class="pdf-cover-card-label">Emiss\u00e3o</span>
            <strong>${escapeHtml(exportDate)}</strong>
          </div>
        </div>

        <div class="pdf-cover-notice">
          Este material foi preparado para leitura estruturada, com pagina\u00e7\u00e3o dedicada por aula e preserva\u00e7\u00e3o dos elementos t\u00e9cnicos do conte\u00fado.
        </div>
      </div>
    </section>
  `
}

function buildLessonHtml(lesson: LessonForPdf, index: number) {
  return `
    ${index > 0 ? '<div class="pdf-page-break" aria-hidden="true"></div>' : ''}
    <section class="pdf-lesson">
      <div class="pdf-lesson-header">
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
    image.onerror = () => reject(new Error('Nao foi possivel carregar o logotipo da marca dagua.'))
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
    throw new Error('Nao foi possivel preparar a marca dagua do PDF.')
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

function getFittedFontSize(pdf: any, text: string, maxWidth: number, preferredSize: number, minSize: number) {
  let currentSize = preferredSize

  while (currentSize > minSize) {
    pdf.setFontSize(currentSize)
    if (pdf.getTextWidth(text) <= maxWidth) {
      return currentSize
    }
    currentSize -= 0.2
  }

  return minSize
}

function truncateTextToWidth(pdf: any, text: string, maxWidth: number) {
  pdf.setFont('helvetica', 'normal')
  if (pdf.getTextWidth(text) <= maxWidth) {
    return text
  }

  let current = text
  while (current.length > 1) {
    const candidate = `${current.slice(0, -1)}...`
    if (pdf.getTextWidth(candidate) <= maxWidth) {
      return candidate
    }
    current = current.slice(0, -1)
  }

  return '...'
}

async function fetchLessonMaterialsMap(lessonIds: string[]) {
  if (lessonIds.length === 0) {
    return new Map<string, LessonMaterialLink[]>()
  }

  const materialsResult = await supabase
    .from('lesson_materials')
    .select('id, lesson_id, storage_path, file_name')
    .in('lesson_id', lessonIds)
    .order('created_at', { ascending: false })

  if (materialsResult.error) {
    throw materialsResult.error
  }

  const materials = (materialsResult.data as LessonMaterialRow[]) ?? []
  const signedMaterials = await Promise.all(
    materials.map(async (material) => {
      const signedResult = await supabase.storage
        .from(MATERIALS_BUCKET)
        .createSignedUrl(material.storage_path, MATERIAL_URL_TTL_SECONDS)

      if (signedResult.error) {
        throw signedResult.error
      }

      return {
        lessonId: material.lesson_id,
        material: {
          fileName: material.file_name,
          signedUrl: signedResult.data.signedUrl,
        },
      }
    }),
  )

  const materialsMap = new Map<string, LessonMaterialLink[]>()
  for (const item of signedMaterials) {
    const current = materialsMap.get(item.lessonId) ?? []
    current.push(item.material)
    materialsMap.set(item.lessonId, current)
  }

  return materialsMap
}

async function fetchLicenseContext(): Promise<LicenseContext> {
  const authResult = await supabase.auth.getUser()
  if (authResult.error) {
    throw authResult.error
  }

  const user = authResult.data.user
  if (!user) {
    return {
      studentDisplayName: 'Aluno',
      userCode: 'USUARIO',
      releaseCode: `HCM-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
    }
  }

  const profileResult = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle()

  if (profileResult.error) {
    throw profileResult.error
  }

  const profile = profileResult.data as { full_name: string | null; email: string | null } | null
  const userCode = user.id.slice(0, 8).toUpperCase()

  return {
    studentDisplayName: getDisplayName(profile?.full_name, profile?.email ?? user.email ?? null),
    userCode,
    releaseCode: `HCM-${userCode}-${crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`,
  }
}

function applyPdfFinishing(
  pdf: any,
  watermark: PreparedImage,
  courseTitle: string,
  licenseContext: LicenseContext,
) {
  const totalPages = pdf.internal.getNumberOfPages()
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const headerBottomY = 15
  const footerTopY = pageHeight - 16
  const headerCenterY = 8.2
  const footerPageNumberY = pageHeight - 8
  const footerCourseY = footerTopY + 4.2
  const footerNoticeY = footerTopY + 8.4

  const watermarkBounds = fitImageWithin(
    watermark.width,
    watermark.height,
    pageWidth * 0.58,
    pageHeight * 0.34,
  )
  const watermarkX = (pageWidth - watermarkBounds.width) / 2
  const watermarkY = (pageHeight - watermarkBounds.height) / 2 - 4

  const licenseText =
    `Este documento foi licenciado para ${licenseContext.studentDisplayName} - ${licenseContext.userCode} ` +
    `atraves da plataforma HomeCare Match - Academy. Codigo de liberacao: ${licenseContext.releaseCode}`

  let headerFontSize = 5.4
  let headerLines = pdf.splitTextToSize(licenseText, pageWidth - 28)
  while (headerLines.length > 2 && headerFontSize > 4.2) {
    headerFontSize -= 0.2
    pdf.setFontSize(headerFontSize)
    headerLines = pdf.splitTextToSize(licenseText, pageWidth - 28)
  }

  const headerLineHeight = 2.5
  const headerTextStartY = headerCenterY - ((headerLines.length - 1) * headerLineHeight) / 2

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
    pdf.line(12, headerBottomY, pageWidth - 12, headerBottomY)
    pdf.line(12, footerTopY, pageWidth - 12, footerTopY)

    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(100, 116, 139)
    pdf.setFontSize(headerFontSize)
    pdf.text(headerLines, pageWidth / 2, headerTextStartY, {
      align: 'center',
      baseline: 'middle',
    })

    pdf.setFontSize(5.6)
    const truncatedCourseTitle = truncateTextToWidth(pdf, courseTitle, pageWidth - 58)
    pdf.text(truncatedCourseTitle, 12, footerCourseY, {
      align: 'left',
      baseline: 'middle',
    })

    const footerLegalFontSize = getFittedFontSize(pdf, FOOTER_NOTICE, pageWidth - 58, 5.6, 4.2)
    pdf.setFontSize(footerLegalFontSize)
    pdf.text(FOOTER_NOTICE, 12, footerNoticeY, {
      align: 'left',
      baseline: 'middle',
    })

    pdf.setFontSize(6.8)
    pdf.text(`pagina ${page} de ${totalPages}`, pageWidth - 12, footerPageNumberY, {
      align: 'right',
      baseline: 'middle',
    })
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
      padding: 0 0 14mm 0;
      orphans: 3;
      widows: 3;
    }
    .pdf-page-break {
      height: 0;
      page-break-before: always;
      break-before: page;
    }
    .pdf-cover {
      min-height: 245mm;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pdf-cover-inner {
      border: 1px solid #dbeafe;
      border-radius: 18px;
      padding: 22mm 16mm;
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
    .pdf-lesson-header {
      margin-bottom: 18px;
      padding: 0 0 14px 0;
      border-bottom: 2px solid #e2e8f0;
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
    .pdf-lesson-support a,
    .pdf-lesson-materials a {
      color: #2563eb;
      text-decoration: none;
      word-break: break-all;
    }
    .pdf-lesson-materials {
      margin-top: 14px;
      padding: 12px 14px;
      border-radius: 14px;
      background: #f8fbff;
      border: 1px solid #dbeafe;
      font-size: 11px;
      line-height: 1.7;
      color: #334155;
    }
    .pdf-lesson-materials strong {
      display: block;
      margin-bottom: 6px;
      color: #0f172a;
    }
    .pdf-lesson-materials ul {
      margin: 0;
      padding-left: 18px;
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
    .pdf-content .ql-video {
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
  const [lessonsResult, moduleResult, licenseContext, materialsMap] = await Promise.all([
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
    fetchLicenseContext(),
    (async () => {
      const lessonIdsResult = await supabase
        .from('lessons')
        .select('id')
        .eq('module_id', moduleId)
        .order('position', { ascending: true })

      if (lessonIdsResult.error) {
        throw lessonIdsResult.error
      }

      const lessonIds = ((lessonIdsResult.data as { id: string }[]) ?? []).map((lesson) => lesson.id)
      return fetchLessonMaterialsMap(lessonIds)
    })(),
  ])

  if (lessonsResult.error) throw lessonsResult.error
  if (moduleResult.error) throw moduleResult.error

  const lessons = ((lessonsResult.data as LessonRow[]) ?? []).map((lesson) => ({
    ...lesson,
    materials: materialsMap.get(lesson.id) ?? [],
  })) satisfies LessonForPdf[]

  const module = (moduleResult.data as ModuleRow | null) ?? {
    title: moduleTitle,
    description: null,
    position: 1,
  }

  const exportDate = formatDate(new Date())
  const element = document.createElement('div')
  element.className = 'pdf-export-container'
  element.style.width = '186mm'

  element.innerHTML = [
    buildCoverHtml(courseTitle, module, lessons, exportDate),
    ...lessons.map((lesson, index) => buildLessonHtml(lesson, index)),
  ].join('')

  const style = buildPdfStyles()
  element.appendChild(style)

  element.querySelectorAll<HTMLElement>('.pdf-content').forEach(attachTableWrappers)

  const opt = {
    margin: [18, 12, 18, 12],
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
      avoid: '.pdf-table-block, table, tr, td, th, img, figure, .ql-video',
    },
  }

  try {
    const watermark = await createTransparentImage(homeCareMatchLogoUrl, 0.08)
    const worker = (html2pdf() as any).set(opt).from(element).toPdf()
    const pdf = await worker.get('pdf')

    applyPdfFinishing(pdf, watermark, courseTitle, licenseContext)
    await worker.save()
  } catch (error) {
    console.error('Erro ao gerar PDF:', error)
    throw error
  }
}

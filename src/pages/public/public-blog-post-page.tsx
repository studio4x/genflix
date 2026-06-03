import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeftCircle, Send } from 'lucide-react';
import { useAuth } from '@/app/providers/auth-provider';
import { GenflixPublicFooter } from '@/components/public/genflix-public-footer';
import { GenflixPublicHeader } from '@/components/public/genflix-public-header';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { fetchApprovedBlogComments, submitBlogComment, type BlogComment } from '@/features/blog/comments-api';
import { genflixNavLinks, getGenflixBlogPostBySlug, type GenflixBlogPost, } from '@/features/public/genflix-site-content';
import { fetchPublicBlogPostFromSupabase } from '@/features/public/genflix-public-content-api';
import { createDefaultBlogStyleSettings, normalizeBlogStyleSettings, type BlogStyleSettings } from '@/features/blog/blog-style-settings';
import { fetchSiteContent } from '@/features/site-editor/api';
import { supabase } from '@/services/supabase/client';
type DraftBlogPostRow = {
    id?: string;
    slug: string;
    title: string;
    category: string | null;
    seo_description: string | null;
    image_url: string | null;
    read_time: string | null;
    author: string | null;
    published_at: string | null;
    content: unknown;
    content_html: string | null;
    featured: boolean | null;
    status: string | null;
};
type AdminPreviewPayload = {
    slug: string;
    title: string;
    category?: string;
    seoDescription?: string;
    image?: string;
    readTime?: string;
    author?: string;
    publishedAt?: string | null;
    contentHtml?: string;
    status?: string;
    savedAt?: number;
};
function toPostContent(value: unknown) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => {
        if (item && typeof item === 'object' && 'text' in item) {
            const text = (item as {
                text?: unknown;
            }).text;
            return typeof text === 'string' ? text : '';
        }
        return typeof item === 'string' ? item : '';
    })
        .filter(Boolean);
}
function sanitizeBlogHtml(rawValue: string) {
    if (!rawValue.trim()) {
        return '';
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawValue, 'text/html');
    const blockedTags = new Set(['script', 'style', 'object', 'embed']);
    Array.from(doc.body.querySelectorAll('*')).forEach((node) => {
        const tagName = node.tagName.toLowerCase();
        if (blockedTags.has(tagName)) {
            node.remove();
            return;
        }
        Array.from(node.attributes).forEach((attribute) => {
            const name = attribute.name.toLowerCase();
            const value = attribute.value.trim().toLowerCase();
            if (name.startsWith('on')) {
                node.removeAttribute(attribute.name);
                return;
            }
            if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
                node.removeAttribute(attribute.name);
                return;
            }
        });
    });
    return doc.body.innerHTML;
}
function contentHtmlToParagraphs(html: string) {
    if (!html.trim()) {
        return [];
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const blocks = Array.from(doc.body.querySelectorAll('p,li,h2,h3,h4,h5,h6'))
        .map((item) => item.textContent?.trim() ?? '')
        .filter(Boolean);
    if (blocks.length > 0) {
        return blocks;
    }
    const fallback = (doc.body.textContent ?? '')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
    return fallback;
}
function mapDraftRowToBlogPost(row: DraftBlogPostRow): GenflixBlogPost {
    return {
        slug: row.slug,
        title: row.title,
        category: row.category ?? 'GenFlix',
        seoDescription: row.seo_description ?? '',
        image: row.image_url ?? '/images/genflix/home/featured-2.jpg',
        readTime: row.read_time ?? '5 min',
        author: row.author ?? 'Equipe GenFlix',
        publishedAt: row.published_at
            ? new Intl.DateTimeFormat('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            }).format(new Date(row.published_at))
            : '',
        content: toPostContent(row.content),
        contentHtml: row.content_html ?? '',
        featured: Boolean(row.featured),
    };
}
function mapAdminPreviewToBlogPost(preview: AdminPreviewPayload): GenflixBlogPost {
    return {
        slug: preview.slug,
        title: preview.title || "Rascunho sem título",
        category: preview.category || 'Sem categoria',
        seoDescription: preview.seoDescription || '',
        image: preview.image || '/images/genflix/home/featured-2.jpg',
        readTime: preview.readTime || '1 min',
        author: preview.author || 'Admin GenFlix',
        publishedAt: preview.publishedAt
            ? new Intl.DateTimeFormat('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            }).format(new Date(preview.publishedAt))
            : '',
        content: contentHtmlToParagraphs(preview.contentHtml ?? ''),
        contentHtml: preview.contentHtml ?? '',
        featured: false,
    };
}
function createCaptchaChallenge() {
    const left = Math.floor(Math.random() * 8) + 1;
    const right = Math.floor(Math.random() * 8) + 1;
    return { prompt: `${left} + ${right}`, answer: String(left + right) };
}
function sanitizeCommentHtml(rawValue: string) {
    if (!rawValue.trim()) {
        return '';
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawValue, 'text/html');
    const blockedTags = new Set(['script', 'style', 'iframe', 'object', 'embed']);
    const nodes = Array.from(doc.body.querySelectorAll('*'));
    nodes.forEach((node) => {
        if (blockedTags.has(node.tagName.toLowerCase())) {
            node.remove();
            return;
        }
        Array.from(node.attributes).forEach((attribute) => {
            const name = attribute.name.toLowerCase();
            const value = attribute.value.trim().toLowerCase();
            if (name.startsWith('on')) {
                node.removeAttribute(attribute.name);
                return;
            }
            if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
                node.removeAttribute(attribute.name);
            }
        });
    });
    return doc.body.innerHTML;
}
export function PublicBlogPostPage() {
    const { slug = '' } = useParams();
    const [searchParams] = useSearchParams();
    const { isLoading, user, roles, profile } = useAuth();
    const isAdmin = roles.includes('admin');
    const isAdminPreviewRequest = searchParams.get('preview') === 'admin';
    const previewKey = searchParams.get('previewKey') || `slug:${slug}`;
    const waitingRoleResolution = !!user && roles.length === 0;
    const canUseAdminPreviewPayload = isAdmin || (isAdminPreviewRequest && !!user && waitingRoleResolution);
    const [post, setPost] = useState<GenflixBlogPost | null>(() => getGenflixBlogPostBySlug(slug));
    const [isLoadingPost, setIsLoadingPost] = useState(true);
    const [isDraftPreview, setIsDraftPreview] = useState(false);
    const [comments, setComments] = useState<BlogComment[]>([]);
    const [isLoadingComments, setIsLoadingComments] = useState(true);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [content, setContent] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [isCommentFormOpen, setIsCommentFormOpen] = useState(false);
    const [commentError, setCommentError] = useState<string | null>(null);
    const [commentSuccess, setCommentSuccess] = useState<string | null>(null);
    const [captcha, setCaptcha] = useState(() => createCaptchaChallenge());
    const [captchaInput, setCaptchaInput] = useState('');
    const [blogStyleSettings, setBlogStyleSettings] = useState<BlogStyleSettings>(createDefaultBlogStyleSettings());
    const isAuthenticated = Boolean(user);
    useEffect(() => {
        let isMounted = true;
        async function loadStyleSettings() {
            try {
                const entries = await fetchSiteContent('blog');
                const styleEntry = entries.find((entry) => entry.page_key === 'blog' && entry.entry_key === 'blog.style.settings');
                if (!isMounted) {
                    return;
                }
                setBlogStyleSettings(normalizeBlogStyleSettings(styleEntry?.value));
            }
            catch {
                if (isMounted) {
                    setBlogStyleSettings(createDefaultBlogStyleSettings());
                }
            }
        }
        void loadStyleSettings();
        return () => {
            isMounted = false;
        };
    }, []);
    const articleStyleVars = {
        '--blog-content-p-font-family': blogStyleSettings.content.p.fontFamily || undefined,
        '--blog-content-p-font-size': blogStyleSettings.content.p.fontSize || undefined,
        '--blog-content-p-font-weight': blogStyleSettings.content.p.fontWeight || undefined,
        '--blog-content-p-line-height': blogStyleSettings.content.p.lineHeight || undefined,
        '--blog-content-p-letter-spacing': blogStyleSettings.content.p.letterSpacing || undefined,
        '--blog-content-p-color': blogStyleSettings.content.p.color || undefined,
        '--blog-content-h1-font-family': blogStyleSettings.content.h1.fontFamily || undefined,
        '--blog-content-h1-font-size': blogStyleSettings.content.h1.fontSize || undefined,
        '--blog-content-h1-font-weight': blogStyleSettings.content.h1.fontWeight || undefined,
        '--blog-content-h1-line-height': blogStyleSettings.content.h1.lineHeight || undefined,
        '--blog-content-h1-letter-spacing': blogStyleSettings.content.h1.letterSpacing || undefined,
        '--blog-content-h1-color': blogStyleSettings.content.h1.color || undefined,
        '--blog-content-h2-font-family': blogStyleSettings.content.h2.fontFamily || undefined,
        '--blog-content-h2-font-size': blogStyleSettings.content.h2.fontSize || undefined,
        '--blog-content-h2-font-weight': blogStyleSettings.content.h2.fontWeight || undefined,
        '--blog-content-h2-line-height': blogStyleSettings.content.h2.lineHeight || undefined,
        '--blog-content-h2-letter-spacing': blogStyleSettings.content.h2.letterSpacing || undefined,
        '--blog-content-h2-color': blogStyleSettings.content.h2.color || undefined,
        '--blog-content-h3-font-family': blogStyleSettings.content.h3.fontFamily || undefined,
        '--blog-content-h3-font-size': blogStyleSettings.content.h3.fontSize || undefined,
        '--blog-content-h3-font-weight': blogStyleSettings.content.h3.fontWeight || undefined,
        '--blog-content-h3-line-height': blogStyleSettings.content.h3.lineHeight || undefined,
        '--blog-content-h3-letter-spacing': blogStyleSettings.content.h3.letterSpacing || undefined,
        '--blog-content-h3-color': blogStyleSettings.content.h3.color || undefined,
        '--blog-content-h4-font-family': blogStyleSettings.content.h4.fontFamily || undefined,
        '--blog-content-h4-font-size': blogStyleSettings.content.h4.fontSize || undefined,
        '--blog-content-h4-font-weight': blogStyleSettings.content.h4.fontWeight || undefined,
        '--blog-content-h4-line-height': blogStyleSettings.content.h4.lineHeight || undefined,
        '--blog-content-h4-letter-spacing': blogStyleSettings.content.h4.letterSpacing || undefined,
        '--blog-content-h4-color': blogStyleSettings.content.h4.color || undefined,
        '--blog-content-h5-font-family': blogStyleSettings.content.h5.fontFamily || undefined,
        '--blog-content-h5-font-size': blogStyleSettings.content.h5.fontSize || undefined,
        '--blog-content-h5-font-weight': blogStyleSettings.content.h5.fontWeight || undefined,
        '--blog-content-h5-line-height': blogStyleSettings.content.h5.lineHeight || undefined,
        '--blog-content-h5-letter-spacing': blogStyleSettings.content.h5.letterSpacing || undefined,
        '--blog-content-h5-color': blogStyleSettings.content.h5.color || undefined,
        '--blog-content-h6-font-family': blogStyleSettings.content.h6.fontFamily || undefined,
        '--blog-content-h6-font-size': blogStyleSettings.content.h6.fontSize || undefined,
        '--blog-content-h6-font-weight': blogStyleSettings.content.h6.fontWeight || undefined,
        '--blog-content-h6-line-height': blogStyleSettings.content.h6.lineHeight || undefined,
        '--blog-content-h6-letter-spacing': blogStyleSettings.content.h6.letterSpacing || undefined,
        '--blog-content-h6-color': blogStyleSettings.content.h6.color || undefined,
        '--blog-content-a-font-family': blogStyleSettings.content.a.fontFamily || undefined,
        '--blog-content-a-font-size': blogStyleSettings.content.a.fontSize || undefined,
        '--blog-content-a-font-weight': blogStyleSettings.content.a.fontWeight || undefined,
        '--blog-content-a-line-height': blogStyleSettings.content.a.lineHeight || undefined,
        '--blog-content-a-letter-spacing': blogStyleSettings.content.a.letterSpacing || undefined,
        '--blog-content-a-color': blogStyleSettings.content.a.color || undefined,
        '--blog-content-a-text-decoration': blogStyleSettings.content.a.underline ? 'underline' : 'none',
        '--blog-content-li-font-family': blogStyleSettings.content.li.fontFamily || undefined,
        '--blog-content-li-font-size': blogStyleSettings.content.li.fontSize || undefined,
        '--blog-content-li-font-weight': blogStyleSettings.content.li.fontWeight || undefined,
        '--blog-content-li-line-height': blogStyleSettings.content.li.lineHeight || undefined,
        '--blog-content-li-letter-spacing': blogStyleSettings.content.li.letterSpacing || undefined,
        '--blog-content-li-color': blogStyleSettings.content.li.color || undefined,
    } as CSSProperties;
    const articleTitleStyle = {
        fontFamily: blogStyleSettings.articleTitle.fontFamily || undefined,
        fontSize: blogStyleSettings.articleTitle.fontSize || undefined,
        fontWeight: blogStyleSettings.articleTitle.fontWeight || undefined,
        lineHeight: blogStyleSettings.articleTitle.lineHeight || undefined,
        letterSpacing: blogStyleSettings.articleTitle.letterSpacing || undefined,
        color: blogStyleSettings.articleTitle.color || undefined,
    } as CSSProperties;
    useEffect(() => {
        const fullName = (profile?.full_name ?? user?.user_metadata?.full_name ?? '').trim();
        const parts = fullName ? fullName.split(/\s+/).filter(Boolean) : [];
        const resolvedFirstName = parts.length ? parts[0] : '';
        const resolvedLastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
        setFirstName((current) => (current.trim() ? current : resolvedFirstName));
        setLastName((current) => (current.trim() ? current : resolvedLastName));
        setEmail((current) => (current.trim() ? current : (profile?.email ?? user?.email ?? '')));
    }, [profile?.email, profile?.full_name, user?.email, user?.user_metadata?.full_name]);
    useEffect(() => {
        let isMounted = true;
        async function loadPost() {
            setIsLoadingPost(true);
            try {
                let resolvedPost: GenflixBlogPost | null = null;
                let draftPreview = false;
                try {
                    resolvedPost = await fetchPublicBlogPostFromSupabase(slug);
                }
                catch {
                    resolvedPost = null;
                }
                if (!resolvedPost && isAdmin) {
                    const previewQuery = supabase
                        .from('blog_posts')
                        .select("id, slug, title, category, seo_description, image_url, read_time, author, published_at, content, content_html, featured, status");
                    const previewResult = previewKey.startsWith('id:')
                        ? await previewQuery.eq('id', previewKey.slice(3)).maybeSingle()
                        : await previewQuery.eq('slug', slug).maybeSingle();
                    if (!previewResult.error && previewResult.data) {
                        resolvedPost = mapDraftRowToBlogPost(previewResult.data as DraftBlogPostRow);
                        draftPreview = (previewResult.data as DraftBlogPostRow).status !== 'published';
                    }
                }
                if (!resolvedPost && isAdminPreviewRequest && canUseAdminPreviewPayload) {
                    const keys = [`admin_blog_preview:${previewKey}`, `admin_blog_preview:slug:${slug}`];
                    for (const storageKey of keys) {
                        try {
                            const raw = localStorage.getItem(storageKey);
                            if (!raw)
                                continue;
                            const parsed = JSON.parse(raw) as AdminPreviewPayload;
                            if (parsed?.slug === slug) {
                                resolvedPost = mapAdminPreviewToBlogPost(parsed);
                                draftPreview = (parsed.status ?? 'draft') !== 'published';
                                break;
                            }
                        }
                        catch {
                            // noop
                        }
                    }
                }
                if (isMounted) {
                    setPost(resolvedPost ?? getGenflixBlogPostBySlug(slug));
                    setIsDraftPreview(draftPreview);
                }
            }
            catch {
                if (isMounted) {
                    setPost(getGenflixBlogPostBySlug(slug));
                    setIsDraftPreview(false);
                }
            }
            finally {
                if (isMounted) {
                    setIsLoadingPost(false);
                }
            }
        }
        void loadPost();
        return () => {
            isMounted = false;
        };
    }, [canUseAdminPreviewPayload, isAdmin, isAdminPreviewRequest, previewKey, slug]);
    useEffect(() => {
        let isMounted = true;
        async function loadComments() {
            setIsLoadingComments(true);
            try {
                const rows = await fetchApprovedBlogComments(slug);
                if (isMounted) {
                    setComments(rows);
                }
            }
            catch {
                if (isMounted) {
                    setComments([]);
                }
            }
            finally {
                if (isMounted) {
                    setIsLoadingComments(false);
                }
            }
        }
        void loadComments();
        return () => {
            isMounted = false;
        };
    }, [slug]);
    async function handleSubmitComment(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setCommentError(null);
        setCommentSuccess(null);
        setIsSubmittingComment(true);
        try {
            if (captchaInput.trim() !== captcha.answer) {
                throw new Error("Captcha inv?lido. Confira o resultado e tente novamente.");
            }
            await submitBlogComment({
                postSlug: slug,
                postTitle: post?.title ?? '',
                firstName,
                lastName,
                email,
                content,
            });
            setContent('');
            setCaptchaInput('');
            setCaptcha(createCaptchaChallenge());
            setCommentSuccess("Comentário enviado para aprovação do administrador.");
            setIsCommentFormOpen(false);
        }
        catch (error) {
            setCommentError(error instanceof Error ? error.message : 'Não foi possível enviar o comentário.');
        }
        finally {
            setIsSubmittingComment(false);
        }
    }
    if (isLoading || waitingRoleResolution) {
        return (<main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando GenFlix...</p>
      </main>);
    }
    if (isLoadingPost && !post) {
        return (<main className="flex min-h-screen items-center justify-center bg-[#10242b] p-6 font-manrope">
        <p className="text-sm font-extrabold uppercase tracking-[0.28em] text-white/72">Carregando artigo...</p>
      </main>);
    }
    if (!post) {
        return <Navigate to="/blog" replace/>;
    }
    return (<main className="min-h-screen bg-[#f4f4f4] font-manrope text-[#1f2e39]">
      <GenflixPublicHeader navLinks={genflixNavLinks}/>

      <section className="pb-16 pt-1">
        <div className="public-site-container max-w-[1140px]">
          <article>
            <div className="mx-auto w-full max-w-[1920px] overflow-hidden bg-black">
              <img src={post.image} alt={post.title} className="aspect-[1920/500] w-full object-cover object-center"/>
            </div>

            {isDraftPreview ? (<p className="mt-4 text-center text-sm font-semibold uppercase tracking-[0.15em] text-amber-700">Prévia de rascunho (admin)</p>) : null}

            <div className="mt-10 grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
              <h1 className="font-lora text-[42px] leading-[1.12] text-[#008f9c] sm:text-[48px] lg:text-[56px]" style={articleTitleStyle}>
                {post.title}
              </h1>

              <div className="space-y-5 font-lora text-[19px] leading-[1.7] text-[#343434]">
                {post.contentHtml?.trim() ? (<div className="blog-article-html" style={articleStyleVars} dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(post.contentHtml) }}/>) : (post.content.map((paragraph, index) => (<p key={`${post.slug}-paragraph-${index}`}>{paragraph}</p>)))}
              </div>
            </div>
          </article>

          <section className="mt-12 flex flex-wrap items-center justify-center gap-6 pb-4 lg:mt-14 lg:justify-between lg:gap-10">
            <Link to="/blog" className="inline-flex h-12 min-w-[210px] items-center justify-center gap-2 rounded-full border border-[#00808f] px-6 text-sm font-semibold uppercase tracking-[0.02em] text-[#032b36] transition-colors hover:bg-[#e6f4f6]">
              <ArrowLeftCircle className="h-4 w-4"/>
              Voltar para o blog
            </Link>

            <Link to="/contato" className="inline-flex h-12 min-w-[210px] items-center justify-center gap-2 rounded-full border border-[#00808f] px-6 text-sm font-semibold uppercase tracking-[0.02em] text-[#032b36] transition-colors hover:bg-[#e6f4f6]">
              <Send className="h-4 w-4"/>
              Fale conosco
            </Link>
          </section>

          <section className="mt-10 rounded-[18px] border border-[#D8E6EB] bg-white p-5 shadow-sm sm:p-7">
            <h2 className="font-readex text-2xl font-semibold text-[#15323b]">Comentários</h2>
            <p className="mt-2 text-sm font-medium text-[#5f7077]">Envie seu comentário. A publicação acontece após aprovação do administrador.</p>

            {commentError ? <p className="mt-4 border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{commentError}</p> : null}
            {commentSuccess ? <p className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{commentSuccess}</p> : null}

            <div className="mt-6 space-y-4">
              {isLoadingComments ? (<p className="text-sm font-semibold text-[#6d7f84]">Carregando comentários...</p>) : comments.length === 0 ? (<p className="text-sm font-semibold text-[#6d7f84]">Ainda não há comentários aprovados neste artigo.</p>) : comments.map((item) => (<article key={item.id} className="rounded-[18px] border border-[#D8E6EB] bg-[#F8FBFC] p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0E8CA6] text-xs font-black uppercase text-white">
                      {(item.first_name?.[0] ?? '').toUpperCase()}{(item.last_name?.[0] ?? '').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-sm font-black text-[#15323b]">{item.first_name} {item.last_name}</p>
                        <span className="text-xs font-semibold text-[#7a9097]">
                          {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.created_at))}
                        </span>
                      </div>
                      <div className="prose prose-sm mt-2 max-w-none text-[#5f7077]" dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(item.content) }}/>

                      {item.admin_response ? (<div className="mt-3 rounded-[12px] border border-[#CBE6ED] bg-[#EAF7FA] p-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#0E6F82]">Resposta do admin</p>
                          <div className="prose prose-sm mt-2 max-w-none text-[#0A3640]" dangerouslySetInnerHTML={{ __html: sanitizeCommentHtml(item.admin_response) }}/>
                        </div>) : null}
                    </div>
                  </div>
                </article>))}
            </div>

            <div className="mt-6 border-t border-[#D8E6EB] pt-6">
              <button type="button" onClick={() => setIsCommentFormOpen((current) => !current)} className="h-11 w-full max-w-[300px] rounded-full bg-[#1398B7] px-5 text-sm font-black uppercase tracking-[0.02em] text-white hover:bg-[#0A3640]">
                {isCommentFormOpen ? 'Fechar formulário' : 'Enviar comentário'}
              </button>

              {isCommentFormOpen ? (<form onSubmit={(event) => void handleSubmitComment(event)} className="mt-4 grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Nome" disabled={isAuthenticated} className="h-11 border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7] disabled:cursor-not-allowed disabled:bg-slate-100"/>
                    <input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Sobrenome" disabled={isAuthenticated} className="h-11 border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7] disabled:cursor-not-allowed disabled:bg-slate-100"/>
                    <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="E-mail" disabled={isAuthenticated} className="h-11 border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7] disabled:cursor-not-allowed disabled:bg-slate-100"/>
                  </div>
                  <RichTextEditor value={content} onChange={setContent} placeholder="Escreva seu comentário" showRawHtmlToggle={false} minHeightClassName="min-h-[140px]" simpleMode/>
                  <div className="grid gap-2 sm:max-w-[280px]">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Captcha anti-spam</p>
                    <label className="text-sm font-semibold text-[#15323b]">Resolva: {captcha.prompt}</label>
                    <input value={captchaInput} onChange={(event) => setCaptchaInput(event.target.value)} placeholder="Digite o resultado" className="h-11 border border-[#D8E6EB] px-3 text-sm font-semibold text-[#15323b] outline-none focus:border-[#1398B7]"/>
                  </div>
                  <button type="submit" disabled={isSubmittingComment} className="h-11 w-full max-w-[260px] rounded-full bg-[#1398B7] px-5 text-sm font-black uppercase tracking-[0.02em] text-white hover:bg-[#0A3640] disabled:opacity-70">
                    {isSubmittingComment ? 'Enviando...' : 'Enviar comentário'}
                  </button>
                </form>) : null}
            </div>
          </section>
        </div>
      </section>

      <GenflixPublicFooter />
    </main>);
}

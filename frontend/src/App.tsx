import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowUp, ChevronDown, DollarSign, FilePlus, Mail, Menu, Moon, MoreHorizontal, RefreshCw, Save, Search, Trash2, Wand2, X } from 'lucide-react';
import { assetUrl, getPost, getPosts, request, subscribe } from './api';
import type { AdminSettings, Article, Post } from './domain';

const covers = ['/covers/cover1.png', '/covers/cover2.png', '/covers/cover3.png', '/covers/cover4.png'];
const demoArticles: Article[] = [
  'Art Basel brings fun back to the fair with the element of surprise',
  'Money love structure more than motivation',
  'Turn one useful skill into an offer people understand',
  'The internet removed the receptionist',
  'A practical map for building online income after work',
  'How attention strategy compounds into better choices',
  'Digital products that keep selling after your mood leaves',
  'Behavioral economics for people with rent due',
  'Side hustles that do not become another job',
].map((title, index) => ({
  id: `demo-${index}`,
  slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  title,
  excerpt: 'Sharp essays on money, attention, and the uncomfortable math of making your own future.',
  contentHtml: `<p>Sharp essays on money, attention, and the uncomfortable math of making your own future.</p>`,
  status: 'published',
  author: 'Andrew Nicklson',
  tags: ['Make Money Online'],
  seoTitle: null,
  seoDescription: null,
  coverImage: null,
  source: 'legacy',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  cover: covers[index % covers.length],
  category: 'Make Money Online',
  readingTime: 17,
  views: 2400 + index * 310,
}));
const weekdays = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];
const hourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const minuteOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

type DraftPost = {
  title: string;
  slug: string;
  excerpt: string;
  contentHtml: string;
  status: 'draft' | 'published';
  tags: string;
  coverImage: string;
};

type MediaAsset = {
  name: string;
  url: string;
  size: number;
  createdAt: string;
};

const emptyDraft: DraftPost = { title: '', slug: '', excerpt: '', contentHtml: '<h2>Introduction</h2><p></p>', status: 'published', tags: '', coverImage: '' };

function normalizeTimeValue(value: string) {
  const trimmed = String(value || '').trim();
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : '08:00';
}

function TimePicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [hour, minute] = normalizeTimeValue(value).split(':');

  return (
    <label className="time-field">
      <span>{label}</span>
      <div className="time-picker">
        <select aria-label={`${label} hour`} value={hour} onChange={(event) => onChange(`${event.target.value}:${minute}`)}>
          {hourOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <span className="time-separator">:</span>
        <select aria-label={`${label} minute`} value={minute} onChange={(event) => onChange(`${hour}:${event.target.value}`)}>
          {minuteOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>
    </label>
  );
}

function pickCover(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return covers[hash % covers.length];
}

function toArticle(post: Post, index = 0): Article {
  const tag = post.tags[0] || (post.source === 'ai' ? 'AI Side Hustles' : 'Online Income');
  return {
    ...post,
    cover: post.coverImage ? assetUrl(post.coverImage) : pickCover(post.slug || post.title),
    category: tag.replace(/\b\w/g, (letter) => letter.toUpperCase()),
    readingTime: Math.max(5, Math.ceil(post.contentHtml.replace(/<[^>]+>/g, '').split(/\s+/).length / 180)),
    views: 2400 + index * 420,
  };
}

function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new Event('app:navigate'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function SocialIcon({ name }: { name: "x" | "threads" | "telegram" | "linkedin" }) {
  if (name === "x") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18.244 2H21.5l-7.11 8.126L22.75 22h-6.54l-5.12-6.693L5.23 22H1.97l7.605-8.692L1.55 2h6.705l4.627 6.118L18.244 2Zm-1.143 17.91h1.804L7.27 3.98H5.334L17.1 19.91Z" />
      </svg>
    );
  }
  if (name === "threads") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12.08 2C7.02 2 4 5.36 4 10.93v2.14C4 18.64 7.02 22 12.08 22c4.38 0 7.13-2.28 7.13-5.86 0-2.58-1.48-4.2-4.2-4.82-.16-2.32-1.53-3.77-3.88-3.77-1.5 0-2.76.52-3.73 1.55l1.22 1.42c.67-.7 1.46-1.05 2.37-1.05 1.1 0 1.78.62 1.94 1.74h-1.44c-2.72 0-4.41 1.3-4.41 3.38 0 2 1.55 3.3 3.94 3.3 2.35 0 3.82-1.2 4.14-3.45 1.26.45 1.9 1.24 1.9 2.37 0 2.02-1.88 3.29-4.88 3.29-3.82 0-5.99-2.48-5.99-6.9v-2.24c0-4.42 2.17-6.9 5.99-6.9 2.98 0 4.84 1.38 5.28 3.9h2.1C19.03 4.43 16.32 2 12.08 2Zm-1 13.96c-1.13 0-1.82-.52-1.82-1.36 0-.92.83-1.46 2.27-1.46h1.48c-.17 1.84-.83 2.82-1.93 2.82Z" />
      </svg>
    );
  }
  if (name === "telegram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21.74 4.67 18.5 19.95c-.24 1.08-.88 1.34-1.78.84l-4.92-3.63-2.37 2.28c-.26.26-.48.48-.98.48l.35-5.02 9.13-8.25c.4-.35-.09-.55-.62-.2L6.03 13.56 1.17 12.04c-1.05-.33-1.07-1.05.22-1.55L20.4 3.16c.88-.33 1.65.2 1.34 1.51Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5ZM.33 8h4.33v14H.33V8Zm7 0h4.15v1.92h.06c.58-1.1 2-2.25 4.1-2.25 4.38 0 5.19 2.88 5.19 6.63V22H16.5v-6.82c0-1.63-.03-3.72-2.27-3.72-2.27 0-2.62 1.77-2.62 3.6V22H7.33V8Z" />
    </svg>
  );
}

function ShareBar({ title, url }: { title: string; url: string }) {
  const absoluteUrl = typeof window !== "undefined" ? new URL(url, window.location.origin).href : url;
  const shareText = `${title} ${absoluteUrl}`;
  const encodedUrl = encodeURIComponent(absoluteUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedShareText = encodeURIComponent(shareText);
  const targets = [
    { label: "X", icon: "x" as const, href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
    { label: "Threads", icon: "threads" as const, href: `https://www.threads.net/intent/post?text=${encodedShareText}` },
    { label: "Telegram", icon: "telegram" as const, href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}` },
    { label: "LinkedIn", icon: "linkedin" as const, href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
  ];

  return (
    <aside className="share-bar" aria-label="Share this post">
      <span className="share-label">Share this post</span>
      <div className="share-actions">
        {targets.map((target) => (
          <a key={target.label} className="share-link" href={target.href} target="_blank" rel="noreferrer" aria-label={`Share on ${target.label}`}>
            <SocialIcon name={target.icon} />
            <span>{target.label}</span>
          </a>
        ))}
      </div>
    </aside>
  );
}


function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  function go(path: string) {
    setMenuOpen(false);
    navigate(path);
  }

  return (
    <header className={`site-header${menuOpen ? ' menu-open' : ''}`}>
      <div className="shell header-inner">
        <button className="brand" onClick={() => go('/')}>make money<span>ordie</span></button>
        <button
          className="menu-toggle"
          type="button"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menuOpen}
          aria-controls="site-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav id="site-navigation" className="nav">
          <button className="icon-button" type="button" aria-label="Search" onClick={() => go('/articles')}><Search size={19} /></button>
          <button className="icon-button" type="button" aria-label="Toggle dark mode"><Moon size={18} /></button>
          <button className="pill-button" type="button" onClick={() => document.getElementById('subscribe')?.scrollIntoView({ behavior: 'smooth' })}>Subscribe</button>
        </nav>
      </div>
      {menuOpen && <button className="menu-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    </header>
  );
}

function ArticleCard({ article, image = false, className = '' }: { article: Article; image?: boolean; className?: string }) {
  return (
    <article
      className={`article-card${image ? ' with-image' : ''}${className ? ` ${className}` : ''}`}
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/articles/${article.slug}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(`/articles/${article.slug}`);
        }
      }}
    >
      {image && (
        <span className="image-wrap" aria-hidden="true">
          <span className="cover-placeholder" />
        </span>
      )}
      <div className="card-body">
        <h3>{article.title}</h3>
        <footer className="card-meta">
          <span className="tag-pill">{article.category}</span>
          <span>{article.readingTime} Min</span>
        </footer>
      </div>
    </article>
  );
}

function ArticleGrid({ articles }: { articles: Article[] }) {
  return (
    <div className="article-grid">
      {articles.map((article) => <ArticleCard key={article.id} article={article} />)}
    </div>
  );
}

function Newsletter() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await subscribe(email);
      setEmail('');
      setMessage('You are subscribed. The next money signal is on the way.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not subscribe right now.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="newsletter-form" onSubmit={submit}>
      <div className="newsletter-input-row">
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Enter your email" required disabled={busy} />
        <button disabled={busy}>{busy ? 'Subscribing...' : 'Subscribe'}</button>
      </div>
      {message && <p className={`newsletter-message ${message.includes('subscribed') ? 'success' : 'error'}`}>{message}</p>}
    </form>
  );
}

function HomePage({ articles }: { articles: Article[] }) {
  const displayArticles = articles.length ? articles : demoArticles;
  const featured = displayArticles.slice(0, 3);
  const catalog = displayArticles.slice(0, 9);
  const categories = ['Make Money Online', 'Attention Strategy', 'Digital Products', 'Behavioral Economics', 'Side Hustles'];

  return (
    <>
      <main className="home-page shell">
        <section className="home-hero">
          <h1>Build leverage before the rent reminder does it for you.</h1>
          <div className="hero-layout">
            <div className="hero-left">
              <p className="hero-deck">
                Sharp essays on money, attention, and the uncomfortable math of making your own
                future. No fluff, no startup cosplay, just ideas that actually survive contact with
                a calendar and a bank account.
              </p>

              <section className="author-snapshot" aria-labelledby="author-title">
                <h2 id="author-title">about author</h2>
                <div className="author-row">
                  <img src="/avatars/ava.svg" alt="" />
                  <div>
                    <h3>Andrew Nickolson</h3>
                    <p>Writer, operator, and systems thinker.</p>
                    <h4>Specialization</h4>
                    <p>Side hustles, online businesses, content systems, AI-assisted publishing, behavioral economics, and the small decisions that compound into financial options.</p>
                  </div>
                </div>
                <div className="author-stats">
                  <span><span className="mini-badge">ok</span> publisher of a month</span>
                  <span><span className="mini-badge flag">15</span> 15 years in business</span>
                </div>
              </section>
            </div>

            <aside className="featured-week">
              <h2>featured this week</h2>
              {featured.map((article, index) => (
                <ArticleCard key={article.id} article={article} image={index === 0} />
              ))}
            </aside>
          </div>
        </section>

        <section id="subscribe" className="mid-feature">
          <div className="feature-photo" aria-hidden="true">
            <img src="/covers/cover2.png" alt="" />
          </div>
          <div className="subscribe-panel">
            <p className="section-kicker"><span><MoreHorizontal size={18} /></span> stay updated</p>
            <h2>Read what matters.</h2>
            <Newsletter />
            <p className="consent-copy">By subscribing, you agree to receive our weekly newsletter. You can unsubscribe at any time.</p>
          </div>
        </section>

        <div className="ad-slot">place for ads</div>

        <section className="article-section">
          <div className="article-section-head">
            <h2>200+ articles</h2>
            <div className="category-tools">
              <span>browse by category:</span>
              <button className="tag-pill active" type="button">Popular Now</button>
            </div>
          </div>
          <div className="category-row">
            {categories.map((category) => <button key={category} className="category-chip" type="button">{category}</button>)}
          </div>
          <div className="magazine-grid">
            {catalog.map((article, index) => (
              <ArticleCard key={article.id} article={article} image={[0, 4, 7].includes(index)} />
            ))}
          </div>
          <div className="quote-row">
            <img src="/avatars/ava.svg" alt="" />
            <div>
              <strong>Andrew Nickolson</strong>
              <p>"The internet did not create new opportunities. It removed the receptionist."</p>
            </div>
            <button className="load-more" type="button" onClick={() => navigate('/articles')}>Load More <ChevronDown size={18} /></button>
          </div>
        </section>
      </main>
    </>
  );
}

function ArticlesPage({ articles, initialQuery = '' }: { articles: Article[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return articles;
    return articles.filter((article) => [article.title, article.excerpt, article.category, ...article.tags].join(' ').toLowerCase().includes(q));
  }, [articles, query]);

  return (
    <main className="shell archive-page">
      <section className="article-hero">
        <p className="hero-overline">All articles</p>
        <h1>The archive</h1>
        <p className="article-lead">Browse essays on side hustles, attention economics, digital products, personal leverage, and the odd psychology of money.</p>
      </section>
      <div className="filters">
        <label className="search-input-wrap">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search side hustles, leverage, attention..." />
        </label>
      </div>
      <ArticleGrid articles={filtered} />
    </main>
  );
}

function ArticlePage({ article }: { article?: Article }) {
  if (!article) {
    return (
      <main className="shell not-found">
        <div className="not-found-copy">
          <p className="not-found-overline">404</p>
          <h1>Article not found</h1>
          <p>The guide you requested is not available.</p>
          <div className="not-found-actions">
            <button className="btn primary" onClick={() => navigate('/articles')}>Back to archive</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="shell article-page">
      <section className="article-hero">
        <p className="author-line">Andrew Nicklson</p>
        <div className="tag-row">{article.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        <h1>{article.title}</h1>
        <p className="article-lead">{article.excerpt}</p>
      </section>
      <div className="article-cover">
        <img className="cover" src={article.cover} alt="" />
      </div>
      <ShareBar title={article.title} url={`/articles/${article.slug}`} />
      <article className="markdown" dangerouslySetInnerHTML={{ __html: article.contentHtml }} />
      <button className="btn secondary" onClick={() => navigate('/articles')}>Back to all articles</button>
    </main>
  );
}

function AboutPage() {
  return (
    <main className="shell about-page">
      <section className="about-hero">
        <div className="about-copy">
          <p className="hero-overline">About the author</p>
          <h1>Andrew Nicklson writes for people building leverage under pressure.</h1>
          <p>
            MakeMoneyOrDie is an editorial notebook about money, attention, internet income,
            and the uncomfortable systems behind personal freedom. The point is not motivation.
            The point is building things that still work when motivation disappears.
          </p>
        </div>
        <aside className="author-card">
          <span className="author-initials">AN</span>
          <h2>Andrew Nicklson</h2>
          <p>Writer, operator, and systems thinker focused on practical leverage, digital products, and sharper financial behavior.</p>
        </aside>
      </section>

      <section className="about-grid">
        <article>
          <span>01</span>
          <h2>What this site covers</h2>
          <p>Side hustles, online businesses, content systems, AI-assisted publishing, behavioral economics, and the small decisions that compound into financial options.</p>
        </article>
        <article>
          <span>02</span>
          <h2>The editorial rule</h2>
          <p>No vague hustle theater. Every essay should give the reader a cleaner model, a sharper question, or a system they can actually use.</p>
        </article>
        <article>
          <span>03</span>
          <h2>Why MakeMoneyOrDie</h2>
          <p>Because money is not the whole game, but ignoring it makes every other game harder. The site treats money as oxygen for better choices.</p>
        </article>
      </section>
    </main>
  );
}

function AdminPanel() {
  const editorPanelRef = useRef<HTMLFormElement | null>(null);
  const [email, setEmail] = useState('admin@makemoneyordie.local');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [coverImages, setCoverImages] = useState<MediaAsset[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingSlug, setEditingSlug] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [generatingCount, setGeneratingCount] = useState<1 | 3 | null>(null);
  const [editorPanelHeight, setEditorPanelHeight] = useState<number | null>(null);

  useEffect(() => {
    const element = editorPanelRef.current;
    if (!element) return;

    const updateHeight = () => setEditorPanelHeight(element.getBoundingClientRect().height);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    window.addEventListener('resize', updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateHeight);
    };
  }, [token]);

  async function load(nextToken = token) {
    const [loadedPosts, loadedSettings, loadedCoverImages] = await Promise.all([
      request<Post[]>('/api/admin/posts', {}, nextToken),
      request<AdminSettings>('/api/admin/settings', {}, nextToken),
      request<MediaAsset[]>('/api/admin/media/covers', {}, nextToken),
    ]);
    setPosts(loadedPosts);
    setSettings(loadedSettings);
    setCoverImages(loadedCoverImages);
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await request<{ accessToken: string; csrfToken: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.accessToken);
      setCsrfToken(data.csrfToken);
      await load(data.accessToken);
      setMessage('Signed in.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  }

  async function savePost(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const body = {
        ...draft,
        coverImage: draft.coverImage || null,
        tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      };
      await request<Post>(editingSlug ? `/api/admin/posts/${editingSlug}` : '/api/admin/posts', {
        method: editingSlug ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      }, token);
      setDraft(emptyDraft);
      setEditingSlug('');
      await load();
      setMessage('Article saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save article.');
    } finally {
      setBusy(false);
    }
  }

  async function removePost(slug: string) {
    await request(`/api/admin/posts/${slug}`, { method: 'DELETE' }, token);
    await load();
  }

  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Could not read image file.'));
      reader.readAsDataURL(file);
    });
  }

  async function uploadCoverImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const asset = await request<MediaAsset>('/api/admin/media/covers', {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, dataUrl }),
      }, token);
      await load();
      setDraft((current) => ({ ...current, coverImage: current.coverImage || asset.url }));
      setMessage('Cover image uploaded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not upload image.');
    } finally {
      setBusy(false);
    }
  }

  async function removeCoverImage(name: string) {
    await request(`/api/admin/media/covers/${encodeURIComponent(name)}`, { method: 'DELETE' }, token);
    setDraft((current) => current.coverImage.endsWith(`/${name}`) ? { ...current, coverImage: '' } : current);
    await load();
  }

  async function generateNow(count: 1 | 3) {
    setBusy(true);
    setGeneratingCount(count);
    setMessage(`Generating ${count} article${count === 1 ? '' : 's'} with OpenRouter. This can take 20-90 seconds...`);
    try {
      let nextToken = token;
      if (csrfToken) {
        try {
          const refreshed = await request<{ accessToken: string }>('/api/auth/refresh', { method: 'POST' }, undefined, csrfToken);
          nextToken = refreshed.accessToken;
          setToken(refreshed.accessToken);
        } catch {
          nextToken = token;
        }
      }
      const generated = await request<Post[]>('/api/ai/generate-article', { method: 'POST', body: JSON.stringify({ count }) }, nextToken);
      await load();
      setMessage(`${generated.length || 0} generated article${generated.length === 1 ? '' : 's'} saved.`);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Generation failed.';
      if (text.toLowerCase().includes('session') || text.toLowerCase().includes('admin session')) {
        setToken('');
        setMessage('Session expired. Please sign in again.');
      } else {
        setMessage(text);
      }
    } finally {
      setBusy(false);
      setGeneratingCount(null);
    }
  }

  async function refreshSession() {
    const data = await request<{ accessToken: string }>('/api/auth/refresh', { method: 'POST' }, undefined, csrfToken);
    setToken(data.accessToken);
    await load(data.accessToken);
  }

  async function saveSettings() {
    if (!settings) return;
    await request<AdminSettings>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }, token);
    setMessage('Settings saved.');
  }

  function updateGenerationCount(count: number) {
    if (!settings) return;
    const safeCount = Math.min(12, Math.max(1, count || 1));
    const currentTimes = settings.generationTimes?.length ? settings.generationTimes : [settings.generationTime || '08:00'];
    const nextTimes = Array.from({ length: safeCount }, (_, index) => currentTimes[index] || currentTimes[currentTimes.length - 1] || '08:00');
    setSettings({ ...settings, generationCount: safeCount, generationTimes: nextTimes, generationTime: nextTimes[0] });
  }

  function updateGenerationTime(index: number, value: string) {
    if (!settings) return;
    const nextTimes = [...(settings.generationTimes?.length ? settings.generationTimes : [settings.generationTime || '08:00'])];
    nextTimes[index] = normalizeTimeValue(value);
    setSettings({ ...settings, generationTimes: nextTimes, generationTime: nextTimes[0], generationCount: nextTimes.length });
  }

  function toggleWeekday(day: number) {
    if (!settings) return;
    const current = settings.generationWeekdays || [];
    const next = current.includes(day) ? current.filter((value) => value !== day) : [...current, day];
    setSettings({ ...settings, generationWeekdays: next.length ? next.sort() : [1] });
  }

  if (!token) {
    return (
      <main className="admin-page">
        <form className="admin-login" onSubmit={signIn}>
          <h1>Admin sign in</h1>
          <label><span>Email</span><input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <button disabled={busy}>Sign in</button>
          {message && <p className="form-message">{message}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-toolbar">
        <h1>Publishing admin</h1>
        <button onClick={refreshSession}><RefreshCw size={16} /> Refresh</button>
        <button onClick={() => generateNow(1)} disabled={busy}><Wand2 size={16} /> {generatingCount === 1 ? 'Generating 1...' : 'Generate 1 now'}</button>
        <button onClick={() => generateNow(3)} disabled={busy}><Wand2 size={16} /> {generatingCount === 3 ? 'Generating 3...' : 'Generate 3 now'}</button>
      </header>
      {message && <p className="form-message">{message}</p>}
      <section className="admin-grid">
        <form ref={editorPanelRef} className="editor-panel" onSubmit={savePost}>
          <h2>{editingSlug ? 'Edit article' : 'Create article'}</h2>
          <label><span>Title</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label>
          <label><span>Slug</span><input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} /></label>
          <label><span>Excerpt</span><textarea value={draft.excerpt} onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })} required /></label>
          <label><span>HTML content</span><textarea rows={10} value={draft.contentHtml} onChange={(event) => setDraft({ ...draft, contentHtml: event.target.value })} required /></label>
          <label>
            <span>Cover image</span>
            <select value={draft.coverImage} onChange={(event) => setDraft({ ...draft, coverImage: event.target.value })}>
              <option value="">Auto / default cover</option>
              {coverImages.map((asset) => <option key={asset.name} value={asset.url}>{asset.name}</option>)}
            </select>
          </label>
          <label><span>Tags</span><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="affiliate marketing, AI side hustles" /></label>
          <button disabled={busy}><Save size={16} /> Save article</button>
        </form>
        <section
          className="admin-list"
          style={editorPanelHeight ? ({ '--editor-panel-height': `${editorPanelHeight}px` } as CSSProperties) : undefined}
        >
          <h2>Articles</h2>
          <div className="admin-list-scroll">
            {posts.map((post) => (
              <article key={post.id}>
                <div><strong>{post.title}</strong><small>{post.slug}</small></div>
                <button onClick={() => {
                  setEditingSlug(post.slug);
                  setDraft({ title: post.title, slug: post.slug, excerpt: post.excerpt, contentHtml: post.contentHtml, status: post.status, tags: post.tags.join(', '), coverImage: post.coverImage || '' });
                }}><FilePlus size={16} /> Edit</button>
                <button onClick={() => removePost(post.slug)}><Trash2 size={16} /> Delete</button>
              </article>
            ))}
          </div>
        </section>
      </section>
      <section className="settings-panel media-panel">
        <div className="media-panel-head">
          <div>
            <h2>Cover images</h2>
            <p>Uploaded images are used randomly for newly generated articles.</p>
          </div>
          <label className="upload-button">
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadCoverImage} disabled={busy} />
            <FilePlus size={16} /> Upload image
          </label>
        </div>
        <div className="media-grid">
          {coverImages.map((asset) => (
            <article key={asset.name} className="media-card">
              <img src={assetUrl(asset.url)} alt="" />
              <div>
                <strong>{asset.name}</strong>
                <small>{Math.max(1, Math.round(asset.size / 1024))} KB</small>
              </div>
              <button onClick={() => removeCoverImage(asset.name)} disabled={busy}><Trash2 size={16} /> Delete</button>
            </article>
          ))}
          {!coverImages.length && <p className="empty-note">No uploaded cover images yet.</p>}
        </div>
      </section>
      {settings && (
        <section className="settings-panel">
          <h2>AI generation settings</h2>
          <label><span>Master prompt</span><textarea rows={7} value={settings.masterPrompt} onChange={(event) => setSettings({ ...settings, masterPrompt: event.target.value })} /></label>
          <div className="settings-row">
            <label>
              <span>Schedule mode</span>
              <select value={settings.generationMode || settings.generationFrequency} onChange={(event) => setSettings({ ...settings, generationMode: event.target.value as 'daily' | 'weekly', generationFrequency: event.target.value as 'daily' | 'weekly' })}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            <label>
              <span>How many times</span>
              <input type="number" min={1} max={12} value={settings.generationCount || 1} onChange={(event) => updateGenerationCount(Number(event.target.value))} />
            </label>
          </div>
          <div>
            <span className="field-title">Generation times</span>
            <div className="time-grid">
              {(settings.generationTimes?.length ? settings.generationTimes : [settings.generationTime || '08:00']).slice(0, settings.generationCount || 1).map((time, index) => (
                <TimePicker key={index} label={`Run ${index + 1}`} value={time} onChange={(value) => updateGenerationTime(index, value)} />
              ))}
            </div>
          </div>
          {(settings.generationMode || settings.generationFrequency) === 'weekly' && (
            <div>
              <span className="field-title">Weekdays</span>
              <div className="weekday-grid">
                {weekdays.map((day) => (
                  <label key={day.value} className="weekday-option">
                    <input type="checkbox" checked={(settings.generationWeekdays || [1]).includes(day.value)} onChange={() => toggleWeekday(day.value)} />
                    {day.label}
                  </label>
                ))}
              </div>
            </div>
          )}
          <label className="checkbox"><input type="checkbox" checked={settings.autoGenerationEnabled} onChange={(event) => setSettings({ ...settings, autoGenerationEnabled: event.target.checked })} /> Auto generation enabled</label>
          <button onClick={saveSettings}><Save size={16} /> Save settings</button>
        </section>
      )}
    </main>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <form className="footer-signup">
          <p><span><DollarSign size={18} /></span> your weekly money signal</p>
          <label>
            <span className="sr-only">Email</span>
            <input type="email" placeholder="Enter your email" />
          </label>
          <button type="button">Subscribe</button>
        </form>
        <p className="footer-consent">By subscribing, you agree to receive our weekly newsletter.<br />You can unsubscribe at any time.</p>
        <div className="footer-bottom">
          <div className="footer-notes">
            <span># sharp essays by Andrew Nickolson</span>
            <span><Mail size={14} /> get in touch</span>
            <span>© makemoney or die</span>
          </div>
          <nav className="footer-links" aria-label="Footer">
            <a href="/terms">Terms of Use</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/cookies">Cookie Policy</a>
          </nav>
          <button className="back-top" type="button" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <ArrowUp size={22} />
          </button>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const [route, setRoute] = useState(() => `${window.location.pathname}${window.location.search}`);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const syncRoute = () => setRoute(`${window.location.pathname}${window.location.search}`);
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('app:navigate', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('app:navigate', syncRoute);
    };
  }, []);

  useEffect(() => {
    getPosts().then(setPosts).catch((err) => setError(err instanceof Error ? err.message : 'Could not load articles.'));
  }, []);

  const articles = posts.map(toArticle);
  const [path] = route.split('?');
  const searchParams = new URLSearchParams(route.includes('?') ? route.slice(route.indexOf('?')) : '');
  const initialSearch = searchParams.get('search') || '';
  const slug = path.startsWith('/articles/') ? decodeURIComponent(path.replace('/articles/', '')) : '';
  const article = slug ? articles.find((item) => item.slug === slug) : undefined;

  useEffect(() => {
    if (!slug || article || posts.length === 0) return;
    getPost(slug).then((post) => setPosts((current) => current.some((item) => item.slug === post.slug) ? current : [post, ...current])).catch(() => undefined);
  }, [slug, article, posts.length]);

  return (
    <>
      <Header />
      {error && <div className="load-error">{error}</div>}
      {path === '/admin' ? <AdminPanel /> : path === '/about' ? <AboutPage /> : path === '/articles' ? <ArticlesPage articles={articles} initialQuery={initialSearch} /> : slug ? <ArticlePage article={article} /> : <HomePage articles={articles} />}
      {path !== '/admin' && <Footer />}
    </>
  );
}

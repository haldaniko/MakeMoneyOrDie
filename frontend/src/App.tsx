import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowUp, ChevronDown, FilePlus, Mail, Menu, Moon, RefreshCw, Save, Search, Trash2, Wand2, X } from 'lucide-react';
import { assetUrl, getPost, getPosts, request, subscribe, unsubscribe } from './api';
import type { AdminSettings, Article, Post } from './domain';

const covers = ['/covers/cover1.png', '/covers/cover2.png', '/covers/cover3.png', '/covers/cover4.png'];
const demoTags = [
  ['Make Money Online'],
  ['Behavioral Economics'],
  ['Side Hustles', 'Make Money Online'],
  ['Make Money Online'],
  ['Make Money Online'],
  ['Attention Strategy'],
  ['Digital Products'],
  ['Behavioral Economics'],
  ['Side Hustles'],
];
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
  contentHtml: index === 1
    ? `<h2>Titles are very important for bulleting</h2><p>Money responds to repeatable choices more reliably than it responds to a burst of motivation. A useful plan starts with the bills that return every month, the work you can do consistently, and the time you can protect. When those pieces are visible, you can build small systems for earning, saving, and learning that still run on an ordinary Tuesday. The goal is to make progress possible even when your energy is limited and your attention is elsewhere. Put recurring tasks on a calendar, write down the numbers you need to watch, and decide in advance what you will do when a week does not go to plan.</p><p>Start with one habit you can measure and one offer you can improve. Keep the process simple enough to repeat after a long day. Review what actually happened each week, adjust the parts that create friction, and give the useful parts time to compound. Structure will not make every decision easy, but it can make the next good decision much easier to take. Over time, those small decisions create room for better work and more financial options. Keep a short record of outcomes so you can tell which routines actually help and which merely feel productive. That record gives you a better starting point every month.</p>`
    : `<p>Sharp essays on money, attention, and the uncomfortable math of making your own future.</p>`,
  status: 'published',
  author: 'Andrew Nickolson',
  tags: demoTags[index],
  seoTitle: null,
  seoDescription: null,
  coverImage: null,
  source: 'legacy',
  createdAt: index === 1 ? '2025-08-12T12:00:00.000Z' : new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  cover: index === 1 ? '/design-assets/article-cover.png' : covers[index % covers.length],
  category: demoTags[index][0],
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
const categories = ['Make Money Online', 'Attention Strategy', 'Digital Products', 'Behavioral Economics', 'Side Hustles'] as const;
type Category = (typeof categories)[number];
const categoryTags: Record<Category, string[]> = {
  'Make Money Online': ['make money online', 'online income', 'income', 'business', 'businesses', 'affiliate marketing', 'freelancing'],
  'Attention Strategy': ['attention', 'attention strategy', 'attention economics', 'content strategy', 'marketing'],
  'Digital Products': ['digital product', 'digital products', 'ecommerce', 'online courses', 'digital downloads'],
  'Behavioral Economics': ['behavioral economics', 'behavioural economics', 'behavioral finance', 'psychology'],
  'Side Hustles': ['side hustle', 'side hustles', 'gig work', 'freelancing'],
};

function isCategory(value: string | null): value is Category {
  return categories.some((category) => category === value);
}

function matchesCategory(article: Article, category: Category) {
  return [...article.tags, article.category].some((tag) => {
    const normalized = tag.trim().toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
    return categoryTags[category].some((alias) => normalized === alias || normalized.startsWith(`${alias} `) || normalized.endsWith(` ${alias}`));
  });
}
const hourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const minuteOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

type DraftPost = {
  title: string;
  slug: string;
  excerpt: string;
  contentHtml: string;
  status: 'draft' | 'published';
  category: string;
  tags: string;
  coverImage: string;
};

type MediaAsset = {
  name: string;
  url: string;
  size: number;
  createdAt: string;
};

type SubscriberRecord = {
  email: string;
  createdAt: string;
};

const emptyDraft: DraftPost = { title: '', slug: '', excerpt: '', contentHtml: '<h2>Introduction</h2><p></p>', status: 'published', category: '', tags: '', coverImage: '' };

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

type MagazineItem = { article: Article; originalIndex: number; image: boolean };

function seededIndex(seed: number, value: string, length: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return (hash >>> 0) % length;
}

function makeMagazineColumns(articles: Article[], seed: number): MagazineItem[][] {
  const columns: MagazineItem[][] = [[], [], []];
  if (articles.length === 0) return columns;
  articles.forEach((article, originalIndex) => {
    columns[originalIndex % 3].push({ article, originalIndex, image: false });
  });

  const signature = articles.map((article) => article.id).join('|');
  let chosenMask = 0;
  let lowestScore = Number.POSITIVE_INFINITY;

  for (let mask = 1; mask < 8; mask += 1) {
    if (columns.some((column, index) => column.length === 0 && (mask & (1 << index)))) continue;
    const imageCount = columns.reduce((count, _, index) => count + Number(Boolean(mask & (1 << index))), 0);
    if (articles.length > 1 && imageCount === articles.length) continue;

    const heights = columns.flatMap((column, index) => column.length
      ? [column.length * 166 + (column.length - 1) * 16 + (mask & (1 << index) ? 224 : 0)]
      : []);
    const heightDifference = Math.max(...heights) - Math.min(...heights);
    const score = heightDifference + Math.abs(imageCount - articles.length / 3) * 80;
    const tieBreak = seededIndex(seed, `${signature}:${mask}`, 1000) / 1000;
    if (score + tieBreak < lowestScore) {
      lowestScore = score + tieBreak;
      chosenMask = mask;
    }
  }

  columns.forEach((column, index) => {
    if (column.length && chosenMask & (1 << index)) {
      column[seededIndex(seed, `${signature}:${index}`, column.length)].image = true;
    }
  });
  return columns;
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

function articlePreview(article: Article) {
  const document = new DOMParser().parseFromString(article.contentHtml, 'text/html');
  const firstParagraph = Array.from(document.querySelectorAll('p'))
    .map((paragraph) => paragraph.textContent?.trim())
    .find(Boolean);
  const text = (firstParagraph || article.excerpt || '').replace(/\s+/g, ' ').trim();
  if (text.length <= 130) return text;
  const wordEnd = text.lastIndexOf(' ', 130);
  return `${text.slice(0, wordEnd > 90 ? wordEnd : 130)}…`;
}

function ShareBar({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const absoluteUrl = typeof window !== "undefined" ? new URL(url, window.location.origin).href : url;
  const shareText = `${title} ${absoluteUrl}`;
  const encodedUrl = encodeURIComponent(absoluteUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedShareText = encodeURIComponent(shareText);
  const targets = [
    { label: "Threads", icon: "/design-assets/social/threads.svg", href: `https://www.threads.net/intent/post?text=${encodedShareText}` },
    { label: "Facebook", icon: "/design-assets/social/facebook.svg", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { label: "X", icon: "/design-assets/social/x.svg", href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
    { label: "WhatsApp", icon: "/design-assets/social/whatsapp.svg", href: `https://wa.me/?text=${encodedShareText}` },
  ];

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <aside className="share-bar" aria-label="Share this post">
      <span className="share-label">share to</span>
      <div className="share-actions">
        {targets.map((target) => (
          <a key={target.label} className="share-link" href={target.href} target="_blank" rel="noreferrer" aria-label={`Share on ${target.label}`}>
            <img src={target.icon} alt="" />
          </a>
        ))}
        <button className="share-link" type="button" onClick={copyLink} aria-label={copied ? 'Link copied' : 'Copy article link'}>
          <img src="/design-assets/social/link.svg" alt="" />
        </button>
      </div>
      <span className="sr-only" aria-live="polite">{copied ? 'Link copied' : ''}</span>
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
        <button className="brand" onClick={() => go('/')}>makemoneyordie</button>
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

function ArticleCard({ article, image = false, className = '', order, showPreview = false }: { article: Article; image?: boolean; className?: string; order?: number; showPreview?: boolean }) {
  return (
    <article
      className={`article-card${image ? ' with-image' : ''}${className ? ` ${className}` : ''}`}
      style={order === undefined ? undefined : { order }}
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
          <img className="card-cover" src={article.cover} alt="" loading="lazy" />
        </span>
      )}
      <div className="card-body">
        <h3>{article.title}</h3>
        {showPreview && <p className="card-preview">{articlePreview(article)}</p>}
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
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [visibleArticleCount, setVisibleArticleCount] = useState(9);
  const [layoutSeed] = useState(() => Math.floor(Math.random() * 0xffffffff));
  const displayArticles = articles.length ? articles : demoArticles;
  const featured = displayArticles.slice(0, 3);
  const categoryArticles = activeCategory ? displayArticles.filter((article) => matchesCategory(article, activeCategory)) : displayArticles;
  const magazineColumns: MagazineItem[][] = [[], [], []];
  for (let start = 0; start < categoryArticles.length; start += 9) {
    const batchColumns = makeMagazineColumns(categoryArticles.slice(start, start + 9), layoutSeed + start);
    batchColumns.forEach((column, columnIndex) => {
      magazineColumns[columnIndex].push(...column.map((item) => ({ ...item, originalIndex: item.originalIndex + start })));
    });
  }
  const visibleColumns = magazineColumns.map((column) => column.filter(({ originalIndex }) => originalIndex < visibleArticleCount));

  return (
    <>
      <main className="home-page shell">
        <section className="home-hero">
          <h1>Build leverage before the rent<br className="hero-title-break" /> reminder does it for you.</h1>
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
                  <img src="/design-assets/author-image.png" alt="Andrew Nickolson" />
                  <div>
                    <h3>Andrew Nickolson</h3>
                    <p>Writer, operator, and systems thinker.</p>
                    <h4>Specialization</h4>
                    <p>Side hustles, online businesses, content systems, AI-assisted publishing, behavioral economics, and the small decisions that compound into financial options.</p>
                  </div>
                </div>
                <div className="author-stats">
                  <span><img className="mini-badge" src="/design-assets/badge-check.svg" alt="" /> publisher of a month</span>
                  <span><img className="mini-badge flag" src="/design-assets/flag.svg" alt="" /> 15 years in business</span>
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
            <img src="/design-assets/newsletter-photo.png" alt="" />
          </div>
          <div className="subscribe-panel">
            <p className="section-kicker"><img src="/design-assets/more-button.svg" alt="" /> stay updated</p>
            <h2>Read what matters.</h2>
            <Newsletter />
            <p className="consent-copy">By subscribing, you agree to receive our weekly newsletter. You can unsubscribe at any time.</p>
          </div>
        </section>

        <section className="home-placement-placeholder" aria-label="Advertisement placeholder">place for ads</section>

        <section className="article-section">
          <div className="article-section-head">
            <h2 aria-live="polite">{categoryArticles.length} {categoryArticles.length === 1 ? 'article' : 'articles'}</h2>
            <div className="category-tools">
              <span>browse by category:</span>
              <button className={`tag-pill category-reset${activeCategory === null ? ' active' : ''}`} type="button" aria-pressed={activeCategory === null} onClick={() => { setActiveCategory(null); setVisibleArticleCount(9); }}>Popular Now</button>
            </div>
          </div>
          <div className="category-row">
            {categories.map((category) => <button key={category} className={`category-chip${activeCategory === category ? ' is-active' : ''}`} type="button" aria-pressed={activeCategory === category} onClick={() => { setActiveCategory((current) => current === category ? null : category); setVisibleArticleCount(9); }}>{category}</button>)}
          </div>
          {activeCategory && <p className="category-status">Showing {activeCategory}</p>}
          {categoryArticles.length ? (
            <div className="magazine-grid">
              {visibleColumns.map((column, index) => (
                <div className="magazine-column" key={index}>
                  {column.map(({ article, originalIndex, image }) => (
                    <ArticleCard key={article.id} article={article} image={image} order={originalIndex} />
                  ))}
                </div>
              ))}
            </div>
          ) : <p className="category-empty">No articles in this category yet. Choose another category or <button type="button" onClick={() => { setActiveCategory(null); setVisibleArticleCount(9); }}>view popular articles</button>.</p>}
          <div className="quote-row">
            <img src="/design-assets/author-image.png" alt="Andrew Nickolson" />
            <div>
              <strong>Andrew Nickolson</strong>
              <p>"The internet did not create new opportunities. It removed the receptionist."</p>
            </div>
            {visibleArticleCount < categoryArticles.length && (
              <button className="load-more" type="button" onClick={() => setVisibleArticleCount((count) => Math.min(count + 9, categoryArticles.length))}>
                Load More <ChevronDown size={18} />
              </button>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

function ArticlesPage({ articles, initialQuery = '', initialCategory = '' }: { articles: Article[]; initialQuery?: string; initialCategory?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const category = isCategory(initialCategory) ? initialCategory : null;

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return articles.filter((article) => (!category || matchesCategory(article, category)) && (!q || [article.title, article.excerpt, article.category, ...article.tags].join(' ').toLowerCase().includes(q)));
  }, [articles, category, query]);

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
          <input type="search" aria-label="Search articles" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search side hustles, leverage, attention..." />
        </label>
      </div>
      {category && <div className="archive-filter-summary"><span aria-live="polite">{filtered.length} {filtered.length === 1 ? 'article' : 'articles'} in {category}</span><button type="button" onClick={() => navigate(query.trim() ? `/articles?search=${encodeURIComponent(query.trim())}` : '/articles')}>Clear category</button></div>}
      {filtered.length === 0 && <p className="category-empty">No articles found. Try another search or category.</p>}
      <ArticleGrid articles={filtered} />
    </main>
  );
}

function ArticlePage({ article, relatedArticles }: { article?: Article; relatedArticles: Article[] }) {
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

  const publishedAt = new Date(article.createdAt);
  const publishedDate = Number.isNaN(publishedAt.getTime())
    ? ''
    : `${publishedAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}, ${publishedAt.getFullYear()}`;

  return (
    <main className="shell article-page">
      <header className="article-intro">
        <h1>{article.title}</h1>
        <div className="article-cover"><img src={article.cover} alt="" /></div>
        <div className="article-author">
          <img src="/design-assets/author-image.png" alt="" />
          <div><span>Author</span><strong>{article.author}</strong></div>
        </div>
        <div className="article-details">
          <span className="tag-pill">{article.category}</span>
          <time dateTime={article.createdAt}>{publishedDate}</time>
          <span>{article.readingTime} Min Read</span>
        </div>
      </header>
      <div className="article-content-layout">
        <div className="article-main">
          <article className="markdown" dangerouslySetInnerHTML={{ __html: article.contentHtml }} />
          <aside className="article-placement-placeholder" aria-label="Advertisement placeholder">ADVERT</aside>
        </div>
        <aside className="article-sidebar">
          <ShareBar title={article.title} url={`/articles/${article.slug}`} />
          <section className="related-articles" aria-labelledby="related-title">
            <h2 id="related-title">related articles</h2>
            <div className="related-list">
              {relatedArticles.map((related) => <ArticleCard key={related.id} article={related} showPreview />)}
            </div>
          </section>
        </aside>
      </div>
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [coverImages, setCoverImages] = useState<MediaAsset[]>([]);
  const [subscribers, setSubscribers] = useState<SubscriberRecord[]>([]);
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
    const [loadedPosts, loadedSettings, loadedCoverImages, loadedSubscribers] = await Promise.all([
      request<Post[]>('/api/admin/posts', {}, nextToken),
      request<AdminSettings>('/api/admin/settings', {}, nextToken),
      request<MediaAsset[]>('/api/admin/media/covers', {}, nextToken),
      request<SubscriberRecord[]>('/api/admin/subscribers', {}, nextToken),
    ]);
    setPosts(loadedPosts);
    setSettings(loadedSettings);
    setCoverImages(loadedCoverImages);
    setSubscribers(loadedSubscribers);
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
      const { category, ...postDraft } = draft;
      const tags = draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
      const body = {
        ...postDraft,
        coverImage: draft.coverImage || null,
        tags: category ? [category, ...tags.filter((tag) => tag.toLowerCase() !== category.toLowerCase())] : tags,
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
    setBusy(true);
    try {
      const saved = await request<AdminSettings>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }, token);
      setSettings(saved);
      setMessage('Settings saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save settings.');
    } finally {
      setBusy(false);
    }
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
          <label><span>Email or username</span><input value={email} autoComplete="username" onChange={(event) => setEmail(event.target.value)} required /></label>
          <label><span>Password</span><input type="password" value={password} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required /></label>
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
          <label><span>Category</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option value="">Choose a category</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
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
                  const category = categories.find((candidate) => post.tags.some((tag) => tag.toLowerCase() === candidate.toLowerCase())) || '';
                  setEditingSlug(post.slug);
                  setDraft({ title: post.title, slug: post.slug, excerpt: post.excerpt, contentHtml: post.contentHtml, status: post.status, category, tags: post.tags.filter((tag) => tag.toLowerCase() !== category.toLowerCase()).join(', '), coverImage: post.coverImage || '' });
                }}><FilePlus size={16} /> Edit</button>
                <button onClick={() => removePost(post.slug)}><Trash2 size={16} /> Delete</button>
              </article>
            ))}
          </div>
        </section>
      </section>
      <section className="settings-panel subscribers-panel">
        <h2>Newsletter subscribers <span>{subscribers.length}</span></h2>
        {subscribers.length ? (
          <div className="subscribers-list">
            {subscribers.map((subscriber) => (
              <div key={subscriber.email}>
                <span>{subscriber.email}</span>
                <time dateTime={subscriber.createdAt}>{new Date(subscriber.createdAt).toLocaleDateString()}</time>
              </div>
            ))}
          </div>
        ) : <p className="empty-note">No subscribers yet.</p>}
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
          <div className="settings-row">
            <label><span>OpenRouter API key {settings.hasOpenRouterApiKey && '(saved)'}</span><input type="password" autoComplete="new-password" placeholder={settings.hasOpenRouterApiKey ? 'Leave blank to keep current key' : 'Enter API key'} value={settings.openRouterApiKey} onChange={(event) => setSettings({ ...settings, openRouterApiKey: event.target.value, clearOpenRouterApiKey: false })} /></label>
            <label><span>OpenRouter model</span><input value={settings.openRouterModel} onChange={(event) => setSettings({ ...settings, openRouterModel: event.target.value })} /></label>
          </div>
          {settings.hasOpenRouterApiKey && <label className="checkbox"><input type="checkbox" checked={Boolean(settings.clearOpenRouterApiKey)} onChange={(event) => setSettings({ ...settings, clearOpenRouterApiKey: event.target.checked, openRouterApiKey: '' })} /> Remove saved API key</label>}
          <div className="settings-row">
            <label><span>Site URL sent to OpenRouter</span><input type="url" value={settings.openRouterSiteUrl} onChange={(event) => setSettings({ ...settings, openRouterSiteUrl: event.target.value })} /></label>
            <label><span>Schedule timezone</span><input value={settings.timezone} onChange={(event) => setSettings({ ...settings, timezone: event.target.value })} placeholder="Europe/Sofia" /></label>
          </div>
          <div className="settings-row">
            <label><span>Request timeout (ms)</span><input type="number" min={5000} max={180000} value={settings.openRouterTimeoutMs} onChange={(event) => setSettings({ ...settings, openRouterTimeoutMs: Number(event.target.value) })} /></label>
            <label><span>Retry attempts</span><input type="number" min={1} max={5} value={settings.openRouterRetryAttempts} onChange={(event) => setSettings({ ...settings, openRouterRetryAttempts: Number(event.target.value) })} /></label>
          </div>
          <div className="settings-row">
            <label><span>Max prompt characters</span><input type="number" min={1000} max={100000} value={settings.openRouterMaxInputChars} onChange={(event) => setSettings({ ...settings, openRouterMaxInputChars: Number(event.target.value) })} /></label>
            <label><span>Max output tokens</span><input type="number" min={256} max={32000} value={settings.openRouterMaxOutputTokens} onChange={(event) => setSettings({ ...settings, openRouterMaxOutputTokens: Number(event.target.value) })} /></label>
            <label><span>Temperature</span><input type="number" min={0} max={2} step={0.1} value={settings.openRouterTemperature} onChange={(event) => setSettings({ ...settings, openRouterTemperature: Number(event.target.value) })} /></label>
          </div>
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
          <button onClick={saveSettings} disabled={busy}><Save size={16} /> Save settings</button>
        </section>
      )}
    </main>
  );
}

type PolicyKind = 'terms' | 'privacy' | 'cookies';
type AnalyticsConsent = 'analytics' | 'essential' | null;

const GOOGLE_ANALYTICS_ID = 'G-LSPQ8685TS';
const CONSENT_COOKIE = 'mmd_cookie_consent';
const CONSENT_MAX_AGE = 60 * 60 * 24 * 180;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function readAnalyticsConsent(): AnalyticsConsent {
  const consent = document.cookie.split('; ').find((value) => value.startsWith(`${CONSENT_COOKIE}=`))?.split('=')[1];
  return consent === 'analytics' || consent === 'essential' ? consent : null;
}

function writeAnalyticsConsent(consent: Exclude<AnalyticsConsent, null>) {
  const sharedDomain = window.location.hostname.endsWith('makemoneyordie.com') ? '; Domain=.makemoneyordie.com' : '';
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${consent}; Max-Age=${CONSENT_MAX_AGE}; Path=/${sharedDomain}; SameSite=Lax${secure}`;
}

function removeAnalyticsCookies() {
  const analyticsCookies = document.cookie.split(';').map((cookie) => cookie.trim().split('=')[0])
    .filter((name) => /^_ga(?:_|$)/.test(name) || /^_gid$/.test(name) || /^_gat/.test(name));
  const domains = ['', '; Domain=.makemoneyordie.com'];
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  analyticsCookies.forEach((name) => domains.forEach((domain) => {
    document.cookie = `${name}=; Max-Age=0; Path=/${domain}; SameSite=Lax${secure}`;
  }));
}

function setGoogleAnalyticsConsent(granted: boolean) {
  if (!window.gtag) {
    if (!granted) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
    window.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    window.gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    window.gtag('js', new Date());
    window.gtag('config', GOOGLE_ANALYTICS_ID);
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`;
    document.head.appendChild(script);
    return;
  }

  window.gtag('consent', 'update', {
    analytics_storage: granted ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  if (!granted) removeAnalyticsCookies();
}

const policyTitles: Record<PolicyKind, string> = {
  terms: 'Terms of Use',
  privacy: 'Privacy Policy',
  cookies: 'Cookie Policy',
};

function PolicyDialog({ policy, onClose, onSetAnalyticsConsent, analyticsConsent }: {
  policy: PolicyKind | null;
  onClose: () => void;
  onSetAnalyticsConsent: (granted: boolean) => void;
  analyticsConsent: AnalyticsConsent;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (policy && dialog && !dialog.open) dialog.showModal();
    if (!policy && dialog?.open) dialog.close();
  }, [policy]);

  async function submitUnsubscribe(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await unsubscribe(email);
      setEmail('');
      setMessage('Your newsletter subscription has been removed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not remove the subscription.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="policy-dialog" onClose={onClose} onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }} aria-labelledby="policy-title">
      {policy && <div className="policy-dialog-inner">
        <header className="policy-dialog-header">
          <h2 id="policy-title">{policyTitles[policy]}</h2>
          <button type="button" aria-label="Close policy" onClick={() => dialogRef.current?.close()}><X size={20} /></button>
        </header>
        <div className="policy-dialog-body">
          {policy === 'terms' && <>
            <p className="policy-updated">Effective date: 5 October 2026</p>
            <section><h3>1. About these terms</h3><p>These Terms of Use govern your access to makemoneyordie.com and its articles, newsletter features, and related services (the “Site”). By using the Site, you agree to these terms. If you do not agree, please discontinue use. “We”, “us”, and “our” refer to the operator of the Site.</p></section>
            <section><h3>2. Educational content, not professional advice</h3><p>The Site publishes general educational and editorial material about money, business, online work, and related topics. It is not financial, investment, tax, accounting, legal, or other professional advice, and it is not tailored to your circumstances. You are responsible for evaluating information and decisions. Seek advice from a suitably qualified professional before acting where appropriate. We make no promise of income, profit, or any particular result.</p></section>
            <section><h3>3. Content and intellectual property</h3><p>Unless otherwise stated, Site text, design, branding, and other materials are owned by or licensed to the Site operator and are protected by applicable intellectual-property laws. You may access the Site and share links for personal, non-commercial use. You may not republish substantial content, sell or commercially exploit it, or remove attribution without prior written permission, except where applicable law permits.</p></section>
            <section><h3>4. Acceptable use</h3><p>You must not use the Site unlawfully, attempt to gain unauthorised access, interfere with its operation, introduce malicious code, or use automated means in a way that places an unreasonable burden on the service. We may restrict access where reasonably necessary to protect the Site, users, or our legal rights.</p></section>
            <section><h3>5. Third-party services and links</h3><p>The Site may link to third-party websites or services. We do not control their content, availability, or privacy practices and are not responsible for them. Your use of those services is governed by their own terms and policies. Any commercial, sponsored, or affiliate relationship will be identified where required by law.</p></section>
            <section><h3>6. Availability and liability</h3><p>We aim to keep the Site available and information current, but do not guarantee uninterrupted access, completeness, or accuracy. To the extent permitted by law, the Site is provided without warranties not expressly stated here. Nothing in these terms excludes or limits liability that cannot lawfully be excluded or limited, including liability for fraud, wilful misconduct, or rights you have as a consumer under mandatory law.</p></section>
            <section><h3>7. Changes and governing law</h3><p>We may revise these terms by publishing an updated version on the Site. Changes apply from the stated effective date. These terms are governed by the law applicable to the Site operator, without limiting any mandatory consumer protections available to you in your country of residence.</p></section>
          </>}
          {policy === 'privacy' && <>
            <p className="policy-updated">Effective date: 5 October 2026</p>
            <section><h3>1. Who is responsible for your data</h3><p>The data controller is <strong>[INSERT THE OPERATOR’S FULL LEGAL NAME]</strong>, operating the MakeMoneyOrDie website. Registered or business address: <strong>[INSERT POSTAL ADDRESS AND COUNTRY]</strong>. Privacy contact: <strong>[INSERT PRIVACY CONTACT EMAIL]</strong>. These operator details must be completed before this policy is published.</p></section>
            <section><h3>2. Data we collect and why</h3><p><strong>Newsletter:</strong> your email address and subscription date, to manage your subscription and send the newsletter. The legal basis is your consent, which you may withdraw at any time.</p><p><strong>Administrator accounts:</strong> account identifiers, authentication and refresh-session data, and security events, to operate and secure the publishing dashboard. The legal basis is our legitimate interest in administering and protecting the Site.</p><p><strong>Server and security data:</strong> technical request information such as IP address, browser details, and timestamps may be recorded by the hosting or reverse-proxy infrastructure to deliver the Site, diagnose faults, and protect it against abuse. The legal basis is our legitimate interest in maintaining a secure and reliable service.</p><p><strong>Analytics:</strong> if you consent, Google Analytics 4 may process online identifiers, device/browser information, and information about how you use the Site, to measure and improve its performance. The legal basis is your consent. Analytics is not loaded before you opt in.</p></section>
            <section><h3>3. Newsletter choices</h3><p>You can unsubscribe at any time using the form below. We will remove your address from the active subscriber list. The Site stores subscriber addresses in its database; it does not send them to OpenRouter for article generation. Do not include personal or confidential information in article-generation prompts.</p></section>
            <section><h3>4. Service providers and international transfers</h3><p>We use hosting, database, and security providers to operate the Site. When an administrator uses the article-generation feature, the submitted prompt and related generation instructions are sent to OpenRouter and the selected model provider to generate content; do not include personal or confidential information in those prompts. If you allow analytics, Google Analytics is provided by Google. These providers process data under their applicable terms, and processing may take place outside the European Economic Area. Where required, international transfers rely on an applicable adequacy decision or appropriate safeguards. Read the <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a> and <a href="https://openrouter.ai/privacy" target="_blank" rel="noreferrer">OpenRouter Privacy Policy</a>. Contact the controller for information about the providers and safeguards applicable to this Site.</p></section>
            <section><h3>5. Retention</h3><p>Newsletter data is kept while your subscription is active and deleted from the active subscriber list after you unsubscribe, subject to any limited retention required by law. Administrator and security records are retained only as needed to manage accounts, maintain security, and meet legal obligations. Google Analytics retention is controlled in the Analytics property settings; the operator should set and periodically review an appropriate retention period.</p></section>
            <section><h3>6. Your rights</h3><p>Subject to applicable law, you may request access to, correction or deletion of your personal data, restriction of processing, or a portable copy. Where processing relies on consent, you may withdraw it at any time; withdrawal does not affect processing already carried out lawfully. You may object to processing based on legitimate interests. You also have the right to lodge a complaint with the data-protection supervisory authority in your place of residence, place of work, or the place of an alleged infringement.</p><p>To exercise your rights, contact the controller using the privacy contact details above. You may withdraw newsletter consent using the form below and change analytics consent through Cookie Settings.</p></section>
            <section><h3>7. Security and updates</h3><p>We use appropriate technical and organisational measures designed to protect personal data. No online service can guarantee absolute security. We may update this notice when our practices or legal requirements change; the effective date above will be revised.</p></section>
            <form className="policy-unsubscribe" onSubmit={submitUnsubscribe}>
              <label htmlFor="unsubscribe-email">Unsubscribe from the newsletter</label>
              <div><input id="unsubscribe-email" type="email" autoComplete="email" placeholder="Enter your email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} /><button type="submit" disabled={busy}>{busy ? 'Removing...' : 'Unsubscribe'}</button></div>
              {message && <p role="status">{message}</p>}
            </form>
          </>}
          {policy === 'cookies' && <>
            <p className="policy-updated">Effective date: 5 October 2026</p>
            <section><h3>How we use cookies</h3><p>Cookies and similar technologies are small pieces of information stored on your device. We use a necessary preference cookie to remember your cookie choice and an authentication cookie when an administrator signs in. Google Analytics cookies are optional and are set only after you choose “Accept analytics”. You can reject analytics without losing access to the Site.</p></section>
            <section><h3>Cookies used on this Site</h3><ul className="cookie-list"><li><strong>mmd_cookie_consent</strong> — remembers whether you accepted or rejected analytics; first-party; expires after 180 days; strictly necessary to store your privacy choice.</li><li><strong>refresh_token</strong> — keeps an administrator signed in; HTTP-only, Secure in production, SameSite=Strict, scoped to `/api/auth`; expires after up to 30 days or on sign-out; necessary for administrator authentication.</li><li><strong>_ga</strong> and <strong>_ga_*</strong> — Google Analytics 4 identifiers used to distinguish users and preserve session state; optional analytics cookies; default expiry is up to 2 years, subject to browser limits and Google Analytics settings. They are not set unless you accept analytics.</li></ul></section>
            <section><h3>Manage or withdraw consent</h3><p>Your current choice: <strong>{analyticsConsent === 'analytics' ? 'Analytics accepted' : analyticsConsent === 'essential' ? 'Analytics rejected' : 'No choice saved'}</strong>. You can change it at any time. Rejecting analytics prevents the Google tag from loading on your next visit; if you withdraw after accepting, we update the consent state and remove accessible Google Analytics cookies.</p><div className="cookie-actions"><button type="button" className="cookie-choice-secondary" onClick={() => { onSetAnalyticsConsent(false); dialogRef.current?.close(); }}>Reject analytics</button><button type="button" className="cookie-choice-primary" onClick={() => { onSetAnalyticsConsent(true); dialogRef.current?.close(); }}>Accept analytics</button></div></section>
            <section><h3>Third-party information</h3><p>Google describes its GA4 cookies and their default lifetimes in its <a href="https://support.google.com/analytics/answer/11397207" target="_blank" rel="noreferrer">Analytics cookie documentation</a>. You can also control cookies through your browser, but blocking necessary cookies may prevent administrator sign-in.</p></section>
          </>}
        </div>
      </div>}
    </dialog>
  );
}

function CookieConsentBanner({ onAccept, onReject, onDetails }: { onAccept: () => void; onReject: () => void; onDetails: () => void }) {
  return (
    <aside className="cookie-consent-banner" aria-label="Cookie preferences" aria-live="polite">
      <div className="cookie-consent-copy">
        <strong>Your privacy choices</strong>
        <p>We use necessary cookies for sign-in and to remember your choice. With your permission, Google Analytics uses optional cookies to measure site visits. Analytics stays off unless you accept.</p>
      </div>
      <div className="cookie-consent-actions">
        <button className="cookie-choice-secondary" type="button" onClick={onReject}>Reject analytics</button>
        <button className="cookie-choice-secondary" type="button" onClick={onDetails}>Cookie details</button>
        <button className="cookie-choice-primary" type="button" onClick={onAccept}>Accept analytics</button>
      </div>
    </aside>
  );
}

function Footer({ initialPolicy = null }: { initialPolicy?: PolicyKind | null }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [policy, setPolicy] = useState<PolicyKind | null>(initialPolicy);
  const [analyticsConsent, setAnalyticsConsent] = useState<AnalyticsConsent>(null);
  const [consentLoaded, setConsentLoaded] = useState(false);
  const [consentPanelOpen, setConsentPanelOpen] = useState(false);

  useEffect(() => {
    const savedConsent = readAnalyticsConsent();
    setAnalyticsConsent(savedConsent);
    setConsentPanelOpen(savedConsent === null);
    setConsentLoaded(true);
    if (savedConsent === 'analytics') setGoogleAnalyticsConsent(true);
  }, []);

  useEffect(() => {
    if (initialPolicy) setPolicy(initialPolicy);
  }, [initialPolicy]);

  function chooseAnalyticsConsent(granted: boolean) {
    const choice = granted ? 'analytics' : 'essential';
    writeAnalyticsConsent(choice);
    setAnalyticsConsent(choice);
    setConsentPanelOpen(false);
    setGoogleAnalyticsConsent(granted);
  }

  async function submitFooterSignup(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await subscribe(email);
      setEmail('');
      setMessage('You are subscribed. Thank you!');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not subscribe right now.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <><footer className="site-footer">
      <div className="shell footer-inner">
        <form className="footer-signup" onSubmit={submitFooterSignup}>
          <p><img src="/design-assets/weekly-money-signal.svg" alt="" /> your weekly money signal</p>
          <div className="footer-email-field">
            <label>
              <span className="sr-only">Email</span>
              <input type="email" autoComplete="email" placeholder="Enter your email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} />
            </label>
            <p className={`footer-signup-message${message && message !== 'You are subscribed. Thank you!' ? ' error' : ''}`} role="status">{message}</p>
          </div>
          <button type="submit" disabled={busy}>{busy ? 'Subscribing...' : 'Subscribe'}</button>
        </form>
        <p className="footer-consent">By subscribing, you agree to receive our weekly newsletter.<br />You can <button type="button" onClick={() => setPolicy('privacy')}>unsubscribe</button> at any time.</p>
        <div className="footer-bottom">
          <div className="footer-notes">
            <span># sharp essays by Andrew Nickolson</span>
            <span><Mail size={14} /> get in touch</span>
            <span>© makemoney or die</span>
          </div>
          <nav className="footer-links" aria-label="Footer">
            <button type="button" onClick={() => setPolicy('terms')}>Terms of Use</button>
            <button type="button" onClick={() => setPolicy('privacy')}>Privacy Policy</button>
            <button type="button" onClick={() => setPolicy('cookies')}>Cookie Policy</button>
            <button type="button" onClick={() => setConsentPanelOpen(true)}>Cookie settings</button>
          </nav>
          <button className="back-top" type="button" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <ArrowUp size={22} />
          </button>
        </div>
      </div>
    </footer>
    <PolicyDialog policy={policy} onClose={() => setPolicy(null)} onSetAnalyticsConsent={chooseAnalyticsConsent} analyticsConsent={analyticsConsent} />
    {consentLoaded && consentPanelOpen && <CookieConsentBanner
      onAccept={() => chooseAnalyticsConsent(true)}
      onReject={() => chooseAnalyticsConsent(false)}
      onDetails={() => { setConsentPanelOpen(false); setPolicy('cookies'); }}
    />}
    </>
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
    getPosts().then((loadedPosts) => { setPosts(loadedPosts); setError(''); }).catch((err) => setError(err instanceof Error ? err.message : 'Could not load articles.'));
  }, [route]);

  const articles = posts.length ? posts.map(toArticle) : demoArticles;
  const [path] = route.split('?');
  const searchParams = new URLSearchParams(route.includes('?') ? route.slice(route.indexOf('?')) : '');
  const initialSearch = searchParams.get('search') || '';
  const initialCategory = searchParams.get('category') || '';
  const initialPolicy: PolicyKind | null = path === '/terms' ? 'terms' : path === '/privacy' ? 'privacy' : path === '/cookies' ? 'cookies' : null;
  const slug = path.startsWith('/articles/') ? decodeURIComponent(path.replace('/articles/', '')) : '';
  const article = slug ? articles.find((item) => item.slug === slug) : undefined;
  const relatedArticles = [...articles, ...demoArticles]
    .filter((item, index, all) => item.slug !== slug && all.findIndex((candidate) => candidate.slug === item.slug) === index)
    .slice(0, 3);

  useEffect(() => {
    if (!slug || article || posts.length === 0) return;
    getPost(slug).then((post) => setPosts((current) => current.some((item) => item.slug === post.slug) ? current : [post, ...current])).catch(() => undefined);
  }, [slug, article, posts.length]);

  return (
    <>
      <Header />
      {error && <div className="load-error">{error}</div>}
      {path === '/admin' ? <AdminPanel /> : path === '/about' ? <AboutPage /> : path === '/articles' ? <ArticlesPage articles={articles} initialQuery={initialSearch} initialCategory={initialCategory} /> : slug ? <ArticlePage article={article} relatedArticles={relatedArticles} /> : <HomePage articles={articles} />}
      {path !== '/admin' && <Footer initialPolicy={initialPolicy} />}
    </>
  );
}

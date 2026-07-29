import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router';
import '../styles/landing.css';

const DOWNLOAD_URL = import.meta.env.VITE_VERSION_LINK?.trim();

const tickerItems = [
  ['graphic_eq', 'Canlı ses kanalları'],
  ['screen_share', 'Ekran paylaşımı'],
  ['forum', 'Anlık mesajlaşma'],
  ['groups', 'Klan toplulukları'],
  ['notifications_active', 'Akıllı bildirimler'],
];

const featureCards = [
  {
    className: 'landing-feature landing-feature--voice',
    eyebrow: 'CANLI SES',
    icon: 'spatial_audio_off',
    title: 'Sanki aynı odadaymışsınız gibi.',
    description: 'Kanalına gir, kulaklığını tak ve sohbete karış. Arama başlatmak, davet beklemek yok.',
    visual: 'voice',
  },
  {
    className: 'landing-feature landing-feature--screen',
    eyebrow: 'EKRAN PAYLAŞIMI',
    icon: 'present_to_all',
    title: 'Anlatmak yerine göster.',
    description: 'Oyunu, tasarımı ya da o komik anı tek dokunuşla ekrana taşı.',
    visual: 'screen',
  },
  {
    className: 'landing-feature landing-feature--messages',
    eyebrow: 'ANLIK MESAJLAR',
    icon: 'chat_bubble',
    title: 'Sohbet kaldığı yerden akar.',
    description: 'Kanallar, direkt mesajlar, GIF’ler ve bildirimler. Her şey kendi ritminde.',
    visual: 'messages',
  },
  {
    className: 'landing-feature landing-feature--control',
    eyebrow: 'TOPLULUK KONTROLÜ',
    icon: 'shield_person',
    title: 'Alan senin. Kurallar da senin.',
    description: 'Roller, özel kanallar ve klan yapısı ile topluluğunu tam istediğin gibi kur.',
    visual: 'control',
  },
];

function VoiceBars({ compact = false }) {
  return (
    <div className={`landing-voice-bars${compact ? ' landing-voice-bars--compact' : ''}`} aria-hidden="true">
      {Array.from({ length: compact ? 12 : 24 }, (_, index) => (
        <span
          key={index}
          style={{
            '--bar-index': index,
            '--bar-height': `${compact ? 6 + ((index * 7) % 21) : 10 + ((index * 13) % 42)}px`,
          }}
        />
      ))}
    </div>
  );
}

function ProductStage() {
  const stageRef = useRef(null);
  const frameRef = useRef(0);
  const boundsRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const finePointerRef = useRef(null);

  const handlePointerEnter = (event) => {
    finePointerRef.current ??= window.matchMedia('(pointer: fine)').matches;
    if (!finePointerRef.current) return;
    boundsRef.current = event.currentTarget.getBoundingClientRect();
  };

  const handlePointerMove = (event) => {
    finePointerRef.current ??= window.matchMedia('(pointer: fine)').matches;
    if (!finePointerRef.current) return;
    boundsRef.current ??= event.currentTarget.getBoundingClientRect();
    pointerRef.current = { x: event.clientX, y: event.clientY };
    if (frameRef.current) return;

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      const rect = boundsRef.current;
      if (!rect) return;
      const x = ((pointerRef.current.x - rect.left) / rect.width - 0.5) * 2;
      const y = ((pointerRef.current.y - rect.top) / rect.height - 0.5) * 2;
      stageRef.current?.style.setProperty('--stage-x', x.toFixed(3));
      stageRef.current?.style.setProperty('--stage-y', y.toFixed(3));
    });
  };

  const resetPointer = () => {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    boundsRef.current = null;
    stageRef.current?.style.setProperty('--stage-x', '0');
    stageRef.current?.style.setProperty('--stage-y', '0');
  };

  return (
    <div
      ref={stageRef}
      className="landing-product-stage"
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      aria-hidden="true"
    >
      <div className="landing-orbit landing-orbit--one" />
      <div className="landing-orbit landing-orbit--two" />
      <div className="landing-stage-glow" />

      <div className="landing-product-window">
        <div className="landing-product-topbar">
          <div className="landing-product-brand">
            <span className="landing-product-brand__mark">V</span>
            <span>VOXIFY</span>
          </div>
          <div className="landing-window-actions">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="landing-product-body">
          <aside className="landing-product-rail">
            <span className="landing-rail-item landing-rail-item--active">VX</span>
            <span className="landing-rail-item">NT</span>
            <span className="landing-rail-item">GD</span>
            <span className="landing-rail-add material-symbols-outlined">add</span>
          </aside>

          <aside className="landing-product-sidebar">
            <div className="landing-sidebar-title">
              <span>Gece Tayfası</span>
              <span className="material-symbols-outlined">expand_more</span>
            </div>
            <div className="landing-channel-label">SOHBET KANALLARI</div>
            <div className="landing-channel landing-channel--active">
              <span className="material-symbols-outlined">tag</span>
              genel
            </div>
            <div className="landing-channel">
              <span className="material-symbols-outlined">tag</span>
              oyun-gecesi
            </div>
            <div className="landing-channel-label landing-channel-label--voice">SES KANALLARI</div>
            <div className="landing-channel landing-channel--live">
              <span className="material-symbols-outlined">volume_up</span>
              Ateş Başı
              <i />
            </div>
            <div className="landing-voice-member"><span>AS</span>Asya</div>
            <div className="landing-voice-member"><span>MK</span>Mert</div>
            <div className="landing-voice-member"><span>DN</span>Deniz</div>
          </aside>

          <section className="landing-product-chat">
            <div className="landing-chat-header">
              <div><span className="material-symbols-outlined">tag</span>genel</div>
              <div className="landing-chat-header__actions">
                <span className="material-symbols-outlined">search</span>
                <span className="material-symbols-outlined">group</span>
              </div>
            </div>
            <div className="landing-chat-content">
              <div className="landing-demo-message">
                <span className="landing-demo-avatar landing-demo-avatar--cyan">A</span>
                <div>
                  <strong>Asya <small>bugün 21:04</small></strong>
                  <p>Herkes burada mı? Başlıyoruz 🎧</p>
                </div>
              </div>
              <div className="landing-demo-message">
                <span className="landing-demo-avatar landing-demo-avatar--blue">M</span>
                <div>
                  <strong>Mert <small>bugün 21:04</small></strong>
                  <p>Ses kanalındayım. Gelin!</p>
                </div>
              </div>
              <div className="landing-demo-share">
                <div className="landing-demo-share__top">
                  <span className="material-symbols-outlined">screen_share</span>
                  <span>Deniz ekranını paylaşıyor</span>
                  <b>CANLI</b>
                </div>
                <div className="landing-demo-share__screen">
                  <span className="landing-code-line landing-code-line--wide" />
                  <span className="landing-code-line" />
                  <span className="landing-code-line landing-code-line--accent" />
                  <div className="landing-demo-share__play material-symbols-outlined">play_arrow</div>
                </div>
              </div>
              <div className="landing-demo-composer">
                <span className="material-symbols-outlined">add_circle</span>
                <span>#genel kanalına mesaj gönder</span>
                <span className="material-symbols-outlined">sentiment_satisfied</span>
              </div>
            </div>
          </section>
        </div>

        <div className="landing-live-dock">
          <div className="landing-live-dock__person">
            <span className="landing-live-avatar">D<i /></span>
            <div><strong>Deniz konuşuyor</strong><small>Ateş Başı</small></div>
          </div>
          <VoiceBars compact />
          <div className="landing-live-actions">
            <span className="material-symbols-outlined">mic</span>
            <span className="material-symbols-outlined">headphones</span>
            <span className="material-symbols-outlined landing-live-actions__hang">call_end</span>
          </div>
        </div>
      </div>

      <div className="landing-float-card landing-float-card--quality">
        <span className="material-symbols-outlined">network_check</span>
        <div><small>BAĞLANTI</small><strong>Kristal netlik</strong></div>
      </div>
      <div className="landing-float-card landing-float-card--friends">
        <div className="landing-mini-stack"><span>A</span><span>M</span><span>D</span></div>
        <div><strong>3 arkadaş</strong><small>şu an seste</small></div>
      </div>
    </div>
  );
}

function FeatureVisual({ type }) {
  if (type === 'voice') {
    return (
      <div className="landing-feature-voice" aria-hidden="true">
        <div className="landing-feature-voice__people">
          <span className="landing-person landing-person--one">A<i /></span>
          <span className="landing-person landing-person--two">M</span>
          <span className="landing-person landing-person--three">D</span>
        </div>
        <VoiceBars />
        <div className="landing-feature-voice__status"><i /> 3 kişi konuşuyor</div>
      </div>
    );
  }

  if (type === 'screen') {
    return (
      <div className="landing-feature-screen" aria-hidden="true">
        <div className="landing-feature-screen__bar">
          <span><i /> CANLI</span>
          <div><b /><b /><b /></div>
        </div>
        <div className="landing-feature-screen__canvas">
          <div className="landing-feature-screen__panel">
            <span /><span /><span />
          </div>
          <div className="landing-feature-screen__cursor material-symbols-outlined">near_me</div>
        </div>
      </div>
    );
  }

  if (type === 'messages') {
    return (
      <div className="landing-feature-messages" aria-hidden="true">
        <div><span>A</span><p><strong>Asya</strong> Bu gece bizde misin?</p></div>
        <div><span>M</span><p><strong>Mert</strong> Ben hazırım ✨</p></div>
        <div className="landing-typing"><i /><i /><i /></div>
      </div>
    );
  }

  return (
    <div className="landing-feature-control" aria-hidden="true">
      <div><span className="material-symbols-outlined">crown</span><p><strong>Kurucu</strong><small>Tüm yetkiler</small></p><i /></div>
      <div><span className="material-symbols-outlined">shield</span><p><strong>Moderatör</strong><small>Topluluk yönetimi</small></p><i /></div>
      <div><span className="material-symbols-outlined">person</span><p><strong>Üye</strong><small>Sohbet ve ses</small></p><i /></div>
    </div>
  );
}

function LandingPage({ isAuthenticated = false }) {
  const pageRef = useRef(null);
  const primaryPath = isAuthenticated ? '/app' : '/register';
  const primaryLabel = isAuthenticated ? 'Uygulamaya dön' : 'Ücretsiz başla';

  useLayoutEffect(() => {
    const root = pageRef.current;
    if (!root) return undefined;

    root.classList.add('landing-page--enhanced');
    const elements = root.querySelectorAll('[data-reveal]');
    const animationZones = root.querySelectorAll('[data-animation-zone]');
    if (!('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      animationZones.forEach((zone) => zone.classList.add('is-animation-active'));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { root, threshold: 0.16, rootMargin: '0px 0px -40px' });

    const animationObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle('is-animation-active', entry.isIntersecting);
      });
    }, { root, rootMargin: '180px 0px' });

    elements.forEach((element) => observer.observe(element));
    animationZones.forEach((zone) => animationObserver.observe(zone));
    return () => {
      observer.disconnect();
      animationObserver.disconnect();
    };
  }, []);

  return (
    <div ref={pageRef} className="landing-page">
      <a className="landing-skip-link" href="#landing-main">İçeriğe geç</a>
      <div className="landing-noise" aria-hidden="true" />

      <header className="landing-header">
        <nav className="landing-nav" aria-label="Ana navigasyon">
          <Link className="landing-brand" to="/" aria-label="Voxify ana sayfa">
            <img src="/logo.png" alt="" />
          </Link>
          <div className="landing-nav__links">
            <a href="#features">Özellikler</a>
            <a href="#how-it-works">Nasıl çalışır?</a>
            <a href="#download">İndir</a>
          </div>
          <div className="landing-nav__actions">
            {!isAuthenticated && <Link className="landing-nav__login" to="/login">Giriş yap</Link>}
            <Link className="landing-button landing-button--nav" to={primaryPath}>
              {primaryLabel}
              <span className="material-symbols-outlined" aria-hidden="true">arrow_outward</span>
            </Link>
          </div>
        </nav>
      </header>

      <main id="landing-main" tabIndex={-1}>
        <section className="landing-hero" aria-labelledby="landing-title" data-animation-zone>
          <div className="landing-hero__backdrop" aria-hidden="true">
            <span className="landing-hero__orb landing-hero__orb--cyan" />
            <span className="landing-hero__orb landing-hero__orb--blue" />
            <span className="landing-hero__grid" />
          </div>

          <div className="landing-shell landing-hero__grid-layout">
            <div className="landing-hero__copy">
              <div className="landing-eyebrow landing-hero__eyebrow">
                <span><i /> SESLİ</span>
                <span>YAZILI</span>
                <span>ANLIK</span>
              </div>
              <h1 id="landing-title">
                Sesini aç.<br />
                <span>Dünyanı kur.</span>
              </h1>
              <p className="landing-hero__lead">
                Sesli kanallar, anlık mesajlar ve ekran paylaşımı. Arkadaşlarınla aynı frekansta buluşmanın en akıcı hali.
              </p>
              <div className="landing-hero__actions">
                <Link className="landing-button landing-button--primary" to={primaryPath}>
                  <span>{primaryLabel}</span>
                  <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                </Link>
                {DOWNLOAD_URL ? (
                  <a
                    className="landing-button landing-button--ghost"
                    href={DOWNLOAD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">download</span>
                    Windows için indir
                  </a>
                ) : (
                  <a className="landing-button landing-button--ghost" href="#download">
                    <span className="material-symbols-outlined" aria-hidden="true">desktop_windows</span>
                    Masaüstü sürümünü gör
                  </a>
                )}
              </div>
              <div className="landing-hero__notes">
                <span><i className="material-symbols-outlined" aria-hidden="true">language</i> Tarayıcıdan kullan</span>
                <span><i className="material-symbols-outlined" aria-hidden="true">bolt</i> Saniyeler içinde başla</span>
              </div>
            </div>

            <div className="landing-hero__product">
              <ProductStage />
            </div>
          </div>

          <a className="landing-scroll-cue" href="#features" aria-label="Özelliklere ilerle">
            <span>KEŞFET</span>
            <i><b /></i>
          </a>
        </section>

        <section className="landing-ticker" aria-label="Voxify özellikleri" data-animation-zone>
          <div className="landing-ticker__track">
            {[...tickerItems, ...tickerItems].map(([icon, label], index) => (
              <span key={`${label}-${index}`} aria-hidden={index >= tickerItems.length}>
                <i className="material-symbols-outlined" aria-hidden="true">{icon}</i>
                {label}
                <b />
              </span>
            ))}
          </div>
        </section>

        <section id="features" className="landing-section landing-features" data-animation-zone>
          <div className="landing-shell">
            <div className="landing-section-heading" data-reveal>
              <div>
                <span className="landing-kicker">BİRLİKTE OLMAK İÇİN TASARLANDI</span>
                <h2>Sohbetin önüne hiçbir şey geçmesin.</h2>
              </div>
              <p>Voxify, topluluğunu bir araya getiren her şeyi tek, hızlı ve yaşayan bir yerde toplar.</p>
            </div>

            <div className="landing-bento">
              {featureCards.map((feature, index) => (
                <article
                  key={feature.title}
                  className={feature.className}
                  data-reveal
                  style={{ '--reveal-delay': `${index * 80}ms` }}
                >
                  <div className="landing-feature__copy">
                    <div className="landing-feature__eyebrow">
                      <span className="material-symbols-outlined" aria-hidden="true">{feature.icon}</span>
                      {feature.eyebrow}
                    </div>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </div>
                  <FeatureVisual type={feature.visual} />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-flow-section" data-animation-zone>
          <div className="landing-flow-section__glow" aria-hidden="true" />
          <div className="landing-shell landing-flow-section__layout">
            <div className="landing-flow-visual" data-reveal aria-hidden="true">
              <div className="landing-flow-visual__ring landing-flow-visual__ring--outer" />
              <div className="landing-flow-visual__ring landing-flow-visual__ring--middle" />
              <div className="landing-flow-visual__ring landing-flow-visual__ring--inner" />
              <div className="landing-flow-visual__core">V</div>
              <div className="landing-flow-node landing-flow-node--one"><span>A</span><i /></div>
              <div className="landing-flow-node landing-flow-node--two"><span>M</span><i /></div>
              <div className="landing-flow-node landing-flow-node--three"><span>D</span><i /></div>
              <div className="landing-flow-wave"><VoiceBars /></div>
            </div>
            <div className="landing-flow-copy" data-reveal>
              <span className="landing-kicker">TEK BİR AKIŞ</span>
              <h2>Odaya gir.<br /><em>Gerisi kendiliğinden.</em></h2>
              <p>Kim çevrimiçi, hangi kanal hareketli, arkadaşların nerede—hepsini bir bakışta gör. Sohbete katılmak için sadece bir tık yeter.</p>
              <ul>
                <li><span className="material-symbols-outlined" aria-hidden="true">check</span> Arama bağlantısı bekleme yok</li>
                <li><span className="material-symbols-outlined" aria-hidden="true">check</span> Kanal değiştirmek anında</li>
                <li><span className="material-symbols-outlined" aria-hidden="true">check</span> Ses ve mesaj aynı bağlamda</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="landing-section landing-steps" data-animation-zone>
          <div className="landing-shell">
            <div className="landing-section-heading landing-section-heading--center" data-reveal>
              <div>
                <span className="landing-kicker">ÜÇ ADIM. SONSUZ MUHABBET.</span>
                <h2>Kurması kolay. Ayrılması zor.</h2>
              </div>
            </div>
            <div className="landing-steps__grid">
              <article data-reveal style={{ '--reveal-delay': '0ms' }}>
                <div className="landing-step-number">01</div>
                <span className="material-symbols-outlined" aria-hidden="true">hub</span>
                <h3>Klanını kur</h3>
                <p>Ekibini, arkadaş grubunu ya da topluluğunu tek çatı altında topla.</p>
              </article>
              <article data-reveal style={{ '--reveal-delay': '90ms' }}>
                <div className="landing-step-number">02</div>
                <span className="material-symbols-outlined" aria-hidden="true">add_box</span>
                <h3>Kanalını aç</h3>
                <p>Konulara göre mesaj ve ses kanalları oluştur; düzen hep yerinde kalsın.</p>
              </article>
              <article data-reveal style={{ '--reveal-delay': '180ms' }}>
                <div className="landing-step-number">03</div>
                <span className="material-symbols-outlined" aria-hidden="true">graphic_eq</span>
                <h3>Ses ver</h3>
                <p>Tek tıkla kanala gir. Arkadaşların geldiğinde sohbet zaten başlamış olsun.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="download" className="landing-download-section" data-animation-zone>
          <div className="landing-shell">
            <div className="landing-download-card" data-reveal>
              <div className="landing-download-card__glow" aria-hidden="true" />
              <div className="landing-download-card__copy">
                <span className="landing-kicker">MASAÜSTÜNDE DAHA DA YAKIN</span>
                <h2>Voxify yanında gelsin.</h2>
                <p>Bildirimleri kaçırma, ses kanallarına daha hızlı dön ve topluluğunu masaüstünden hep yanında tut.</p>
                <div className="landing-download-card__requirements">
                  <span><i className="material-symbols-outlined" aria-hidden="true">desktop_windows</i> Windows 10/11</span>
                  <span><i className="material-symbols-outlined" aria-hidden="true">memory</i> 64-bit</span>
                  <span><i className="material-symbols-outlined" aria-hidden="true">update</i> Güncel sürüm</span>
                </div>
                <div className="landing-download-card__actions">
                  {DOWNLOAD_URL ? (
                    <a
                      className="landing-button landing-button--download"
                      href={DOWNLOAD_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">download</span>
                      <span><small>WINDOWS İÇİN</small>Voxify’ı indir</span>
                    </a>
                  ) : (
                    <span className="landing-download-card__unavailable">
                      <span className="material-symbols-outlined" aria-hidden="true">schedule</span>
                      Masaüstü paketi yakında
                    </span>
                  )}
                  <Link className="landing-download-card__web-link" to={primaryPath}>
                    Tarayıcıda devam et <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                  </Link>
                </div>
              </div>

              <div className="landing-download-card__device" aria-hidden="true">
                <div className="landing-device-halo" />
                <div className="landing-device-window landing-device-window--back">
                  <span /><span /><span />
                </div>
                <div className="landing-device-window landing-device-window--front">
                  <div className="landing-device-window__top"><i /><i /><i /></div>
                  <div className="landing-device-window__body">
                    <div className="landing-device-logo">V</div>
                    <VoiceBars compact />
                    <strong>Bağlantın hazır</strong>
                    <small>Arkadaşların seni bekliyor</small>
                  </div>
                </div>
                <div className="landing-download-badge">
                  <span className="material-symbols-outlined">verified</span>
                  <div><strong>Hazır</strong><small>Güncel sürüm</small></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-final-cta" data-animation-zone>
          <div className="landing-final-cta__rings" aria-hidden="true"><i /><i /><i /></div>
          <div className="landing-shell landing-final-cta__content" data-reveal>
            <span className="landing-kicker">FREKANSA KATIL</span>
            <h2>Hazırsan, ses ver.</h2>
            <p>Topluluğunu kur. Arkadaşlarını çağır. Muhabbeti başlat.</p>
            <Link className="landing-button landing-button--primary landing-button--large" to={primaryPath}>
              {primaryLabel}
              <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-shell landing-footer__content">
          <Link className="landing-brand landing-brand--footer" to="/" aria-label="Voxify ana sayfa">
            <img src="/logo.png" alt="" />
          </Link>
          <p>Arkadaşlarınla aynı frekansta.</p>
          <div className="landing-footer__links">
            <Link to="/login">Giriş</Link>
            <Link to="/register">Kayıt</Link>
            <a href="#features">Özellikler</a>
            <a href="#download">İndir</a>
          </div>
          <small>© {new Date().getFullYear()} Voxify</small>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;

import React from 'react';
import '../styles/welcome.css';
/**
 * WelcomePage
 * Kullanıcı henüz bir klan seçmediğinde ana alanda görünen karşılama sayfası.
 * Uygulamanın son sürümünü Google Drive üzerinden indirme bağlantısı içerir.
 *
 * Props:
 *  - downloadUrl : string — Google Drive paylaşım linki (doğrudan indirme)
 *  - version     : string — Gösterilecek sürüm numarası
 */

const DOWNLOAD_URL = import.meta.env.VITE_VERSION_LINK;


function WelcomePage() {
  return (
    <main className="welcome-page">
      <div className="welcome-page__card">
        {/* Hero */}
        <div className="welcome-page__hero">
          <div className="welcome-page__logo-wrapper">
            <div className="welcome-page__logo-glow" />
            <img
              src="/logo.png"
              alt="Voxify Logo"
              className="welcome-page__logo"
            />
          </div>
          <h1 className="welcome-page__title">
            Welcome to <span className="welcome-page__title-accent">Voxify</span>
          </h1>
          <p className="welcome-page__subtitle">
            Arkadaşlarınla sesli ve yazılı sohbetin en kolay yolu.
            Klanını oluştur, kanallara katıl ve Voxify keyfini çıkar.
          </p>
        </div>

        {/* Download Card */}
        <div className="welcome-page__download-card">
          <div className="welcome-page__download-header">
            <h2 className="welcome-page__download-title">En güncel Voxify sürümünü indir</h2>
          </div>
          {/* Version Badge */}
          <div className="welcome-page__version-badge">
            <span className="welcome-page__version-dot" />
            <span>Son Sürüm</span>
          </div>

          {/* Platform Info */}
          <div className="welcome-page__platform-info">
            <span className="welcome-page__platform-tag">
              <span className="material-symbols-outlined">desktop_windows</span>
              Windows 10/11
            </span>
            <span className="welcome-page__platform-tag">
              <span className="material-symbols-outlined">folder_zip</span>
              ~11 MB
            </span>
            <span className="welcome-page__platform-tag">
              <span className="material-symbols-outlined">verified</span>
              Verileriniz Benimle Güvende
            </span>
          </div>

          {/* Download Button */}
          <a
            href={DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="welcome-page__download-btn"
            id="download-btn"
          >
            <span className="material-symbols-outlined">download</span>
            <span>Voxify'ı İndir</span>
          </a>
        </div>

        {/* Features */}
        <div className="welcome-page__features">
          <div className="welcome-page__feature">
            <span className="material-symbols-outlined welcome-page__feature-icon">
              headphones
            </span>
            <span className="welcome-page__feature-label">Sesli Sohbet</span>
          </div>
          <div className="welcome-page__feature">
            <span className="material-symbols-outlined welcome-page__feature-icon">
              screen_share
            </span>
            <span className="welcome-page__feature-label">Ekran Paylaşımı</span>
          </div>
          <div className="welcome-page__feature">
            <span className="material-symbols-outlined welcome-page__feature-icon">
              chat
            </span>
            <span className="welcome-page__feature-label">Anlık Mesajlar</span>
          </div>
        </div>

        {/* Hint */}
        <div className="welcome-page__hint">
          <span className="material-symbols-outlined">arrow_back</span>
          <span>Başlamak için soldaki listeden bir klan seç</span>
        </div>
      </div>
    </main >
  );
}

export default WelcomePage;

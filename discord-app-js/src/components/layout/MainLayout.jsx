import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

// Bu component'ler Adım 4'te doldurulacak.
// Şimdilik yer tutucu olarak oluşturalım.
const ClanList = () => {
  return (
    <nav style={{ width: '80px', background: '#202225', color: 'white', padding: '10px' }}>
      <p>Klan Listesi (Adım 4)</p>
      {/* Örnek Klan İkonu */}
      <div style={{ background: '#5865F2', height: '50px', width: '50px', borderRadius: '50%', textAlign: 'center', lineHeight: '50px', cursor: 'pointer' }}>
        K1
      </div>
    </nav>
  );
};

const ChannelList = () => {
  return (
    <aside style={{ width: '240px', background: '#2f3136', color: 'gray', padding: '10px' }}>
      <p>Kanal Listesi (Adım 4)</p>
      <p># genel</p>
      <p># duyurular</p>
      <p>🔊 Sohbet 1</p>
    </aside>
  );
};


function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    // authService.logout() zaten window.location ile yönlendirme yapıyor,
    // ancak context'i kullanmak daha "React"vari bir yoldur.
    // navigate('/login'); // authService'deki yönlendirme olmasaydı bunu kullanırdık.
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#36393f', color: 'white' }}>
      
      {/* 1. Sol Panel: Klan (Sunucu) Listesi */}
      <ClanList />
      
      {/* 2. Orta Panel: Kanal Listesi ve Kullanıcı Bilgisi */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '240px' }}>
        <ChannelList />
        
        {/* Kullanıcı Paneli */}
        <div style={{ marginTop: 'auto', background: '#292b2f', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Merhaba, {user?.username || 'Kullanıcı'}!</span>
          <button onClick={handleLogout} style={{ background: 'red', color: 'white', border: 'none', padding: '5px' }}>
            Çıkış
          </button>
        </div>
      </div>

      {/* 3. Ana İçerik Alanı */}
      <main style={{ flexGrow: 1, padding: '20px', overflowY: 'auto' }}>
        {/* İÇ İÇE ROTALARIN GÖSTERİLECEĞİ YER (PRİZ)
          /app -> DashboardPage
          /app/clans/... -> ChannelPage
        */}
        <Outlet />
      </main>
      
    </div>
  );
}

export default MainLayout;
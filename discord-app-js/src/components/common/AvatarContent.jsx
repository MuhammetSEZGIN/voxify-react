import React, { useEffect, useState } from 'react';

function AvatarContent({ src, name, imgClassName = '' }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`${name || 'Kullanıcı'} profil resmi`}
        className={imgClassName}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return <span>{name?.charAt(0)?.toUpperCase() || '?'}</span>;
}

export default AvatarContent;

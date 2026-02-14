import React, { useState } from 'react';

function CreateClanModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 3) return;

    setLoading(true);
    try {
      await onCreate({ name: name.trim(), description: description.trim() || null });
      onClose();
    } catch {
      // Error handled in parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title">Sunucunu Oluştur</h2>
        <p className="modal__subtitle">
          Sunucun, senin ve arkadaşlarının takıldığı yer. Kendininkini oluştur ve konuşmaya başla.
        </p>

        <form onSubmit={handleSubmit}>
          <label className="modal__label">Sunucu Adı</label>
          <input
            className="modal__input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sunucu adını girin"
            minLength={3}
            maxLength={50}
            autoFocus
          />

          <label className="modal__label">Açıklama (İsteğe bağlı)</label>
          <input
            className="modal__input"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Sunucunuz hakkında kısa bir açıklama"
          />

          <div className="modal__actions">
            <button type="button" className="modal__btn modal__btn--cancel" onClick={onClose}>
              Geri
            </button>
            <button
              type="submit"
              className="modal__btn modal__btn--primary"
              disabled={loading || name.trim().length < 3}
            >
              {loading ? 'Oluşturuluyor...' : 'Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateClanModal;
import { memo, useEffect, useRef } from 'react';

const STATUS_TEXT = {
  starting: 'Arama başlatılıyor...',
  ringing: 'Çalıyor...',
  accepted: 'Görüşme bağlandı',
  rejected: 'Çağrı reddedildi',
  cancelled: 'Çağrı iptal edildi',
  'timed-out': 'Yanıt verilmedi',
  busy: 'Kullanıcı meşgul',
  ended: 'Görüşme sona erdi',
  failed: 'Çağrı başarısız',
};

function DmCallOverlay({ call, error, displayName, outputVolume = 100, onAccept, onReject, onCancel, onEnd, onDismiss }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (call?.phase !== 'incoming') return undefined;
    const audio = new Audio('/voicechannelnotification.wav');
    audio.loop = true;
    audio.volume = Math.max(0, Math.min(outputVolume / 100, 1));
    audio.play().catch(() => {});
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, [call?.phase, call?.callId, outputVolume]);

  if (!call) return null;
  const terminal = ['rejected', 'cancelled', 'timed-out', 'busy', 'ended', 'failed'].includes(call.phase);
  const incoming = call.phase === 'incoming';
  const name = displayName || call.otherUserName || 'Bir kullanıcı';

  return (
    <section className={`dm-call ${incoming ? 'dm-call--incoming' : ''}`} role="dialog" aria-live="assertive">
      <div className="dm-call__avatar">
        {call.otherAvatarUrl ? <img src={call.otherAvatarUrl} alt="" /> : name.charAt(0).toUpperCase()}
      </div>
      <div className="dm-call__content">
        <strong>{name}</strong>
        <span>{incoming ? 'Gelen sesli arama' : STATUS_TEXT[call.phase] || 'Sesli arama'}</span>
        {error && <small>{error}</small>}
      </div>
      <div className="dm-call__actions">
        {incoming && (
          <>
            <button type="button" className="dm-call__action dm-call__action--reject" onClick={onReject} title="Reddet">
              <span className="material-symbols-outlined">call_end</span>
            </button>
            <button type="button" className="dm-call__action dm-call__action--accept" onClick={onAccept} title="Kabul et">
              <span className="material-symbols-outlined">call</span>
            </button>
          </>
        )}
        {['starting', 'ringing'].includes(call.phase) && (
          <button type="button" className="dm-call__action dm-call__action--reject" onClick={onCancel} title="Aramayı iptal et">
            <span className="material-symbols-outlined">call_end</span>
          </button>
        )}
        {call.phase === 'accepted' && (
          <button type="button" className="dm-call__action dm-call__action--reject" onClick={onEnd} title="Görüşmeyi bitir">
            <span className="material-symbols-outlined">call_end</span>
          </button>
        )}
        {terminal && (
          <button type="button" className="dm-call__dismiss" onClick={onDismiss}>Kapat</button>
        )}
      </div>
    </section>
  );
}

export default memo(DmCallOverlay);

import { useState } from 'react';

function RegisterPage() {
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = (event) => {
        event.preventDefault();
        setError(null);
        setLoading(true);
        // TODO : AuthService register çağırılacak
        console.log('kayıt olunuyor...', {username, email, password, confirmPassword});
        setTimeout(() => {
            setLoading(false);
            setError('Kayıt başarısız oldu. Lütfen bilgilerinizi kontrol edin.');
        }, 2000);
    }


  return <div>
    <h2>Kayıt Sayfası</h2>
    <form onSubmit={handleSubmit}>
        <div className="form-group">
            <label htmlFor="username">Kullanıcı Adı</label>
            <input value ={username} onChange={(e) => setUsername(e.target.value)} type="text" required />
        </div>
        <div className="form-group">
            <label htmlFor="email">Email</label>
            <input value ={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>
        <div className="form-group">
            <label htmlFor="password">Parola</label>
            <input value ={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </div>
        <div className="form-group">
            <label htmlFor="confirmPassword">Parola (Tekrar)</label>
            <input value ={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" required />    
        </div>
        {error && <div className="error-message">{error}</div>}
        <button type="submit" disabled={loading}>
            {loading ? "Kayıt olunuyor..." : "Kayıt Ol"}
        </button>
    </form>
  </div>
}

export default RegisterPage;
import React, { useState } from 'react';
import apiClient from '../../../shared/services/apiClient';
import './StudentRegistration.css';

function StudentRegistration() {
    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
        name: '',
        student_number: '',
        department: '',
    });
    const [message, setMessage] = useState({ text: '', type: '' });
    const [loading, setLoading] = useState(false);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.username || !form.email || !form.password || !form.name) {
            setMessage({ text: 'Lütfen zorunlu alanları doldurun', type: 'error' });
            return;
        }

        setLoading(true);
        setMessage({ text: '', type: '' });
        try {
            await apiClient.post('/users', {
                username: form.username,
                email: form.email,
                password: form.password,
                name: form.name,
                role: 'student',
                student_number: form.student_number || undefined,
                department: form.department || undefined,
            });

            setMessage({ text: `✓ ${form.name} başarıyla kaydedildi!`, type: 'success' });
            setForm({ username: '', email: '', password: '', name: '', student_number: '', department: '' });
        } catch (error) {
            setMessage({ text: error.message || 'Kayıt sırasında hata oluştu', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="register-container">
            <div className="register-header">
                <h2>Yeni Öğrenci Kaydı</h2>
                <p>Sisteme yeni öğrenci eklemek için formu doldurun</p>
            </div>

            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="register-form">
                <div className="form-row-reg">
                    <div className="form-group-reg">
                        <label>Kullanıcı Adı *</label>
                        <input
                            type="text"
                            value={form.username}
                            onChange={e => set('username', e.target.value)}
                            placeholder="johndoe"
                            required
                        />
                    </div>
                    <div className="form-group-reg">
                        <label>E-posta *</label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={e => set('email', e.target.value)}
                            placeholder="john@example.com"
                            required
                        />
                    </div>
                </div>

                <div className="form-row-reg">
                    <div className="form-group-reg">
                        <label>Ad Soyad *</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            placeholder="John Doe"
                            required
                        />
                    </div>
                    <div className="form-group-reg">
                        <label>Şifre *</label>
                        <input
                            type="password"
                            value={form.password}
                            onChange={e => set('password', e.target.value)}
                            placeholder="Güçlü bir şifre girin"
                            required
                        />
                    </div>
                </div>

                <div className="form-row-reg">
                    <div className="form-group-reg">
                        <label>Öğrenci Numarası</label>
                        <input
                            type="text"
                            value={form.student_number}
                            onChange={e => set('student_number', e.target.value)}
                            placeholder="2021001"
                        />
                    </div>
                    <div className="form-group-reg">
                        <label>Bölüm</label>
                        <input
                            type="text"
                            value={form.department}
                            onChange={e => set('department', e.target.value)}
                            placeholder="Bilgisayar Mühendisliği"
                        />
                    </div>
                </div>

                <div className="register-note">
                    <span>Not:</span>
                    <span>Öğrenci kaydedildikten sonra mobil uygulamadan giriş yaparak yüz kaydını tamamlamalıdır.</span>
                </div>

                <button type="submit" className="register-btn" disabled={loading}>
                    {loading ? 'Kaydediliyor...' : '+ Öğrenciyi Kaydet'}
                </button>
            </form>
        </div>
    );
}

export default StudentRegistration;

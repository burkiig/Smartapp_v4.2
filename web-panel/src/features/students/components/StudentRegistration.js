import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '../../../shared/services/apiClient';
import './StudentRegistration.css';

function StudentRegistration() {
    const { t } = useTranslation();
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
            setMessage({ text: t('register.requiredFields'), type: 'error' });
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

            setMessage({ text: `✓ ${t('register.success', { name: form.name })}`, type: 'success' });
            setForm({ username: '', email: '', password: '', name: '', student_number: '', department: '' });
        } catch (error) {
            setMessage({ text: error.message || t('register.error'), type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="register-container">
            <div className="register-header">
                <h2>{t('register.title')}</h2>
                <p>{t('register.subtitle')}</p>
            </div>

            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="register-form">
                <div className="form-row-reg">
                    <div className="form-group-reg">
                        <label>{t('register.usernameLabel')} *</label>
                        <input
                            type="text"
                            value={form.username}
                            onChange={e => set('username', e.target.value)}
                            placeholder="johndoe"
                            required
                        />
                    </div>
                    <div className="form-group-reg">
                        <label>{t('register.emailLabel')} *</label>
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
                        <label>{t('register.fullNameLabel')} *</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => set('name', e.target.value)}
                            placeholder="John Doe"
                            required
                        />
                    </div>
                    <div className="form-group-reg">
                        <label>{t('register.passwordLabel')} *</label>
                        <input
                            type="password"
                            value={form.password}
                            onChange={e => set('password', e.target.value)}
                            placeholder={t('register.passwordPlaceholder')}
                            required
                        />
                    </div>
                </div>

                <div className="form-row-reg">
                    <div className="form-group-reg">
                        <label>{t('register.studentNoLabel')}</label>
                        <input
                            type="text"
                            value={form.student_number}
                            onChange={e => set('student_number', e.target.value)}
                            placeholder="2021001"
                        />
                    </div>
                    <div className="form-group-reg">
                        <label>{t('register.departmentLabel')}</label>
                        <input
                            type="text"
                            value={form.department}
                            onChange={e => set('department', e.target.value)}
                            placeholder={t('register.departmentPlaceholder')}
                        />
                    </div>
                </div>

                <div className="register-note">
                    <span>{t('register.noteLabel')}:</span>
                    <span>{t('register.noteText')}</span>
                </div>

                <button type="submit" className="register-btn" disabled={loading}>
                    {loading ? t('common.saving') : `+ ${t('register.submitBtn')}`}
                </button>
            </form>
        </div>
    );
}

export default StudentRegistration;

import React, { useMemo, useState, useEffect } from 'react';
import { UserPlus, Edit, Trash2, Shield, User, Lock, Save, X, AlertCircle, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { clearAdminSession, getAuthToken } from '../utils/session';
import type { AdminLanguage } from '../utils/adminLanguage';
import { translateAdminUiText } from '../utils/adminLanguage';
import './UsersManager.css';

interface AdminUser {
    id: string;
    username: string;
    name: string;
    role: 'master' | 'secondary';
    created_at?: string;
}

interface UsersManagerProps {
    currentUser: {
        role: 'master' | 'secondary';
    };
    language?: AdminLanguage;
}

const UsersManager: React.FC<UsersManagerProps> = ({ currentUser, language = 'az' }) => {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'master' | 'secondary'>('all');
    const t = (value: string) => translateAdminUiText(language, value);

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
    };

    const fetchUsers = async () => {
        try {
            const token = getAuthToken();
            if (!token) {
                clearAdminSession();
                return;
            }
            const response = await fetch('/api/users', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401 || response.status === 403) {
                clearAdminSession();
                toast.error(t('Sessiya müddəti bitib. Yenidən daxil olun.'));
                return;
            }
            if (!response.ok) throw new Error('Yükləmə uğursuz oldu');

            const data = await response.json();
            setUsers(data || []);
        } catch (err) {
            toast.error(t('İstifadəçiləri yükləmək mümkün olmadı'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        if (!isModalOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeModal();
            }
        };

        document.body.classList.add('offcanvas-open');
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.classList.remove('offcanvas-open');
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isModalOpen]);

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser?.username || !editingUser?.name || (!editingUser?.id && !editingUser?.password)) {
            toast.error(t('Zəhmət olmasa bütün sahələri doldurun'));
            return;
        }

        try {
            const token = getAuthToken();
            if (!token) {
                clearAdminSession();
                return;
            }
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editingUser)
            });

            if (response.status === 401 || response.status === 403) {
                clearAdminSession();
                toast.error(t('Sessiya müddəti bitib. Yenidən daxil olun.'));
                return;
            }
            if (response.ok) {
                toast.success(t(editingUser.id ? 'İstifadəçi yeniləndi' : 'Yeni istifadəçi yaradıldı'));
                closeModal();
                fetchUsers();
            } else {
                const data = await response.json();
                toast.error(t(data.error || 'Xəta baş verdi'));
            }
        } catch (err) {
            toast.error(t('Serverlə bağlantı kəsildi'));
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!window.confirm(t('Bu istifadəçini silmək istədiyinizə əminsiniz?'))) return;

        try {
            const token = getAuthToken();
            if (!token) {
                clearAdminSession();
                return;
            }
            const response = await fetch(`/api/users/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.status === 401 || response.status === 403) {
                clearAdminSession();
                toast.error(t('Sessiya müddəti bitib. Yenidən daxil olun.'));
                return;
            }
            if (response.ok) {
                toast.success(t('İstifadəçi silindi'));
                fetchUsers();
            } else {
                const data = await response.json();
                toast.error(t(data.error || 'Silmək mümkün olmadı'));
            }
        } catch (err) {
            toast.error(t('Serverlə bağlantı kəsildi'));
        }
    };

    const openModal = (user: any | null = null) => {
        setEditingUser(user ? { ...user } : { username: '', name: '', password: '', role: 'secondary' });
        setIsModalOpen(true);
    };

    const normalizedQuery = (searchQuery || '').trim().toLocaleLowerCase('az');

    const filteredUsers = useMemo(() => {
        return users
            .filter((user) => {
                if (roleFilter !== 'all' && user.role !== roleFilter) return false;
                if (!normalizedQuery) return true;

                const name = (user.name || '').toLocaleLowerCase('az');
                const username = (user.username || '').toLocaleLowerCase('az');
                return name.includes(normalizedQuery) || username.includes(normalizedQuery);
            })
            .sort((a, b) => {
                if (a.role !== b.role) return a.role === 'master' ? -1 : 1;
                return (a.name || '').localeCompare(b.name || '', 'az');
            });
    }, [users, roleFilter, normalizedQuery]);

    const masterCount = useMemo(
        () => users.filter((user) => user.role === 'master').length,
        [users]
    );
    const secondaryCount = useMemo(
        () => users.filter((user) => user.role === 'secondary').length,
        [users]
    );

    const getRoleLabel = (role: AdminUser['role']) => t(role === 'master' ? 'Baş admin' : 'Redaktor');
    const formatDate = (value?: string) => {
        if (!value) return t('Tarix yoxdur');
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return t('Tarix yoxdur');
        const locale = language === 'ru' ? 'ru-RU' : language === 'en' ? 'en-US' : 'az-AZ';
        return parsed.toLocaleDateString(locale, {
            year: 'numeric',
            month: 'short',
            day: '2-digit'
        });
    };

    if (isLoading) return <div className="loading-state">{t('Yüklənir...')}</div>;

    return (
        <div className="users-manager fade-in">
            <div className="manager-header">
                <div className="manager-header-copy">
                    <h1>{t('Admin Hesabları')}</h1>
                    <p>{t('Sistemi idarə edən bütün administratorların siyahısı və səlahiyyətləri')}</p>
                </div>
                {currentUser.role === 'master' && (
                    <button className="add-user-btn" onClick={() => openModal()}>
                        <UserPlus size={18} /> {t('Yeni idarəçi')}
                    </button>
                )}
            </div>

            <div className="manager-stats">
                <div className="stat-card">
                    <span>{t('Cəmi hesab')}</span>
                    <strong>{users.length}</strong>
                </div>
                <div className="stat-card">
                    <span>{t('Baş admin')}</span>
                    <strong>{masterCount}</strong>
                </div>
                <div className="stat-card">
                    <span>{t('Redaktor')}</span>
                    <strong>{secondaryCount}</strong>
                </div>
            </div>

            <div className="manager-toolbar">
                <div className="search-box">
                    <Search size={16} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('Ad və ya istifadəçi adı ilə axtar...')}
                    />
                </div>
                <div className="role-filter-group">
                    <button
                        type="button"
                        className={`role-filter-btn ${roleFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setRoleFilter('all')}
                    >
                        {t('Hamısı')}
                    </button>
                    <button
                        type="button"
                        className={`role-filter-btn ${roleFilter === 'master' ? 'active' : ''}`}
                        onClick={() => setRoleFilter('master')}
                    >
                        {t('Baş admin')}
                    </button>
                    <button
                        type="button"
                        className={`role-filter-btn ${roleFilter === 'secondary' ? 'active' : ''}`}
                        onClick={() => setRoleFilter('secondary')}
                    >
                        {t('Redaktor')}
                    </button>
                </div>
            </div>

            <div className="result-meta">{t(`${filteredUsers.length} nəticə göstərilir`)}</div>

            {filteredUsers.length === 0 ? (
                <div className="empty-users-state">
                    <h3>{t('Nəticə tapılmadı')}</h3>
                    <p>{t('Axtarış və filtr seçiminə uyğun hesab yoxdur.')}</p>
                </div>
            ) : (
                <div className="users-grid">
                    {filteredUsers.map(user => (
                        <div key={user.id} className="user-card">
                            <div className="user-card-head">
                                <div className="user-avatar">
                                    <img src={`https://ui-avatars.com/api/?name=${user.name}&background=${user.role === 'master' ? '3b82f6' : 'f59e0b'}&color=fff`} alt={user.name} />
                                </div>
                                <div className="user-details">
                                    <h3>{user.name}</h3>
                                    <span>@{user.username || 'username'}</span>
                                </div>
                                <div className={`role-badge ${user.role || 'secondary'}`}>
                                    <Shield size={11} /> {getRoleLabel(user.role)}
                                </div>
                            </div>

                            <div className="user-meta-row">
                                <span>{t('Yaradılıb:')} {formatDate(user.created_at)}</span>
                            </div>

                            {currentUser.role === 'master' && (
                                <div className="user-actions">
                                    <button className="edit-btn" onClick={() => openModal(user)} title={t('Düzəliş et')}>
                                        <Edit size={16} />
                                    </button>
                                    <button className="delete-btn" onClick={() => handleDeleteUser(user.id.toString())} title={t('Sil')}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div
                        className="modal-content"
                        role="dialog"
                        aria-modal="true"
                        aria-label={t(editingUser?.id ? 'İstifadəçini redaktə et' : 'Yeni idarəçi hesabı')}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h2>{t(editingUser?.id ? 'İstifadəçini redaktə et' : 'Yeni idarəçi hesabı')}</h2>
                            <button type="button" onClick={closeModal}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveUser}>
                            <div className="form-group">
                                <label><User size={14} /> {t('Tam Ad')}</label>
                                <input
                                    type="text"
                                    value={editingUser?.name || ''}
                                    onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                                    placeholder={t('Məs: Əli Məmmədov')}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label><User size={14} /> {t('İstifadəçi Adı')}</label>
                                <input
                                    type="text"
                                    value={editingUser?.username || ''}
                                    onChange={e => setEditingUser({ ...editingUser, username: e.target.value })}
                                    placeholder={t('Məs: alimm')}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label><Lock size={14} /> {t('Şifrə')} {editingUser?.id && <span className="helper-text">({t('Dəyişmək istəmirsinizsə boş saxlayın')})</span>}</label>
                                <input
                                    type="password"
                                    value={editingUser?.password || ''}
                                    onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                                    placeholder="••••••••"
                                    required={!editingUser?.id}
                                />
                            </div>
                            <div className="form-group">
                                <label><Shield size={14} /> {t('Yetki (Rol)')}</label>
                                <select
                                    value={editingUser?.role || 'secondary'}
                                    onChange={e => setEditingUser({ ...editingUser, role: e.target.value as any })}
                                >
                                    <option value="master">{t('Baş Admin (Tam səlahiyyət)')}</option>
                                    <option value="secondary">{t('Redaktor (Məhdud səlahiyyət)')}</option>
                                </select>
                            </div>
                            {editingUser?.role === 'master' && (
                                <div className="role-warning">
                                    <AlertCircle size={14} /> {t('Baş Admin bütün sistem daxilində tam səlahiyyətə malikdir.')}
                                </div>
                            )}
                            <div className="modal-actions">
                                <button type="button" className="cancel-btn" onClick={closeModal}>{t('Ləğv et')}</button>
                                <button type="submit" className="save-btn"><Save size={18} /> {t('Yadda Saxla')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersManager;

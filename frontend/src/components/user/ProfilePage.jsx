import { useRef, useState } from 'react';
import { Camera, Save, Loader2, User, Mail, Phone, IdCard, MapPin, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import Header from '../layout/Header';
import Footer from '../layout/Footer';
import StatusBadge from '../common/StatusBadge';
import ChangePasswordForm from './ChangePasswordForm';
import { useAuth } from '../../context/AuthContext';

const MAX_AVATAR_SIZE = 320;

function resizeImageToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, MAX_AVATAR_SIZE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user, updateProfile } = useAuth();
  const fileInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');
  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    idNumber: user?.idNumber || '',
    address: user?.address || '',
  });
  const [saving, setSaving] = useState(false);

  const displayName = formData.name || t('profile.defaultAccountName');
  const avatarUrl = avatarPreview || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff&size=200`;

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.avatarErrorType'));
      return;
    }

    try {
      setAvatarPreview(await resizeImageToDataUrl(file));
    } catch {
      toast.error(t('profile.avatarErrorProcess'));
    }
  };

  const handleChange = (field) => (e) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ ...formData, avatar: avatarPreview });
      toast.success(t('profile.updateSuccess'));
    } catch (err) {
      toast.error(err.message || t('profile.updateError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('profile.title')}</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-8">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
              <img src={avatarUrl} alt={displayName} className="w-24 h-24 rounded-full object-cover border border-gray-200" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md transition-colors"
                aria-label={t('profile.changeAvatar')}
              >
                <Camera size={15} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p className="font-bold text-gray-900">{displayName}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold px-2.5 py-1">
                  <ShieldCheck size={12} /> {t(`profile.role.${user?.role}`, user?.role)}
                </span>
                <StatusBadge status={user?.status} />
              </div>
            </div>
          </div>

          {/* Fields */}
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <User size={14} /> {t('profile.fullName')}
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={handleChange('name')}
                placeholder="Nguyễn Văn A"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <Mail size={14} /> {t('profile.email')}
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-100 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">{t('profile.emailImmutable')}</p>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <Phone size={14} /> {t('profile.phone')}
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={handleChange('phone')}
                placeholder="09xxxxxxxx"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <IdCard size={14} /> {t('profile.idNumber')}
              </label>
              <input
                type="text"
                value={formData.idNumber}
                onChange={handleChange('idNumber')}
                placeholder="079xxxxxxxxx"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                <MapPin size={14} /> {t('profile.address')}
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={handleChange('address')}
                placeholder={t('profile.addressPlaceholder')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? t('profile.saving') : t('profile.saveChanges')}
          </button>
        </form>

        <ChangePasswordForm />
      </main>
      <Footer />
    </div>
  );
}

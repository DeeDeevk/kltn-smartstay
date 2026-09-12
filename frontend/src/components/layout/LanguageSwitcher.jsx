import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { VNFlag, GBFlag } from './flagIcons';

const LANGUAGES = [
  { code: 'vi', Flag: VNFlag, labelKey: 'language.vi' },
  { code: 'en', Flag: GBFlag, labelKey: 'language.en' },
];

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  const current = LANGUAGES.find((lang) => lang.code === i18n.language) ?? LANGUAGES[0];

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (code) => {
    i18n.changeLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Chọn ngôn ngữ"
        className="flex items-center gap-1 rounded-full border border-gray-200 pl-1 pr-2 py-1 hover:border-gray-300 hover:bg-gray-50 transition-colors"
      >
        <span className="block h-6 w-6 rounded-full overflow-hidden ring-1 ring-black/10 shrink-0">
          <current.Flag className="h-full w-full" />
        </span>
        <ChevronDown size={13} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="dropdown-menu-in absolute right-0 top-full mt-2 w-44 bg-white rounded-xl border border-gray-100 shadow-xl overflow-hidden z-50">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                lang.code === current.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="block h-5 w-5 rounded-full overflow-hidden ring-1 ring-black/10 shrink-0">
                <lang.Flag className="h-full w-full" />
              </span>
              {t(lang.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

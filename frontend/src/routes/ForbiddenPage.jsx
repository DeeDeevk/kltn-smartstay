import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'

export default function ForbiddenPage() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header />
      <main className="flex flex-1 items-center justify-center px-6 py-20">
        <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white/90 p-10 text-center shadow-[0_30px_80px_rgba(15,23,42,0.10)]">
          <ShieldAlert className="mx-auto mb-4 text-red-500" size={48} />
          <h1 className="text-2xl font-bold text-slate-900">{t('forbidden.title')}</h1>
          <p className="mt-2 text-[15px] leading-7 text-slate-500">
            {t('forbidden.message')}
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 font-bold text-white shadow-[0_18px_45px_rgba(37,99,235,0.28)] transition-all hover:brightness-105 active:scale-[0.99]"
          >
            {t('forbidden.backHome')}
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}

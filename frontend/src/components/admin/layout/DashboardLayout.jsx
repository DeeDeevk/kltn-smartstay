import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Sidebar />
      <Header />
      {/* Main Content Area (padding-left = sidebar width, padding-top = header height) */}
      <main className="pl-64 pt-16">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
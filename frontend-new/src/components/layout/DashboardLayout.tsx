import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import QRScannerModal from '../QRScannerModal';

const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showScanner, setShowScanner] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onScannerOpen={() => setShowScanner(true)} />

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>

      {showScanner && <QRScannerModal onClose={() => setShowScanner(false)} />}
    </div>
  );
};

export default DashboardLayout;

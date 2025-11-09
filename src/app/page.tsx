'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function Home() {
  const [selectedOption, setSelectedOption] = useState<'create' | 'join' | null>(null);
  const [joinRoomId, setJoinRoomId] = useState('');
  const router = useRouter();
  const { t } = useLanguage();

  const handleCreateRoom = () => {
    router.push('/login');
  };

  const handleJoinRoom = () => {
    setSelectedOption('join');
  };

  const handleJoinRoomSubmit = () => {
    if (joinRoomId.trim()) {
      router.push(`/room/${joinRoomId.trim()}`);
    }
  };

  const handleBack = () => {
    setSelectedOption(null);
    setJoinRoomId('');
  };

  return (
    <>
      <LanguageSwitcher />
      <div className="min-h-screen d-flex align-items-center justify-content-center p-4">
        <div className="glass-morphism p-5" style={{ maxWidth: '500px', width: '100%' }}>
          <div className="text-center mb-5">
            <h1 className="h2 mb-3">
              <i className="bi bi-chat-dots-fill text-primary me-2"></i>
              {t('app.title')}
            </h1>
            <p className="text-secondary">{t('app.subtitle')}</p>
          </div>

          {!selectedOption ? (
            <div className="d-grid gap-3">
              <button
                className="btn btn-primary btn-lg gradient-bg border-0 py-3"
                onClick={handleCreateRoom}
              >
                <div className="d-flex align-items-center justify-content-center">
                  <i className="bi bi-plus-circle me-3 fs-4"></i>
                  <div className="text-start">
                    <div className="fw-bold">{t('createRoom.title')}</div>
                    <small className="opacity-75">{t('createRoom.note')}</small>
                  </div>
                </div>
              </button>

              <button
                className="btn btn-outline-primary btn-lg border-2 py-3"
                onClick={handleJoinRoom}
              >
                <div className="d-flex align-items-center justify-content-center">
                  <i className="bi bi-door-open me-3 fs-4"></i>
                  <div className="text-start">
                    <div className="fw-bold">{t('joinRoom.title')}</div>
                    <small className="opacity-75">{t('joinRoom.note')}</small>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <h3 className="h4 mb-3">
                  <i className="bi bi-door-open text-primary me-2"></i>
                  {t('joinRoom.title')}
                </h3>
                <p className="text-secondary">{t('joinRoom.description')}</p>
              </div>

              <div className="mb-4">
                <label htmlFor="roomId" className="form-label">{t('joinRoom.title')}</label>
                <input
                  type="text"
                  className="form-control form-control-lg text-center"
                  id="roomId"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                  placeholder="Enter 8-character room ID"
                  maxLength={8}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinRoomSubmit()}
                />
              </div>

              <div className="d-grid gap-2">
                <button
                  className="btn btn-primary btn-lg gradient-bg border-0"
                  onClick={handleJoinRoomSubmit}
                  disabled={!joinRoomId.trim()}
                >
                  <i className="bi bi-box-arrow-in-right me-2"></i>
                  {t('common.continue')}
                </button>
                
                <button
                  className="btn btn-outline-secondary"
                  onClick={handleBack}
                >
                  <i className="bi bi-arrow-left me-2"></i>
                  {t('common.back')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
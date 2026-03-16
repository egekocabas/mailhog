import { useEffect, useState } from 'react';
import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { createDockerDesktopClient } from '@docker/extension-api-client';
import { fetchStatus, startMailHog, stopMailHog, restartMailHog, extractMessage, ConflictError, type MailHogStatus } from './api';
import { storage } from './storage';
import { SetupScreen } from './components/SetupScreen';
import { RunningHeader } from './components/RunningHeader';
import { MainTabs } from './components/MainTabs';
import { ConflictDialog } from './components/ConflictDialog';

const ddClient = createDockerDesktopClient();

export function App() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<'start' | 'stop' | 'restart' | null>(null);
  const [status, setStatus] = useState<MailHogStatus | null>(null);
  const [smtpPort, setSmtpPort] = useState(storage.getSmtpPort);
  const [uiPort,   setUiPort]   = useState(storage.getUiPort);
  const [conflictInfo, setConflictInfo] = useState<MailHogStatus | null>(null);

  const svc = ddClient.extension.vm!.service!;

  useEffect(() => {
    console.log('[App] initial status fetch');
    fetchStatus(svc)
      .then((s) => {
        console.log('[App] initial status:', s);
        setStatus(s);
        if (s.smtpHostPort) setSmtpPort(Number(s.smtpHostPort));
        if (s.uiHostPort) setUiPort(Number(s.uiHostPort));
      })
      .catch((err) => {
        console.error('[App] initial status error:', err);
        // Leave status = null → shows SetupScreen
      })
      .finally(() => setInitialLoading(false));
  }, []);

  const handleStart = async () => {
    console.log('[App] handleStart smtpPort=%d uiPort=%d', smtpPort, uiPort);
    setActiveAction('start');
    try {
      await startMailHog(svc, { smtpHostPort: smtpPort, uiHostPort: uiPort });
      const s = await fetchStatus(svc);
      console.log('[App] status after start:', s);
      setStatus(s);
      if (s.smtpHostPort) setSmtpPort(Number(s.smtpHostPort));
      if (s.uiHostPort) setUiPort(Number(s.uiHostPort));
      storage.setSmtpPort(smtpPort);
      storage.setUiPort(uiPort);
    } catch (err) {
      console.error('[App] handleStart error:', err);
      if (err instanceof ConflictError) {
        setConflictInfo(err.container);
      } else {
        ddClient.desktopUI.toast.error(extractMessage(err));
      }
    } finally {
      setActiveAction(null);
    }
  };

  const handleForceStart = async () => {
    setConflictInfo(null);
    setActiveAction('start');
    try {
      await restartMailHog(svc, { smtpHostPort: smtpPort, uiHostPort: uiPort });
      const s = await fetchStatus(svc);
      console.log('[App] status after force start:', s);
      setStatus(s);
      if (s.smtpHostPort) setSmtpPort(Number(s.smtpHostPort));
      if (s.uiHostPort) setUiPort(Number(s.uiHostPort));
      storage.setSmtpPort(smtpPort);
      storage.setUiPort(uiPort);
    } catch (err) {
      console.error('[App] handleForceStart error:', err);
      ddClient.desktopUI.toast.error(extractMessage(err));
    } finally {
      setActiveAction(null);
    }
  };

  const handleStop = async () => {
    console.log('[App] handleStop');
    setActiveAction('stop');
    try {
      await stopMailHog(svc);
      const s = await fetchStatus(svc);
      console.log('[App] status after stop:', s);
      setStatus(s);
    } catch (err) {
      console.error('[App] handleStop error:', err);
      ddClient.desktopUI.toast.error(extractMessage(err));
    } finally {
      setActiveAction(null);
    }
  };

  const handleRestart = async (newSmtp: number, newUi: number) => {
    console.log('[App] handleRestart smtpPort=%d uiPort=%d', newSmtp, newUi);
    setActiveAction('restart');
    try {
      await restartMailHog(svc, { smtpHostPort: newSmtp, uiHostPort: newUi });
      const s = await fetchStatus(svc);
      console.log('[App] status after restart:', s);
      setStatus(s);
      if (s.smtpHostPort) setSmtpPort(Number(s.smtpHostPort));
      if (s.uiHostPort) setUiPort(Number(s.uiHostPort));
      storage.setSmtpPort(newSmtp);
      storage.setUiPort(newUi);
    } catch (err) {
      console.error('[App] handleRestart error:', err);
      ddClient.desktopUI.toast.error(extractMessage(err));
    } finally {
      setActiveAction(null);
    }
  };

  if (initialLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const busy = activeAction !== null;

  const conflictDialog = (
    <ConflictDialog
      open={conflictInfo !== null}
      container={conflictInfo ?? { running: false }}
      loading={activeAction === 'start'}
      onConfirm={handleForceStart}
      onCancel={() => setConflictInfo(null)}
    />
  );

  if (!status?.running) {
    return (
      <>
        <SetupScreen
          smtpPort={smtpPort}
          uiPort={uiPort}
          loading={busy}
          onSmtpPortChange={setSmtpPort}
          onUiPortChange={setUiPort}
          onStart={handleStart}
        />
        <Backdrop open={busy} sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}>
          <CircularProgress />
        </Backdrop>
        {conflictDialog}
      </>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <RunningHeader
        smtpPort={smtpPort}
        uiPort={uiPort}
        activeAction={activeAction === 'stop' || activeAction === 'restart' ? activeAction : null}
        onRestart={handleRestart}
        onStop={handleStop}
      />
      <MainTabs uiHostPort={status.uiHostPort} ddClient={ddClient} />
      <Backdrop open={busy} sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}>
        <CircularProgress />
      </Backdrop>
      {conflictDialog}
    </Box>
  );
}

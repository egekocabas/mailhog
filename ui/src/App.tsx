import { useEffect, useState } from 'react';
import Backdrop from '@mui/material/Backdrop';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { createDockerDesktopClient } from '@docker/extension-api-client';
import { fetchStatus, fetchSettings, saveSettings, startMailHog, stopMailHog, restartMailHog, removeMailHog, extractMessage, ConflictError, type MailHogStatus } from './api';
import { SetupScreen } from './components/SetupScreen';
import { RunningHeader } from './components/RunningHeader';
import { MainTabs } from './components/MainTabs';
import { ConflictDialog } from './components/ConflictDialog';

const ddClient = createDockerDesktopClient();

export function App() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeAction, setActiveAction] = useState<'start' | 'stop' | 'restart' | null>(null);
  const [status, setStatus] = useState<MailHogStatus | null>(null);
  const [smtpPort, setSmtpPort] = useState(1025);
  const [uiPort,   setUiPort]   = useState(8025);
  const [zoom,     setZoom]     = useState(1.0);
  const [conflictInfo, setConflictInfo] = useState<MailHogStatus | null>(null);

  const svc = ddClient.extension.vm!.service!;

  useEffect(() => {
    console.log('[App] initial fetch');
    Promise.all([fetchStatus(svc), fetchSettings(svc)])
      .then(async ([s, cfg]) => {
        console.log('[App] initial status:', s, 'settings:', cfg);
        const resolvedSmtp = s.smtpHostPort ? Number(s.smtpHostPort) : cfg.smtpPort;
        const resolvedUi   = s.uiHostPort   ? Number(s.uiHostPort)   : cfg.uiPort;
        setSmtpPort(resolvedSmtp);
        setUiPort(resolvedUi);
        setZoom(cfg.zoom);

        if (!s.running && s.containerID) {
          // Stopped labeled container exists — auto-restart it silently
          try {
            await startMailHog(svc, { smtpHostPort: resolvedSmtp, uiHostPort: resolvedUi });
            const resumed = await fetchStatus(svc);
            console.log('[App] auto-resumed status:', resumed);
            if (resumed.smtpHostPort) setSmtpPort(Number(resumed.smtpHostPort));
            if (resumed.uiHostPort) setUiPort(Number(resumed.uiHostPort));
            setStatus(resumed);
          } catch (err) {
            console.error('[App] auto-resume failed, removing container:', err);
            removeMailHog(svc).catch(() => {/* ignore removal failure */});
            setStatus({ running: false }); // fall back to SetupScreen
          }
        } else {
          setStatus(s);
        }
      })
      .catch((err) => {
        console.error('[App] initial fetch error:', err);
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
      saveSettings(svc, { smtpPort, uiPort, zoom }).catch(() => {/* non-fatal */});
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
      saveSettings(svc, { smtpPort, uiPort, zoom }).catch(() => {/* non-fatal */});
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
      saveSettings(svc, { smtpPort: newSmtp, uiPort: newUi, zoom }).catch(() => {/* non-fatal */});
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
        smtpPort={status.smtpHostPort ? Number(status.smtpHostPort) : 0}
        uiPort={status.uiHostPort ? Number(status.uiHostPort) : 0}
        activeAction={activeAction === 'stop' || activeAction === 'restart' ? activeAction : null}
        onRestart={handleRestart}
        onStop={handleStop}
      />
      <MainTabs uiHostPort={status.uiHostPort} ddClient={ddClient} zoom={zoom} onZoomChange={(z) => { setZoom(z); saveSettings(svc, { smtpPort, uiPort, zoom: z }).catch(() => {/* non-fatal */}); }} />
      <Backdrop open={busy} sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}>
        <CircularProgress />
      </Backdrop>
      {conflictDialog}
    </Box>
  );
}

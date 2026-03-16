import { useState } from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Box from '@mui/material/Box';
import { PortConfigForm } from './PortConfigForm';

interface RestartDialogProps {
  open: boolean;
  smtpPort: number;
  uiPort: number;
  loading: boolean;
  onClose: () => void;
  onRestart: (smtpPort: number, uiPort: number) => void;
}

export function RestartDialog({
  open,
  smtpPort,
  uiPort,
  loading,
  onClose,
  onRestart,
}: RestartDialogProps) {
  const [localSmtp, setLocalSmtp] = useState(smtpPort);
  const [localUi, setLocalUi] = useState(uiPort);

  // Sync with parent when dialog opens
  const handleEnter = () => {
    setLocalSmtp(smtpPort);
    setLocalUi(uiPort);
  };

  return (
    <Dialog open={open} onClose={onClose} TransitionProps={{ onEnter: handleEnter }} maxWidth="xs" fullWidth>
      <DialogTitle>Restart MailHog</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <PortConfigForm
            smtpPort={localSmtp}
            uiPort={localUi}
            onSmtpPortChange={setLocalSmtp}
            onUiPortChange={setLocalUi}
            disabled={loading}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => onRestart(localSmtp, localUi)}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {loading ? 'Restarting…' : 'Restart'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

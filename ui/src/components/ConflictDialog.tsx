import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { MailHogStatus } from '../api';

interface ConflictDialogProps {
  open: boolean;
  container: MailHogStatus;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConflictDialog({ open, container, loading, onConfirm, onCancel }: ConflictDialogProps) {
  return (
    <Dialog open={open} onClose={loading ? undefined : onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Container Already Exists</DialogTitle>
      <DialogContent>
        <DialogContentText gutterBottom>
          A container named <code>mailhog-extension</code> already exists. Remove it and start a fresh one, or cancel to keep it as-is.
        </DialogContentText>
        <Stack spacing={1} sx={{ mt: 2 }}>
          {container.containerID && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>ID</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {container.containerID.slice(0, 12)}
              </Typography>
            </Stack>
          )}
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>Status</Typography>
            {container.running
              ? <Chip size="small" color="error" label="Running" />
              : <Chip size="small" color="default" label="Stopped" />
            }
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>SMTP port</Typography>
            <Typography variant="body2">{container.smtpHostPort ?? 'not bound'}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>Web UI port</Typography>
            <Typography variant="body2">{container.uiHostPort ?? 'not bound'}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button
          variant="contained"
          color="warning"
          onClick={onConfirm}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Remove &amp; Start
        </Button>
      </DialogActions>
    </Dialog>
  );
}

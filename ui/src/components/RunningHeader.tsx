import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { RestartDialog } from './RestartDialog';

interface RunningHeaderProps {
  smtpPort: number;
  uiPort: number;
  activeAction: 'stop' | 'restart' | null;
  onRestart: (smtpPort: number, uiPort: number) => void;
  onStop: () => void;
}

export function RunningHeader({
  smtpPort,
  uiPort,
  activeAction,
  onRestart,
  onStop,
}: RunningHeaderProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const smtpLabel = smtpPort > 0 ? `:${smtpPort}` : 'no binding';
  const uiLabel = uiPort > 0 ? `:${uiPort}` : 'no binding';

  return (
    <>
      <Paper
        variant="outlined"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 1.5,
          py: 1,
          borderRadius: 0,
          borderLeft: 'none',
          borderRight: 'none',
          borderTop: 'none',
        }}
      >
        <Chip label="Running" color="success" size="small" />
        <Typography variant="body2" color="text.secondary">
          SMTP {smtpLabel} &nbsp;·&nbsp; Web UI {uiLabel}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          size="small"
          onClick={() => setDialogOpen(true)}
          disabled={activeAction !== null}
          startIcon={activeAction === 'restart' ? <CircularProgress size={14} color="inherit" /> : <RestartAltIcon fontSize="small" />}
        >
          {activeAction === 'restart' ? 'Restarting…' : 'Restart'}
        </Button>
        <Button
          variant="outlined"
          size="small"
          color="error"
          onClick={onStop}
          disabled={activeAction !== null}
          startIcon={activeAction === 'stop' ? <CircularProgress size={14} color="inherit" /> : <StopCircleIcon fontSize="small" />}
        >
          {activeAction === 'stop' ? 'Stopping…' : 'Stop'}
        </Button>
      </Paper>
      <RestartDialog
        open={dialogOpen}
        smtpPort={smtpPort}
        uiPort={uiPort}
        loading={activeAction === 'restart'}
        onClose={() => setDialogOpen(false)}
        onRestart={(smtp, ui) => {
          setDialogOpen(false);
          onRestart(smtp, ui);
        }}
      />
    </>
  );
}

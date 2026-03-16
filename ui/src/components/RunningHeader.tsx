import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { RestartDialog } from './RestartDialog';

interface RunningHeaderProps {
  containerName: string | undefined;
  smtpPort: number;
  uiPort: number;
  activeAction: 'stop' | 'restart' | null;
  onRestart: (smtpPort: number, uiPort: number) => void;
  onStop: () => void;
  onOpenUI: () => void;
}

export function RunningHeader({
  containerName,
  smtpPort,
  uiPort,
  activeAction,
  onRestart,
  onStop,
  onOpenUI,
}: RunningHeaderProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const uiLabel   = uiPort   > 0 ? `:${uiPort}`   : 'no binding';
  const smtpLabel = smtpPort > 0 ? `:${smtpPort}` : 'no binding';

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
        <Tooltip title={containerName ?? ''} placement="bottom">
          <Chip label="Running" color="success" size="small" />
        </Tooltip>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Web UI {uiLabel}
          </Typography>
          {uiPort > 0 && (
            <Tooltip title="Open in browser">
              <IconButton size="small" onClick={onOpenUI}>
                <OpenInNewIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
          <Typography variant="body2" color="text.secondary">
            &nbsp;·&nbsp; SMTP {smtpLabel}
          </Typography>
        </Box>
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

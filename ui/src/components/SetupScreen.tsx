import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { PortConfigForm } from './PortConfigForm';

interface SetupScreenProps {
  smtpPort: number;
  uiPort: number;
  loading: boolean;
  onSmtpPortChange: (port: number) => void;
  onUiPortChange: (port: number) => void;
  onStart: () => void;
}

export function SetupScreen({
  smtpPort,
  uiPort,
  loading,
  onSmtpPortChange,
  onUiPortChange,
  onStart,
}: SetupScreenProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
      }}
    >
      <Box sx={{ maxWidth: 480, width: '100%', px: 3 }}>
        <Typography variant="h5" gutterBottom>
          Start MailHog
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          MailHog is a lightweight SMTP testing server. Configure the host ports below and click
          Start to launch it.
        </Typography>
        <PortConfigForm
          smtpPort={smtpPort}
          uiPort={uiPort}
          onSmtpPortChange={onSmtpPortChange}
          onUiPortChange={onUiPortChange}
          disabled={loading}
        />
        <Button
          variant="contained"
          onClick={onStart}
          disabled={loading}
          sx={{ mt: 3 }}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          fullWidth
        >
          {loading ? 'Starting…' : 'Start'}
        </Button>
      </Box>
    </Box>
  );
}

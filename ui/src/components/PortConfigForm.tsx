import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';

const SMTP_DEFAULT = 1025;
const UI_DEFAULT   = 8025;

interface PortConfigFormProps {
  smtpPort: number;
  uiPort: number;
  onSmtpPortChange: (port: number) => void;
  onUiPortChange: (port: number) => void;
  disabled?: boolean;
}

function HelperText({
  label,
  defaultValue,
  onReset,
  disabled,
}: {
  label: string;
  defaultValue: number;
  onReset: () => void;
  disabled?: boolean;
}) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      Default: {defaultValue}
      <Tooltip title={`Reset to default (${defaultValue})`}>
        <span>
          <IconButton
            size="small"
            onClick={onReset}
            disabled={disabled}
            sx={{ p: 0, fontSize: 'inherit', verticalAlign: 'middle' }}
            aria-label={`Reset ${label} to default`}
          >
            <SettingsBackupRestoreIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

export function PortConfigForm({
  smtpPort,
  uiPort,
  onSmtpPortChange,
  onUiPortChange,
  disabled,
}: PortConfigFormProps) {
  return (
    <Stack spacing={2}>
      <TextField
        label="SMTP Port"
        type="number"
        value={smtpPort}
        onChange={(e) => onSmtpPortChange(Number(e.target.value))}
        inputProps={{ min: 0, max: 65535 }}
        helperText={
          <HelperText
            label="SMTP Port"
            defaultValue={SMTP_DEFAULT}
            onReset={() => onSmtpPortChange(SMTP_DEFAULT)}
            disabled={disabled}
          />
        }
        disabled={disabled}
        fullWidth
      />
      <TextField
        label="Web UI Port"
        type="number"
        value={uiPort}
        onChange={(e) => onUiPortChange(Number(e.target.value))}
        inputProps={{ min: 0, max: 65535 }}
        helperText={
          <HelperText
            label="Web UI Port"
            defaultValue={UI_DEFAULT}
            onReset={() => onUiPortChange(UI_DEFAULT)}
            disabled={disabled}
          />
        }
        disabled={disabled}
        fullWidth
      />
    </Stack>
  );
}

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import type { DockerDesktopClient } from '@docker/extension-api-client-types/dist/v1';
import { sendTestEmail, extractMessage } from '../api';

interface TestEmailTabProps {
  ddClient: DockerDesktopClient;
}

export function TestEmailTab({ ddClient }: TestEmailTabProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<'delivered' | 'unverified' | null>(null);

  const canSend = from.trim() && to.trim() && subject.trim() && body.trim() && !sending;

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      const svc = ddClient.extension.vm!.service!;
      const resp = await sendTestEmail(svc, { from, to, subject, body });
      setResult(resp.delivered ? 'delivered' : 'unverified');
    } catch (err) {
      ddClient.desktopUI.toast.error(extractMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Box sx={{ pt: 3, px: 3 }}>
      <Stack spacing={2} sx={{ maxWidth: 520 }}>
        <TextField
          label="From"
          type="email"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          disabled={sending}
          fullWidth
        />
        <TextField
          label="To"
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          disabled={sending}
          fullWidth
        />
        <TextField
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={sending}
          fullWidth
        />
        <TextField
          label="Body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={sending}
          multiline
          minRows={4}
          fullWidth
        />
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={!canSend}
          startIcon={sending ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          {sending ? 'Sending…' : 'Send Test Email'}
        </Button>
        {result === 'delivered' && (
          <Alert severity="success">Email delivered successfully.</Alert>
        )}
        {result === 'unverified' && (
          <Alert severity="warning">Email sent but delivery could not be verified.</Alert>
        )}
      </Stack>
    </Box>
  );
}

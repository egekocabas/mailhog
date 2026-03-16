import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { DockerDesktopClient } from '@docker/extension-api-client-types/dist/v1';
import { storage } from '../storage';

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;

interface WebUITabProps {
  uiHostPort: string | undefined;
  ddClient: DockerDesktopClient;
}

export function WebUITab({ uiHostPort, ddClient }: WebUITabProps) {
  const [zoom, setZoom] = useState(storage.getZoom);

  const hasBinding = uiHostPort && uiHostPort !== '0';
  const url = hasBinding ? `http://localhost:${uiHostPort}` : '';

  const changeZoom = (next: number) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(next * 10) / 10));
    setZoom(clamped);
    storage.setZoom(clamped);
  };

  const zoomIn  = () => changeZoom(zoom + ZOOM_STEP);
  const zoomOut = () => changeZoom(zoom - ZOOM_STEP);

  if (!hasBinding) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexGrow: 1,
          p: 4,
        }}
      >
        <Box sx={{ maxWidth: 400, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            No host binding configured
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The MailHog Web UI port is not bound to the host. Restart MailHog with a Web UI port
            configured to access the inbox here.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {url}
        </Typography>
        <Tooltip title="Open in browser">
          <IconButton size="small" onClick={() => ddClient.host.openExternal(url)}>
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{ flexGrow: 1 }} />
        <ButtonGroup size="small" variant="outlined">
          <Tooltip title="Zoom out">
            <span>
              <IconButton size="small" onClick={zoomOut} disabled={zoom <= ZOOM_MIN}>
                <ZoomOutIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Button disabled sx={{ minWidth: 52, pointerEvents: 'none', fontSize: '0.75rem' }}>
            {Math.round(zoom * 100)}%
          </Button>
          <Tooltip title="Zoom in">
            <span>
              <IconButton size="small" onClick={zoomIn} disabled={zoom >= ZOOM_MAX}>
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </ButtonGroup>
      </Box>
      <Divider />
      {/* Outer box clips the scaled iframe to its bounds */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden', position: 'relative' }}>
        <Box
          component="iframe"
          src={url}
          title="MailHog Web UI"
          sx={{
            border: 'none',
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${100 / zoom}%`,
            height: `${100 / zoom}%`,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
          }}
        />
      </Box>
    </Box>
  );
}

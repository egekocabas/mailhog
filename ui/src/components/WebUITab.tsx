import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { DockerDesktopClient } from '@docker/extension-api-client-types/dist/v1';

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;

interface WebUITabProps {
  uiHostPort: string | undefined;
  ddClient: DockerDesktopClient;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export function WebUITab({ uiHostPort, ddClient, zoom, onZoomChange }: WebUITabProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const hasBinding = uiHostPort && uiHostPort !== '0';
  const url = hasBinding ? `http://localhost:${uiHostPort}` : '';

  const changeZoom = (next: number) => {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(next * 10) / 10));
    onZoomChange(clamped);
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
            ...(isDark && { filter: 'invert(1) hue-rotate(180deg)' }),
          }}
        />
        {/* Cross-origin workaround: overlay opaque divs to hide MailHog's navbar-brand and GitHub link.
            CSS injection into the iframe is blocked because it's a different origin (localhost:port). */}
        {[
          { left: 0, width: `${170 * zoom}px` },   // covers .navbar-brand (logo + "MailHog" text)
          { right: 0, width: `${130 * zoom}px` },   // covers .navbar-right (GitHub link)
        ].map((pos, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              top: 0,
              height: `${50 * zoom}px`,
              bgcolor: isDark ? '#070707': '#F8F8F8' ,
              zIndex: 1,
              pointerEvents: 'none',
              ...pos,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

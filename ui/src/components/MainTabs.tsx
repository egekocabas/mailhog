import { useState } from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import type { DockerDesktopClient } from '@docker/extension-api-client-types/dist/v1';
import { WebUITab } from './WebUITab';
import { TestEmailTab } from './TestEmailTab';

interface MainTabsProps {
  uiHostPort: string | undefined;
  ddClient: DockerDesktopClient;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

export function MainTabs({ uiHostPort, ddClient, zoom, onZoomChange }: MainTabsProps) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ flexShrink: 0, borderBottom: 1, borderColor: 'divider', mt: 1 }}>
        <Tab label="Web UI" />
        <Tab label="Test Email" />
      </Tabs>
      <Box
        role="tabpanel"
        hidden={activeTab !== 0}
        sx={{ flexGrow: 1, display: activeTab === 0 ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden', pt: 1 }}
      >
        <WebUITab uiHostPort={uiHostPort} zoom={zoom} onZoomChange={onZoomChange} />
      </Box>
      <Box
        role="tabpanel"
        hidden={activeTab !== 1}
        sx={{ flexGrow: 1, minHeight: 0, display: activeTab === 1 ? 'flex' : 'none', flexDirection: 'column', overflow: 'auto' }}
      >
        <TestEmailTab ddClient={ddClient} />
      </Box>
    </Box>
  );
}

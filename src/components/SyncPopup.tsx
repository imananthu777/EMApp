import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Stack,
  Alert,
  LinearProgress,
  Box,
} from '@mui/material';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import { clearUserCache } from '../lib/userDataService';

interface SyncPopupProps {
  open: boolean;
  onClose: () => void;
  onSync: () => Promise<void>;
  userId?: string;
  lastSync?: number;
}

export default function SyncPopup({ 
  open, 
  onClose, 
  onSync, 
  userId,
  lastSync = 0
}: SyncPopupProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Reset state when popup opens
  useEffect(() => {
    if (open) {
      setSyncStatus('idle');
      setSyncError(null);
      setProgress(0);
    }
  }, [open]);

  // Simulate progress for better UX
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (syncStatus === 'syncing') {
      timer = setInterval(() => {
        setProgress(prev => {
          // Incrementally increase up to 90% (the last 10% will be filled on completion)
          if (prev < 90) {
            return prev + (90 - prev) / 10;
          }
          return prev;
        });
      }, 300);
    } else if (syncStatus === 'success') {
      setProgress(100);
    }
    
    return () => clearInterval(timer);
  }, [syncStatus]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncStatus('syncing');
    setSyncError(null);
    
    try {
      await onSync();
      setSyncStatus('success');
    } catch (error: any) {
      console.error('Sync error:', error);
      setSyncStatus('error');
      setSyncError(error.message || 'Unknown error during synchronization');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearCache = () => {
    if (userId) {
      clearUserCache(userId);
      setSyncStatus('idle');
      setSyncError(null);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={syncStatus === 'syncing' ? undefined : onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          p: 1
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {syncStatus === 'syncing' && <CloudSyncIcon color="primary" />}
        {syncStatus === 'success' && <CloudDoneIcon color="success" />}
        {syncStatus === 'error' && <CloudOffIcon color="error" />}
        {syncStatus === 'idle' && <CloudSyncIcon color="primary" />}
        Sync Data
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={2}>
          {syncStatus === 'syncing' && (
            <>
              <Typography variant="body1">
                Synchronizing your data with the cloud...
              </Typography>
              <Box sx={{ width: '100%', mt: 2, mb: 1 }}>
                <LinearProgress variant="determinate" value={progress} />
              </Box>
              <Typography variant="caption" color="text.secondary" align="center">
                Please don't close this window until the sync is complete
              </Typography>
            </>
          )}
          
          {syncStatus === 'success' && (
            <Alert severity="success">
              Your data has been successfully synchronized with the cloud.
            </Alert>
          )}
          
          {syncStatus === 'error' && (
            <Alert severity="error">
              {syncError || 'An error occurred during synchronization.'}
              <Button 
                size="small" 
                color="inherit" 
                onClick={handleClearCache}
                sx={{ ml: 1 }}
              >
                Clear Cache
              </Button>
            </Alert>
          )}
          
          {syncStatus === 'idle' && (
            <>
              <Typography variant="body1">
                Synchronize your local data with the cloud to:
              </Typography>
              <ul style={{ marginTop: 0, paddingLeft: 24 }}>
                <li>Access your data on multiple devices</li>
                <li>Protect against data loss</li>
                <li>Keep all your devices in sync</li>
              </ul>
              
              {lastSync > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Last synchronized: {new Date(lastSync).toLocaleString()}
                </Typography>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      
      <DialogActions>
        <Button 
          onClick={onClose} 
          disabled={syncStatus === 'syncing'}
          variant="text"
          color="inherit"
        >
          {syncStatus === 'success' || syncStatus === 'error' ? 'Close' : 'Cancel'}
        </Button>
        
        {(syncStatus === 'idle' || syncStatus === 'error') && (
          <Button 
            onClick={handleSync} 
            variant="contained" 
            color="primary" 
            disabled={syncing}
            startIcon={syncing ? <CircularProgress size={16} /> : <CloudSyncIcon />}
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        )}
        
        {syncStatus === 'success' && (
          <Button 
            onClick={onClose} 
            variant="contained" 
            color="success"
            startIcon={<CloudDoneIcon />}
          >
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
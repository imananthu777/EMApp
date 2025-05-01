import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  IconButton,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';

export default function SyncPopup({ open, onClose, onSync }: { open: boolean; onClose: () => void; onSync: () => void }) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    await onSync();
    setSyncing(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Sync Transactions</DialogTitle>
      <DialogContent>
        <Typography>Do you want to upload your locally stored transaction data to the server?</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={syncing}>Cancel</Button>
        <Button onClick={handleSync} variant="contained" color="primary" disabled={syncing}>
          {syncing ? <CircularProgress size={20} /> : 'Sync Now'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
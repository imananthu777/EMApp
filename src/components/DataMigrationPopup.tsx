import { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Button } from '@mui/material';
import { saveUserData, saveUserDataByType } from '../lib/userDataService';

interface MigrationPopupProps {
  user: any;
  onComplete: () => void;
}

export default function DataMigrationPopup({ user, onComplete }: MigrationPopupProps) {
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'migrating' | 'complete' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const migrateData = async () => {
    setMigrationStatus('migrating');
    setProgress(10);
    
    try {
      // Step 1: Get all data from localStorage
      const userDataTypes = [
        { key: `transactions_${user.id}`, type: 'transactions' },
        { key: `budget_${user.id}`, type: 'monthlyBudget' },
        { key: `categories_${user.id}`, type: 'categories' },
        { key: `archive_${user.id}_last_month`, type: 'archivedMonth' }
      ];
      
      // First, migrate user profile data
      setProgress(20);
      const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
      const userData = registeredUsers[user.id];
      
      if (userData) {
        await saveUserData({
          mobile: user.id,
          data: userData
        });
      }
      
      setProgress(40);
      
      // Step 2: Migrate each data type if it exists
      let migratedItems = 0;
      const totalItems = userDataTypes.length;
      
      for (const { key, type } of userDataTypes) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            await saveUserDataByType({
              mobile: user.id,
              name: user.name,
              dataType: type,
              data: JSON.parse(data)
            });
            migratedItems++;
            setProgress(40 + Math.floor((migratedItems / totalItems) * 50));
          } catch (err) {
            console.error(`Error migrating ${type}:`, err);
            // Continue with other items even if one fails
          }
        }
      }
      
      // Step 3: Migrate FY archives if they exist
      const fyPattern = new RegExp(`^archive_${user.id}_fy_`);
      const fyKeys = Object.keys(localStorage).filter(key => fyPattern.test(key));
      
      for (const key of fyKeys) {
        const data = localStorage.getItem(key);
        if (data) {
          try {
            const fyYear = key.split('_').pop();
            await saveUserDataByType({
              mobile: user.id,
              name: user.name,
              dataType: `fy_archive_${fyYear}`,
              data: JSON.parse(data)
            });
          } catch (err) {
            console.error(`Error migrating FY archive ${key}:`, err);
          }
        }
      }
      
      setProgress(100);
      setMigrationStatus('complete');
    } catch (error) {
      console.error('Migration error:', error);
      setErrorMessage(typeof error === 'string' ? error : 'Failed to migrate data to cloud storage.');
      setMigrationStatus('error');
    }
  };

  useEffect(() => {
    // Check if migration is needed
    const migrationFlag = localStorage.getItem(`migration_complete_${user.id}`);
    if (!migrationFlag) {
      // Don't auto-start migration, let user trigger it
      setMigrationStatus('idle');
    } else {
      // Skip migration if already done
      onComplete();
    }
  }, [user.id, onComplete]);

  const handleComplete = () => {
    // Set flag to avoid showing migration again
    localStorage.setItem(`migration_complete_${user.id}`, 'true');
    onComplete();
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 4,
        maxWidth: 500,
        mx: 'auto',
        textAlign: 'center',
        backgroundColor: 'background.paper',
        borderRadius: 2,
        boxShadow: 3,
      }}
    >
      <Typography variant="h5" gutterBottom fontWeight="bold">
        Data Migration to Cloud Storage
      </Typography>
      
      <Typography variant="body1" paragraph>
        We're upgrading to secure cloud storage for your data. This ensures your financial information is always available across devices and never lost.
      </Typography>
      
      {migrationStatus === 'idle' && (
        <>
          <Button
            variant="contained"
            color="primary"
            onClick={migrateData}
            sx={{ mt: 3 }}
            fullWidth
          >
            Start Migration
          </Button>
          <Button
            variant="text"
            onClick={handleComplete}
            sx={{ mt: 2 }}
          >
            Skip for now (Not recommended)
          </Button>
        </>
      )}
      
      {migrationStatus === 'migrating' && (
        <Box sx={{ width: '100%', mt: 4 }}>
          <CircularProgress
            variant="determinate"
            value={progress}
            size={60}
            thickness={5}
            sx={{ mb: 2 }}
          />
          <Typography variant="body2" color="text.secondary">
            Moving your data to secure cloud storage ({progress}%)
          </Typography>
        </Box>
      )}
      
      {migrationStatus === 'complete' && (
        <>
          <Typography variant="body1" color="success.main" sx={{ mt: 3, mb: 3 }}>
            Migration successful! Your data is now safely stored in the cloud.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={handleComplete}
          >
            Continue to App
          </Button>
        </>
      )}
      
      {migrationStatus === 'error' && (
        <>
          <Typography variant="body1" color="error" sx={{ mt: 3, mb: 1 }}>
            An error occurred during migration.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {errorMessage || "Please try again. If the problem persists, you can continue without migration, but your data may not be saved correctly."}
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={migrateData}
            sx={{ mr: 2 }}
          >
            Try Again
          </Button>
          <Button
            variant="outlined"
            onClick={handleComplete}
          >
            Continue Anyway
          </Button>
        </>
      )}
    </Box>
  );
}
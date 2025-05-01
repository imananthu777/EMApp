import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Stack } from '@mui/material';

const featureCards = [
  {
    title: 'Dashboard Overview',
    description: 'Get a quick summary of your current balance, total expenses, and projected balance for the month.',
  },
  {
    title: 'Transactions',
    description: 'Add, edit, or delete your income and expense transactions to keep track of your finances.',
  },
  {
    title: 'Monthly Budget',
    description: 'Set your monthly budget and allocate amounts to different categories to manage your spending.',
  },
  {
    title: 'Category Management',
    description: 'Add or edit categories to organize your transactions effectively.',
  },
  {
    title: 'Data Management',
    description: 'End the current month, download transaction data, or reset your data as needed.',
  },
];

export default function FirstTimePopup({ onClose }: { onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < featureCards.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{featureCards[currentStep].title}</DialogTitle>
      <DialogContent>
        <Typography>{featureCards[currentStep].description}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleNext} variant="contained" color="primary">
          {currentStep < featureCards.length - 1 ? 'Next' : 'Finish'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
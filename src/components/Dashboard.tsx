import {
  Box,
  Typography,
  Paper,
  Stack,
  IconButton,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  MenuItem,
  LinearProgress,
  CircularProgress,
  Fade,
  Chip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
} from 'chart.js';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ChartTooltip,
  Legend
);

interface Transaction {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  type: 'expense' | 'income';
  financialYear?: string;
}

interface MonthlyBudget {
  id: string;
  amount: number;
  month: string;
  categories: {
    [key: string]: number;
  };
}

interface Category {
  name: string;
  type: 'income' | 'expense';
  color: string;
}

const defaultCategories: Category[] = [
  { name: 'Salary', type: 'income', color: '#4CAF50' },
  { name: 'Freelance', type: 'income', color: '#2196F3' },
  { name: 'Food', type: 'expense', color: '#F44336' },
  { name: 'Transport', type: 'expense', color: '#FF9800' },
  { name: 'Shopping', type: 'expense', color: '#9C27B0' },
  { name: 'Bills', type: 'expense', color: '#795548' },
];

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  width: '100%',
  boxSizing: 'border-box',
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
    margin: theme.spacing(0, 0, 1.5, 0),
  },
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(3),
    margin: theme.spacing(0, 0, 2, 0),
  },
  [theme.breakpoints.up('md')]: {
    padding: theme.spacing(4),
    margin: theme.spacing(0, 0, 3, 0),
  },
  borderRadius: theme.spacing(2),
  boxShadow: theme.shadows[2],
  transition: theme.transitions.create(['margin', 'padding', 'box-shadow']),
  '&:hover': {
    boxShadow: theme.shadows[4],
  }
}));

const formatIndianCurrency = (amount: number) => {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return formatter.format(amount);
};

export default function Dashboard({ user, onLogout }: { user: any, onLogout: () => void }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<MonthlyBudget | null>(null);
  const [categories, setCategories] = useState<Category[]>(() => {
    const savedCategories = localStorage.getItem(`categories_${user.id}`);
    return savedCategories ? JSON.parse(savedCategories) : defaultCategories;
  });
  const [isTransactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [isBudgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [newTransaction, setNewTransaction] = useState<Partial<Transaction>>({
    type: 'expense',
    date: new Date().toISOString().split('T')[0],
  });
  const [tempBudget, setTempBudget] = useState<{
    total: number;
    categories: { [key: string]: number };
  }>({ total: 0, categories: {} });
  const [newCategory, setNewCategory] = useState<Partial<Category>>({
    type: 'expense',
    color: '#000000'
  });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [currentFY, setCurrentFY] = useState<string>('');

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const fy = month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    setCurrentFY(fy);

    const savedTransactions = localStorage.getItem(`transactions_${user.id}`);
    const savedBudget = localStorage.getItem(`budget_${user.id}`);
    if (savedTransactions) {
      const parsedTransactions = JSON.parse(savedTransactions);
      const updatedTransactions = parsedTransactions.map((t: Transaction) => ({
        ...t,
        financialYear: t.financialYear || getFYFromDate(t.date)
      }));
      setTransactions(updatedTransactions);
      localStorage.setItem(`transactions_${user.id}`, JSON.stringify(updatedTransactions));
    }
    if (savedBudget) {
      const budget = JSON.parse(savedBudget);
      setMonthlyBudget(budget);
      setTempBudget({
        total: budget.amount,
        categories: budget.categories || {}
      });
    }
  }, [user.id]);

  useEffect(() => {
    localStorage.setItem(`categories_${user.id}`, JSON.stringify(categories));
  }, [categories, user.id]);

  const getFYFromDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  };

  const handleSaveTransaction = () => {
    if (!newTransaction.amount || newTransaction.amount <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }
    if (!newTransaction.category) {
      alert('Please select a category');
      return;
    }
    if (!newTransaction.description) {
      alert('Please enter a description');
      return;
    }
    if (!newTransaction.date) {
      alert('Please select a date');
      return;
    }

    const transactionToSave: Transaction = {
      id: selectedTransaction?.id || Date.now().toString(),
      amount: Number(newTransaction.amount),
      category: newTransaction.category,
      description: newTransaction.description,
      date: newTransaction.date,
      type: newTransaction.type || 'expense',
      financialYear: getFYFromDate(newTransaction.date)
    };

    const updatedTransactions = selectedTransaction 
      ? transactions.map(t => t.id === selectedTransaction.id ? transactionToSave : t)
      : [...transactions, transactionToSave];
    
    setTransactions(updatedTransactions);
    localStorage.setItem(`transactions_${user.id}`, JSON.stringify(updatedTransactions));
    setTransactionDialogOpen(false);
    setSelectedTransaction(null);
    setNewTransaction({ type: 'expense', date: new Date().toISOString().split('T')[0] });
  };

  const handleDeleteTransaction = (id: string) => {
    const updatedTransactions = transactions.filter(t => t.id !== id);
    setTransactions(updatedTransactions);
    localStorage.setItem(`transactions_${user.id}`, JSON.stringify(updatedTransactions));
  };

  // Commented out unused function
  // const handleEditTransaction = (transaction: Transaction) => {
  //   setSelectedTransaction(transaction);
  //   setNewTransaction(transaction);
  //   setTransactionDialogOpen(true);
  // };

  const handleUpdateBudget = (values: { total: number, categories: { [key: string]: number } }) => {
    const newBudget: MonthlyBudget = {
      id: monthlyBudget?.id || Date.now().toString(),
      amount: values.total,
      month: new Date().toISOString().slice(0, 7),
      categories: values.categories,
    };
    setMonthlyBudget(newBudget);
    localStorage.setItem(`budget_${user.id}`, JSON.stringify(newBudget));
    setBudgetDialogOpen(false);
  };

  const handleOpenBudgetDialog = () => {
    setTempBudget({
      total: monthlyBudget?.amount || 0,
      categories: monthlyBudget?.categories || {}
    });
    setBudgetDialogOpen(true);
  };

  const handleMonthEnd = () => {
    const archiveKey = `archive_${user.id}_${new Date().toISOString().slice(0, 7)}`;
    localStorage.setItem(archiveKey, JSON.stringify({
      transactions,
      budget: monthlyBudget,
      endDate: new Date().toISOString(),
    }));

    setTransactions([]);
    localStorage.setItem(`transactions_${user.id}`, JSON.stringify([]));
    
    if (monthlyBudget) {
      const newBudget = {
        ...monthlyBudget,
        id: Date.now().toString(),
        month: new Date().toISOString().slice(0, 7),
      };
      setMonthlyBudget(newBudget);
      localStorage.setItem(`budget_${user.id}`, JSON.stringify(newBudget));
    }
  };

  const calculateTotalExpenses = () => {
    return transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const calculateProgressPercentage = () => {
    if (!monthlyBudget || monthlyBudget.amount === 0) return 0;
    const percentage = (calculateTotalExpenses() / monthlyBudget.amount) * 100;
    return Math.min(percentage, 100);
  };

  const calculateCategoryExpenses = () => {
    return categories
      .filter(c => c.type === 'expense')
      .map(category => ({
        name: category.name,
        spent: transactions
          .filter(t => t.type === 'expense' && t.category === category.name)
          .reduce((sum, t) => sum + t.amount, 0),
        budget: monthlyBudget?.categories[category.name] || 0,
        color: category.color
      }));
  };

  const handleSaveCategory = () => {
    if (!newCategory.name || !newCategory.type || !newCategory.color) return;

    if (editingCategory) {
      setCategories(categories.map(cat => 
        cat.name === editingCategory.name ? newCategory as Category : cat
      ));
      setEditingCategory(null);
    } else {
      setCategories([...categories, newCategory as Category]);
    }
    
    setNewCategory({ type: 'expense', color: '#000000' });
    setCategoryDialogOpen(false);
  };

  const handleDeleteCategory = (categoryName: string) => {
    const isInUse = transactions.some(t => t.category === categoryName);
    if (isInUse) {
      alert('Cannot delete category that is being used in transactions');
      return;
    }
    setCategories(categories.filter(cat => cat.name !== categoryName));
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setNewCategory(category);
    setCategoryDialogOpen(true);
  };

  // Commented out unused function
  // const getFilteredCategories = (type: 'expense' | 'income') => {
  //   return categories.filter(cat => cat.type === type);
  // };

  const handleDownloadExcel = () => {
    const [startYear] = currentFY.split('-');
    const startDate = new Date(Number(startYear), 3, 1);

    const fyTransactions = transactions.filter(t => new Date(t.date) >= startDate);

    const excelData = fyTransactions
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(t => ({
        Date: new Date(t.date).toLocaleDateString('en-IN'),
        Description: t.description,
        Category: t.category,
        Amount: t.type === 'expense' ? -t.amount : t.amount,
        Type: t.type.charAt(0).toUpperCase() + t.type.slice(1),
        'Financial Year': t.financialYear || getFYFromDate(t.date)
      }));

    const ws = XLSX.utils.json_to_sheet(excelData);

    ws['!cols'] = [
      { wch: 12 },
      { wch: 30 },
      { wch: 15 },
      { wch: 12 },
      { wch: 10 },
      { wch: 15 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(data, `transactions_FY_${currentFY}.xlsx`);
  };

  return (
    <Box 
      display="flex" 
      justifyContent="center" 
      alignItems="center" 
      minHeight="100vh" 
      width="100vw" 
      sx={{ 
        bgcolor: 'background.default',
        boxSizing: 'border-box',
        overflowX: 'hidden'
      }}
    >
      <Box 
        width="100%" 
        sx={{ 
          mx: 'auto',
          p: { xs: 2, sm: 3, md: 4 },
          boxSizing: 'border-box',
          maxWidth: {
            xs: '100%',
            sm: '600px',
            md: '800px',
            lg: '1000px'
          },
          height: '100vh',
          overflowY: 'auto'
        }}
      >
        <Fade in timeout={600}>
          <div style={{ width: '100%', boxSizing: 'border-box' }}>
            <StyledPaper>
              <Stack 
                direction="row" 
                justifyContent="space-between" 
                alignItems="center" 
                spacing={2}
                sx={{
                  flexWrap: 'nowrap',
                  width: '100%'
                }}
              >
                <Stack 
                  direction="row" 
                  spacing={{ xs: 1, sm: 2 }} 
                  alignItems="center"
                  sx={{
                    minWidth: 0,
                    flex: 1,
                    flexShrink: 1,
                    flexDirection: { xs: 'row', sm: 'row' },
                    '& .MuiTypography-root': {
                      minWidth: 0
                    }
                  }}
                >
                  <AccountCircleIcon 
                    color="primary" 
                    sx={{ 
                      fontSize: { xs: 32, sm: 40 }, 
                      flexShrink: 0 
                    }} 
                  />
                  <Stack sx={{ 
                    minWidth: 0,
                    flexGrow: 1,
                    flexShrink: 1,
                  }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary" noWrap>
                        Welcome back
                      </Typography>
                      <Chip
                        label={`FY ${currentFY}`}
                        size="small"
                        color="primary"
                        sx={{ height: 20 }}
                      />
                    </Stack>
                    <Typography 
                      variant="h6" 
                      fontWeight={600} 
                      sx={{ 
                        fontSize: { xs: 14, sm: 20, md: 22 }, 
                        transition: 'font-size 0.2s',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {user?.name || user?.email || user?.phone}
                    </Typography>
                  </Stack>
                </Stack>
                <Stack 
                  direction="row" 
                  spacing={1} 
                  alignItems="center" 
                  sx={{ 
                    flexShrink: 0,
                    ml: 2
                  }}
                >
                  <Typography 
                    variant="body2" 
                    color="text.secondary"
                    sx={{ 
                      display: { xs: 'none', sm: 'block' },
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Logout
                  </Typography>
                  <IconButton onClick={onLogout} color="primary" size="small">
                    <LogoutIcon />
                  </IconButton>
                </Stack>
              </Stack>
              <Stack 
                direction={{ xs: 'row', sm: 'row' }} 
                spacing={{ xs: 3, sm: 4 }} 
                alignItems="center" 
                justifyContent="flex-end" 
                width="100%"
                mt={{ xs: 2, sm: 0 }}
                sx={{
                  flexWrap: 'nowrap',
                  '& > *': {
                    minWidth: { sm: 'auto' }
                  }
                }}
              >
                {/* Days Left in Month */}
                {(() => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = now.getMonth();
                  const totalDays = new Date(year, month + 1, 0).getDate();
                  const daysLeft = totalDays - now.getDate();
                  const percent = (daysLeft / totalDays) * 100;
                  return (
                    <Box position="relative" display="inline-flex" flexDirection="column" alignItems="center">
                      <Box sx={{ width: 40, height: 40, borderRadius: '50%', boxShadow: 3, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.paper' }}>
                        <CircularProgress variant="determinate" value={100} size={40} thickness={5} sx={{ color: '#e0e0e0', position: 'absolute', left: 0, top: 0 }} />
                        <CircularProgress variant="determinate" value={percent} size={40} thickness={5} color="primary" sx={{ transition: 'all 0.7s cubic-bezier(0.4,0,0.2,1)', position: 'absolute', left: 0, top: 0 }} />
                        <Box position="absolute" top={0} left={0} width={40} height={40} display="flex" alignItems="center" justifyContent="center">
                          <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ fontSize: { xs: 11, sm: 13 }, position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{daysLeft}</Typography>
                        </Box>
                      </Box>
                      <Typography variant="caption" display="block" sx={{ fontSize: { xs: 9, sm: 11 } }}>Days Left</Typography>
                    </Box>
                  );
                })()}
                {/* Budget Utilized */}
                {(() => {
                  const budget = monthlyBudget?.amount || 0;
                  const spent = calculateTotalExpenses();
                  const percent = budget ? Math.min((spent / budget) * 100, 100) : 0;
                  return (
                    <Box position="relative" display="inline-flex" flexDirection="column" alignItems="center">
                      <Box sx={{ width: 40, height: 40, borderRadius: '50%', boxShadow: 3, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.paper' }}>
                        <CircularProgress variant="determinate" value={100} size={40} thickness={5} sx={{ color: '#e0e0e0', position: 'absolute', left: 0, top: 0 }} />
                        <CircularProgress variant="determinate" value={percent} size={40} thickness={5} color={percent >= 100 ? 'error' : 'success'} sx={{ transition: 'all 0.7s cubic-bezier(0.4,0,0.2,1)', position: 'absolute', left: 0, top: 0 }} />
                        <Box position="absolute" top={0} left={0} width={40} height={40} display="flex" alignItems="center" justifyContent="center">
                          <Typography variant="caption" fontWeight={700} color={percent >= 100 ? 'error.main' : 'success.main'} sx={{ fontSize: { xs: 11, sm: 13 }, position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Math.round(percent)}%</Typography>
                        </Box>
                      </Box>
                      <Typography variant="caption" display="block" sx={{ fontSize: { xs: 9, sm: 11 } }}>Budget Used</Typography>
                    </Box>
                  );
                })()}
                {/* Expenses over Income */}
                {(() => {
                  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
                  const totalExpense = calculateTotalExpenses();
                  const percent = totalIncome ? Math.min((totalExpense / totalIncome) * 100, 999) : 0;
                  return (
                    <Box position="relative" display="inline-flex" flexDirection="column" alignItems="center">
                      <Box sx={{ width: 40, height: 40, borderRadius: '50%', boxShadow: 3, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.paper' }}>
                        <CircularProgress variant="determinate" value={100} size={40} thickness={5} sx={{ color: '#e0e0e0', position: 'absolute', left: 0, top: 0 }} />
                        <CircularProgress variant="determinate" value={percent > 100 ? 100 : percent} size={40} thickness={5} color={percent > 100 ? 'error' : 'info'} sx={{ transition: 'all 0.7s cubic-bezier(0.4,0,0.2,1)', position: 'absolute', left: 0, top: 0 }} />
                        <Box position="absolute" top={0} left={0} width={40} height={40} display="flex" alignItems="center" justifyContent="center">
                          <Typography variant="caption" fontWeight={700} color={percent > 100 ? 'error.main' : 'info.main'} sx={{ fontSize: { xs: 11, sm: 13 }, position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{totalIncome ? Math.round(percent) : 0}%</Typography>
                        </Box>
                      </Box>
                      <Typography variant="caption" display="block" sx={{ fontSize: { xs: 9, sm: 11 } }}>Exp/Inc</Typography>
                    </Box>
                  );
                })()}
              </Stack>
            </StyledPaper>
          </div>
        </Fade>
        {/* Remaining code */}
        <StyledPaper sx={{ p: { xs: 2, sm: 4 } }}>
          <Stack spacing={2}>
            <Stack 
              direction={{ xs: 'column', sm: 'row' }} 
              justifyContent="space-between" 
              alignItems={{ xs: 'flex-start', sm: 'center' }} 
              spacing={2}
            >
              <Stack direction="row" alignItems="center" spacing={2}>
                <Typography variant="h6" fontWeight={600}>
                  Transactions
                </Typography>
                {selectedTransaction && (
                  <Stack direction="row" spacing={1}>
                    <Button
                      color="primary"
                      onClick={() => {
                        setNewTransaction({
                          ...selectedTransaction,
                          amount: selectedTransaction.amount,
                          category: selectedTransaction.category,
                          description: selectedTransaction.description,
                          date: selectedTransaction.date,
                          type: selectedTransaction.type
                        });
                        setTransactionDialogOpen(true);
                      }}
                      size="small"
                      startIcon={<EditIcon fontSize="small" />}
                      sx={{ textTransform: 'none' }}
                    >
                      Edit
                    </Button>
                    <Button
                      color="error"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this transaction?')) {
                          handleDeleteTransaction(selectedTransaction.id);
                          setSelectedTransaction(null);
                        }
                      }}
                      size="small"
                      startIcon={<DeleteIcon fontSize="small" />}
                      sx={{ textTransform: 'none' }}
                    >
                      Delete
                    </Button>
                  </Stack>
                )}
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} width={{ xs: '100%', sm: 'auto' }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setSelectedTransaction(null);
                    setNewTransaction({ type: 'expense', date: new Date().toISOString().split('T')[0] });
                    setTransactionDialogOpen(true);
                  }}
                  sx={{ borderRadius: 2, width: { xs: '100%', sm: 'auto' } }}
                >
                  Add Transaction
                </Button>
              </Stack>
            </Stack>
            
            <List sx={{ 
              width: '100%', 
              bgcolor: 'background.paper', 
              borderRadius: { xs: 1, sm: 2 }, 
              overflow: 'hidden',
              '& .MuiListItem-root': {
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                gap: { xs: 1, sm: 0 }
              },
              '& .MuiListItemText-root': {
                margin: { xs: 0, sm: 2 }
              },
              '& .MuiTypography-root.amount': {
                alignSelf: { xs: 'flex-end', sm: 'center' }
              }
            }}>
              {transactions.length === 0 ? (
                <ListItem>
                  <ListItemText 
                    primary={
                      <Typography variant="body1" textAlign="center">
                        No transactions yet
                      </Typography>
                    }
                    secondary={
                      <Typography variant="body2" color="text.secondary" textAlign="center">
                        Click the Add Transaction button to get started
                      </Typography>
                    }
                  />
                </ListItem>
              ) : (
                [...transactions]
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((transaction) => (
                    <ListItem
                      key={transaction.id}
                      sx={{
                        bgcolor: transaction.id === selectedTransaction?.id ? 'action.selected' : 'background.paper',
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        '&:last-child': {
                          borderBottom: 'none',
                        },
                        '&:hover': { 
                          bgcolor: 'action.hover',
                          cursor: 'pointer'
                        },
                        p: { xs: 2, sm: 2 },
                      }}
                      onClick={() => setSelectedTransaction(transaction)}
                    >
                      <ListItemText
                        primary={
                          <Typography variant="body1" fontWeight={500} sx={{ fontSize: { xs: '0.95rem', sm: '1rem' } }}>
                            {transaction.description}
                          </Typography>
                        }
                        secondary={
                          <Stack 
                            direction={{ xs: 'column', sm: 'row' }} 
                            spacing={{ xs: 0.5, sm: 1 }} 
                            alignItems={{ xs: 'flex-start', sm: 'center' }}
                          >
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                              {transaction.category}
                            </Typography>
                            <Typography 
                              variant="body2" 
                              color="text.secondary" 
                              sx={{ 
                                display: { xs: 'none', sm: 'block' },
                                fontSize: { xs: '0.8rem', sm: '0.875rem' }
                              }}
                            >
                              •
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                              {new Date(transaction.date).toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </Typography>
                          </Stack>
                        }
                      />
                      <Typography
                        variant="body2"
                        color={transaction.type === 'income' ? 'success.main' : 'error.main'}
                        className="amount"
                        sx={{ 
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          fontSize: { xs: '0.95rem', sm: '1rem' }
                        }}
                      >
                        {transaction.type === 'income' ? '+' : '-'}{formatIndianCurrency(transaction.amount)}
                      </Typography>
                    </ListItem>
                ))
              )}
            </List>
          </Stack>
        </StyledPaper>

        <StyledPaper sx={{ p: { xs: 2, sm: 4 } }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                <AccountBalanceWalletIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  Monthly Budget
                </Typography>
              </Stack>
              <Button
                variant="outlined"
                onClick={handleOpenBudgetDialog}
                sx={{ borderRadius: 2, width: { xs: '100%', sm: 'auto' }, mt: { xs: 1, sm: 0 } }}
              >
                Set Budget
              </Button>
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body1" color="text.secondary">
                Current Usage
              </Typography>
              <Typography variant="h6" fontWeight={600}>
                {formatIndianCurrency(calculateTotalExpenses())} / {monthlyBudget ? formatIndianCurrency(monthlyBudget.amount) : '₹0.00'}
                {monthlyBudget && calculateTotalExpenses() > monthlyBudget.amount && (
                  <Typography component="span" color="error" variant="caption" sx={{ ml: 1 }}>
                    ({Math.round((calculateTotalExpenses() / monthlyBudget.amount) * 100)}%)
                  </Typography>
                )}
              </Typography>
            </Stack>
            <Box sx={{ width: '100%', bgcolor: 'background.default', borderRadius: 1, height: 8, overflow: 'hidden' }}>
              <Box
                sx={{
                  width: `${calculateProgressPercentage()}%`,
                  height: '100%',
                  bgcolor: monthlyBudget && calculateTotalExpenses() > monthlyBudget.amount ? 'error.main' : 'primary.main',
                  borderRadius: 1,
                  transition: 'width 0.5s ease-in-out',
                }}
              />
            </Box>
            {monthlyBudget && calculateTotalExpenses() > monthlyBudget.amount && (
              <Typography variant="caption" color="error">
                Warning: You have exceeded your monthly budget by {formatIndianCurrency(calculateTotalExpenses() - monthlyBudget.amount)}!
              </Typography>
            )}
          </Stack>
        </StyledPaper>

        <StyledPaper>
          <Stack spacing={3}>
            <Typography variant="h6" fontWeight={600}>
              Category-wise Budget Usage
            </Typography>
            
            {calculateCategoryExpenses()
              .filter(cat => cat.spent > 0 || cat.budget > 0)
              .map(category => (
                <Box key={category.name} sx={{ width: '100%', mb: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="body1">
                      {category.name}
                    </Typography>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography
                        variant="body2"
                        color={category.spent > category.budget ? 'error.main' : 'success.main'}
                      >
                        {formatIndianCurrency(category.spent)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        /
                      </Typography>
                      <Typography variant="body2">
                        {formatIndianCurrency(category.budget)}
                      </Typography>
                      {category.spent > category.budget && (
                        <Typography
                          variant="caption"
                          color="error"
                          sx={{ ml: 1 }}
                        >
                          ({Math.round((category.spent / category.budget - 1) * 100)}% over)
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min((category.spent / (category.budget || 1)) * 100, 100)}
                    sx={{
                      height: 8,
                      borderRadius: 1,
                      bgcolor: 'background.default',
                      '& .MuiLinearProgress-bar': {
                        bgcolor: category.spent > category.budget ? 'error.main' : 'success.main',
                        borderRadius: 1,
                      },
                    }}
                  />
                </Box>
            ))}
          </Stack>
        </StyledPaper>

        <StyledPaper>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={600}>
              Data Management
            </Typography>
            <Stack spacing={2}>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleMonthEnd}
                sx={{ borderRadius: 2 }}
              >
                End Current Month
              </Button>
              <Typography variant="caption" color="text.secondary" textAlign="center">
                This will archive current month's data and start fresh for the new month
              </Typography>
            </Stack>
          </Stack>
        </StyledPaper>

        <StyledPaper>
          <Stack spacing={2}>
            <Typography variant="h6" fontWeight={600}>
              Download Transactions
            </Typography>
            <Stack spacing={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleDownloadExcel}
                disabled={transactions.length === 0}
                sx={{ borderRadius: 2 }}
              >
                Download All Transactions
              </Button>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => {
                  const [startYear] = currentFY.split('-');
                  const startDate = new Date(Number(startYear), 3, 1);
                  const fyTransactions = transactions.filter(t => new Date(t.date) >= startDate);
                  
                  if (fyTransactions.length === 0) {
                    alert('No transactions found for current financial year');
                    return;
                  }

                  const excelData = fyTransactions
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map(t => ({
                      Date: new Date(t.date).toLocaleDateString('en-IN'),
                      Description: t.description,
                      Category: t.category,
                      Amount: t.type === 'expense' ? -t.amount : t.amount,
                      Type: t.type.charAt(0).toUpperCase() + t.type.slice(1),
                      'Financial Year': t.financialYear || getFYFromDate(t.date)
                    }));

                  const ws = XLSX.utils.json_to_sheet(excelData);
                  ws['!cols'] = [
                    { wch: 12 },
                    { wch: 30 },
                    { wch: 15 },
                    { wch: 12 },
                    { wch: 10 },
                    { wch: 15 }
                  ];

                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
                  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                  const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                  saveAs(data, `transactions_FY_${currentFY}.xlsx`);
                }}
                disabled={transactions.length === 0}
                sx={{ borderRadius: 2 }}
              >
                Download Current FY (FY {currentFY})
              </Button>
              <Typography variant="caption" color="text.secondary" textAlign="center">
                Download your transaction data in Excel format. Current FY option includes transactions from April 1st, {currentFY.split('-')[0]}
              </Typography>
            </Stack>
          </Stack>
        </StyledPaper>

        <Dialog
          open={isTransactionDialogOpen}
          onClose={() => setTransactionDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          fullScreen={window.innerWidth < 600}
          sx={{
            '& .MuiDialog-paper': {
              m: { xs: 0, sm: 2 },
              p: { xs: 1, sm: 2 },
              borderRadius: { xs: 0, sm: 2 }
            }
          }}
        >
          <DialogTitle>
            {selectedTransaction ? 'Edit Transaction' : 'New Transaction'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} mt={2}>
              <TextField
                select
                label="Type"
                value={newTransaction.type || 'expense'}
                onChange={(e) => {
                  const type = e.target.value as 'expense' | 'income';
                  setNewTransaction({ 
                    ...newTransaction, 
                    type,
                    category: '' 
                  });
                }}
                fullWidth
              >
                <MenuItem value="expense">Expense</MenuItem>
                <MenuItem value="income">Income</MenuItem>
              </TextField>
              <TextField
                label="Amount (₹)"
                type="number"
                value={newTransaction.amount || ''}
                onChange={(e) => setNewTransaction({ ...newTransaction, amount: parseFloat(e.target.value) })}
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  select
                  label="Category"
                  value={newTransaction.category || ''}
                  onChange={(e) => setNewTransaction({ ...newTransaction, category: e.target.value })}
                  fullWidth
                >
                  {categories
                    .filter(cat => cat.type === newTransaction.type)
                    .map((category) => (
                      <MenuItem key={category.name} value={category.name}>
                        {category.name}
                      </MenuItem>
                  ))}
                </TextField>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setNewCategory({ type: newTransaction.type, color: '#000000' });
                    setCategoryDialogOpen(true);
                  }}
                >
                  Manage Categories
                </Button>
              </Stack>
              <TextField
                label="Description"
                value={newTransaction.description || ''}
                onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })}
                fullWidth
              />
              <TextField
                label="Date"
                type="date"
                value={newTransaction.date || ''}
                onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTransactionDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTransaction} variant="contained" color="primary">
              Save
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={isCategoryDialogOpen}
          onClose={() => setCategoryDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          fullScreen={window.innerWidth < 600}
          sx={{
            '& .MuiDialog-paper': {
              m: { xs: 0, sm: 2 },
              p: { xs: 1, sm: 2 },
              borderRadius: { xs: 0, sm: 2 }
            }
          }}
        >
          <DialogTitle>
            {editingCategory ? 'Edit Category' : 'New Category'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} mt={2}>
              <TextField
                label="Name"
                value={newCategory.name || ''}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                fullWidth
              />
              <TextField
                select
                label="Type"
                value={newCategory.type || 'expense'}
                onChange={(e) => setNewCategory({ ...newCategory, type: e.target.value as 'expense' | 'income' })}
                fullWidth
              >
                <MenuItem value="expense">Expense</MenuItem>
                <MenuItem value="income">Income</MenuItem>
              </TextField>
              <TextField
                label="Color"
                type="color"
                value={newCategory.color || '#000000'}
                onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                fullWidth
                sx={{ '& input': { p: 1, height: 40 } }}
              />
            </Stack>

            <List sx={{ mt: 3 }}>
              {categories
                .filter(cat => cat.type === (newCategory.type || 'expense'))
                .map((category) => (
                  <ListItem
                    key={category.name}
                    sx={{
                      bgcolor: 'background.paper',
                      mb: 1,
                      borderRadius: 1,
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Box
                      sx={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        bgcolor: category.color,
                        mr: 2,
                      }}
                    />
                    <ListItemText
                      primary={category.name}
                      secondary={category.type}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleEditCategory(category)}
                        size="small"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        edge="end"
                        onClick={() => handleDeleteCategory(category.name)}
                        size="small"
                        color="error"
                        sx={{ ml: 1 }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
            </List>
          </DialogContent>
          <DialogActions>
            {editingCategory ? (
              <>
                <Button onClick={() => {
                  setCategoryDialogOpen(false);
                  setEditingCategory(null);
                  setNewCategory({ type: 'expense', color: '#000000' });
                }}>
                  Cancel
                </Button>
                <Button onClick={handleSaveCategory} variant="contained" color="primary">
                  Update
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setCategoryDialogOpen(false)}>Close</Button>
                <Button 
                  onClick={handleSaveCategory} 
                  variant="contained" 
                  color="primary"
                  disabled={!newCategory.name}
                >
                  Add Category
                </Button>
              </>
            )}
          </DialogActions>
        </Dialog>

        <Dialog
          open={isBudgetDialogOpen}
          onClose={() => setBudgetDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          fullScreen={window.innerWidth < 600}
          sx={{
            '& .MuiDialog-paper': {
              m: { xs: 0, sm: 2 },
              p: { xs: 1, sm: 2 },
              borderRadius: { xs: 0, sm: 2 }
            }
          }}
        >
          <DialogTitle>Set Monthly Budget</DialogTitle>
          <DialogContent>
            <Stack spacing={3} mt={2}>
              <TextField
                label="Total Budget (₹)"
                type="number"
                value={tempBudget.total}
                onChange={e => setTempBudget({
                  ...tempBudget,
                  total: parseFloat(e.target.value) || 0
                })}
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
              />
              <Typography variant="subtitle1" fontWeight={600} mt={2}>
                Category Budgets
              </Typography>
              <Stack spacing={2}>
                {categories.filter(cat => cat.type === 'expense').map(category => (
                  <TextField
                    key={category.name}
                    label={category.name}
                    type="number"
                    value={tempBudget.categories[category.name] || ''}
                    onChange={e => setTempBudget({
                      ...tempBudget,
                      categories: {
                        ...tempBudget.categories,
                        [category.name]: parseFloat(e.target.value) || 0
                      }
                    })}
                    fullWidth
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                ))}
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBudgetDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => handleUpdateBudget({ total: tempBudget.total, categories: tempBudget.categories })} variant="contained" color="primary">
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}

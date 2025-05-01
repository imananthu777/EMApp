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
import LockIcon from '@mui/icons-material/Lock';
import SyncIcon from '@mui/icons-material/Sync';
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
import { fetchUserDataByType, saveUserDataByType } from '../lib/userDataService';
import SyncPopup from './SyncPopup';

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
  // Add state for miscellaneous budget
  const [miscBudget, setMiscBudget] = useState(0);
  // Add state for archived month data
  const [archivedMonth, setArchivedMonth] = useState<any>(null);
  // Add state to track if month has ended
  const [monthEnded, setMonthEnded] = useState(false);
  // Add state for loading data
  const [loading, setLoading] = useState(true);
  // Remove unused syncing and syncError states
  // State for reset dialog
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetType, setResetType] = useState<'month' | 'fy' | 'all' | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');

  const [isSyncPopupOpen, setSyncPopupOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncLocalToServer();
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const fy = month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
    setCurrentFY(fy);

    // Load data with priority on server data
    loadUserData();
  }, [user.id]);

  // Function to load user data from server or fallback to local
  const loadUserData = async () => {
    setLoading(true);
    try {
      // Fetch transactions
      const serverTransactions = await fetchUserDataByType({
        mobile: user.id,
        name: user.name,
        dataType: 'transactions',
      }).catch(() => null);
      if (serverTransactions) setTransactions(serverTransactions);

      // Fetch monthly budget
      const serverBudget = await fetchUserDataByType({
        mobile: user.id,
        name: user.name,
        dataType: 'monthlyBudget',
      }).catch(() => null);
      if (serverBudget) setMonthlyBudget(serverBudget);

      // Fetch categories
      const serverCategories = await fetchUserDataByType({
        mobile: user.id,
        name: user.name,
        dataType: 'categories',
      }).catch(() => null);
      if (serverCategories) setCategories(serverCategories);

      // Fetch archived month data
      const serverArchivedMonth = await fetchUserDataByType({
        mobile: user.id,
        name: user.name,
        dataType: 'archivedMonth',
      }).catch(() => null);
      if (serverArchivedMonth) setArchivedMonth(serverArchivedMonth);

      setMonthEnded(!!serverArchivedMonth);
    } catch (error) {
      console.error('Error loading user data:', error);
      // Fall back to local storage
      loadFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  // Function to load from localStorage
  const loadFromLocalStorage = () => {
    const savedTransactions = localStorage.getItem(`transactions_${user.id}`);
    const savedBudget = localStorage.getItem(`budget_${user.id}`);
    const savedCategories = localStorage.getItem(`categories_${user.id}`);
    const archiveKey = `archive_${user.id}_last_month`;
    const archived = localStorage.getItem(archiveKey);

    if (savedTransactions) {
      const parsedTransactions = JSON.parse(savedTransactions);
      const updatedTransactions = parsedTransactions.map((t: Transaction) => ({
        ...t,
        financialYear: t.financialYear || getFYFromDate(t.date)
      }));
      setTransactions(updatedTransactions);
    }

    if (savedBudget) {
      const budget = JSON.parse(savedBudget);
      setMonthlyBudget(budget);
      setTempBudget({
        total: budget.amount,
        categories: budget.categories || {}
      });
    }

    if (savedCategories) {
      setCategories(JSON.parse(savedCategories));
    }

    setArchivedMonth(archived ? JSON.parse(archived) : null);
    setMonthEnded(!!archived);
  };

  // Function to sync local data to server
  const syncLocalToServer = async () => {
    try {
      setIsSyncing(true);

      await saveUserDataByType({
        mobile: user.id,
        name: user.name,
        dataType: 'transactions',
        data: transactions,
      });

      await saveUserDataByType({
        mobile: user.id,
        name: user.name,
        dataType: 'monthlyBudget',
        data: monthlyBudget,
      });

      await saveUserDataByType({
        mobile: user.id,
        name: user.name,
        dataType: 'categories',
        data: categories,
      });

      await saveUserDataByType({
        mobile: user.id,
        name: user.name,
        dataType: 'archivedMonth',
        data: archivedMonth,
      });

    } catch (error) {
      console.error('Error syncing to server:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Update useEffect to save categories to server
  useEffect(() => {
    localStorage.setItem(`categories_${user.id}`, JSON.stringify(categories));

    // Skip initial load
    if (!loading) {
      syncLocalToServer();
    }
  }, [categories, user.id]);

  const getFYFromDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  };

  // Helper to get days in a month
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

  // Track the logical month start (reset after End Current Month)
  const [logicalMonthStart, setLogicalMonthStart] = useState<Date>(() => new Date());

  // When month is ended, reset logical month start
  useEffect(() => {
    if (monthEnded) setLogicalMonthStart(new Date());
  }, [monthEnded]);

  // Days left logic based on logicalMonthStart
  const daysLeft = (() => {
    const now = new Date();
    const start = logicalMonthStart;
    const daysInMonth = getDaysInMonth(start.getFullYear(), start.getMonth());
    const diff = Math.max(0, daysInMonth - (now.getDate() - start.getDate()));
    return diff;
  })();
  const daysInMonth = (() => {
    const start = logicalMonthStart;
    return getDaysInMonth(start.getFullYear(), start.getMonth());
  })();
  const daysLeftPercent = (daysLeft / daysInMonth) * 100;

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

    // Sync to server
    syncLocalToServer();

    setTransactionDialogOpen(false);
    setSelectedTransaction(null);
    setNewTransaction({ type: 'expense', date: new Date().toISOString().split('T')[0] });
  };

  const handleDeleteTransaction = (id: string) => {
    const updatedTransactions = transactions.filter(t => t.id !== id);
    setTransactions(updatedTransactions);
    localStorage.setItem(`transactions_${user.id}`, JSON.stringify(updatedTransactions));

    // Sync to server
    syncLocalToServer();
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

    // Sync to server
    syncLocalToServer();

    setBudgetDialogOpen(false);
  };

  const handleOpenBudgetDialog = () => {
    setTempBudget({
      total: monthlyBudget?.amount || 0,
      categories: monthlyBudget?.categories || {}
    });
    setBudgetDialogOpen(true);
  };

  // End Current Month handler with server sync
  const handleMonthEnd = async () => {
    // Archive current month data
    const archiveKey = `archive_${user.id}_last_month`;
    const fyKey = `archive_${user.id}_fy_${currentFY}`;
    const archiveData = {
      transactions,
      budget: monthlyBudget,
      startDate: logicalMonthStart,
      endDate: new Date(),
    };
    localStorage.setItem(archiveKey, JSON.stringify(archiveData));

    // Append to FY archive
    let fyArchive = JSON.parse(localStorage.getItem(fyKey) || '[]');
    fyArchive.push(archiveData);
    localStorage.setItem(fyKey, JSON.stringify(fyArchive));

    // Clear current month
    setTransactions([]);
    setMonthlyBudget(null);
    localStorage.setItem(`transactions_${user.id}`, JSON.stringify([]));
    localStorage.removeItem(`budget_${user.id}`);
    setArchivedMonth(archiveData);
    setMonthEnded(true);
    setLogicalMonthStart(new Date());

    // Sync to server
    await syncLocalToServer();

    // Disable download current month after ending month
    setTimeout(() => setMonthEnded(false), 0);
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

  // Helper to add closing balance to exported data (with initial balance)
  function addClosingBalance(transactions: Transaction[], initialBalance = 0) {
    let balance = initialBalance;
    return transactions.map((t) => {
      const amount = t.type === 'expense' ? -t.amount : t.amount;
      balance += amount;
      return {
        Date: new Date(t.date).toLocaleDateString('en-IN'),
        Description: t.description,
        Category: t.category,
        Amount: amount,
        'Closing Balance': balance,
        Type: t.type.charAt(0).toUpperCase() + t.type.slice(1),
        'Financial Year': t.financialYear || getFYFromDate(t.date)
      };
    });
  }

  // Download Current Month Data (only enabled if monthEnded)
  const handleDownloadCurrentMonth = () => {
    if (!archivedMonth) return;
    const excelData = addClosingBalance(archivedMonth.transactions);
    const ws = XLSX.utils.json_to_sheet(excelData);
    ws['!cols'] = [
      { wch: 12 },
      { wch: 30 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 }, // Closing Balance
      { wch: 10 },
      { wch: 15 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'CurrentMonth');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, `current_month_data_${currentFY}.xlsx`);
  };

  // Download FY Data (all archived months except current)
  const handleDownloadFY = () => {
    const fyKey = `archive_${user.id}_fy_${currentFY}`;
    let fyArchive = JSON.parse(localStorage.getItem(fyKey) || '[]');
    if (monthEnded && fyArchive.length > 0) fyArchive = fyArchive.slice(0, -1);
    // Flatten and add closing balance for each month, carrying over balance
    let allTransactions: any[] = [];
    let runningBalance = 0;
    fyArchive.forEach((m: any) => {
      const sortedTx = [...m.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const txWithBalance = addClosingBalance(sortedTx, runningBalance);
      if (txWithBalance.length > 0) {
        runningBalance = txWithBalance[txWithBalance.length - 1]['Closing Balance'];
      }
      allTransactions = allTransactions.concat(txWithBalance);
    });
    if (allTransactions.length === 0) {
      alert('No archived data for this FY.');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(allTransactions);
    ws['!cols'] = [
      { wch: 12 },
      { wch: 30 },
      { wch: 15 },
      { wch: 12 },
      { wch: 15 }, // Closing Balance
      { wch: 10 },
      { wch: 15 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FYData');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, `fy_data_${currentFY}.xlsx`);
  };

  // --- Summary Calculations ---
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = calculateTotalExpenses();
  // Calculate total budgeted expenses (sum of all category budgets)
  const totalBudgetedExpenses = monthlyBudget ? Object.values(monthlyBudget.categories || {}).reduce((sum, v) => sum + v, 0) : 0;
  // Calculate unbudgeted expenses
  const budgetedCategories = monthlyBudget ? Object.keys(monthlyBudget.categories || {}) : [];
  const unbudgetedExpenses = transactions.filter(t => t.type === 'expense' && !budgetedCategories.includes(t.category)).reduce((sum, t) => sum + t.amount, 0);
  // Projected balance = total income - (total budgeted expenses + unbudgeted expenses)
  const projectedBalance = totalIncome - (totalBudgetedExpenses + unbudgetedExpenses);

  const currentBalance = totalIncome - totalExpenses;

  // Helper to get user password (from localStorage)
  function getUserPassword() {
    const users = JSON.parse(localStorage.getItem('registeredUsers') || '{}');
    return users[user?.id]?.password || '';
  }

  // Reset handlers with server sync
  async function handleResetConfirm() {
    setResetError('');
    if (resetPassword !== getUserPassword()) {
      setResetError('Incorrect password.');
      return;
    }

    if (resetType === 'month') {
      setTransactions([]);
      setMonthlyBudget(null);
      localStorage.setItem(`transactions_${user.id}`, JSON.stringify([]));
      localStorage.removeItem(`budget_${user.id}`);
    } else if (resetType === 'fy') {
      const fyKey = `archive_${user.id}_fy_${currentFY}`;
      localStorage.removeItem(fyKey);
    } else if (resetType === 'all') {
      // Remove all user data
      localStorage.removeItem(`transactions_${user.id}`);
      localStorage.removeItem(`budget_${user.id}`);
      localStorage.removeItem(`categories_${user.id}`);
      localStorage.removeItem(`archive_${user.id}_last_month`);
      // Remove all FY archives
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(`archive_${user.id}_fy_`)) localStorage.removeItem(key);
      });
      setTransactions([]);
      setMonthlyBudget(null);
      setCategories(defaultCategories);
    }

    // Sync changes to server
    await syncLocalToServer();

    setResetDialogOpen(false);
    setResetPassword('');
    setResetType(null);
    setResetError('');
  }

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
                  <IconButton onClick={() => setSyncPopupOpen(true)} color="primary" size="small">
                    {isSyncing ? <CircularProgress size={20} /> : <SyncIcon />}
                  </IconButton>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      display: { xs: 'none', sm: 'block' },
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Sync
                  </Typography>
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
                {/* Days Left in Month (update to use logical month) */}
                {(() => {
                  return (
                    <Box position="relative" display="inline-flex" flexDirection="column" alignItems="center">
                      <Box sx={{ width: 40, height: 40, borderRadius: '50%', boxShadow: 3, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.paper' }}>
                        <CircularProgress variant="determinate" value={100} size={40} thickness={5} sx={{ color: '#e0e0e0', position: 'absolute', left: 0, top: 0 }} />
                        <CircularProgress variant="determinate" value={daysLeftPercent} size={40} thickness={5} color="primary" sx={{ transition: 'all 0.7s cubic-bezier(0.4,0,0.2,1)', position: 'absolute', left: 0, top: 0 }} />
                        <Box position="absolute" top={0} left={0} width={40} height={40} display="flex" sx={{ alignItems: 'center', justifyContent: 'center' }}>
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
                        <Box position="absolute" top={0} left={0} width={40} height={40} display="flex" sx={{ alignItems: 'center', justifyContent: 'center' }}>
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
                        <Box position="absolute" top={0} left={0} width={40} height={40} display="flex" sx={{ alignItems: 'center', justifyContent: 'center' }}>
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
        {/* --- Summary Section --- */}
        <StyledPaper sx={{ mb: 3, p: { xs: 2, sm: 4 }, bgcolor: 'primary.lighter' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} justifyContent="space-between" alignItems="center">
            <Stack alignItems="center">
              <Typography variant="subtitle2" color="text.secondary">Current Balance</Typography>
              <Typography variant="h5" color={currentBalance >= 0 ? 'success.main' : 'error.main'} fontWeight={700}>
                {formatIndianCurrency(currentBalance)}
              </Typography>
            </Stack>
            <Stack alignItems="center">
              <Typography variant="subtitle2" color="text.secondary">Total Expenses</Typography>
              <Typography variant="h5" color="error.main" fontWeight={700}>
                {formatIndianCurrency(totalExpenses)}
              </Typography>
            </Stack>
            <Stack alignItems="center">
              <Typography variant="subtitle2" color="text.secondary">Projected Balance</Typography>
              <Typography variant="h5" color={projectedBalance >= 0 ? 'success.main' : 'error.main'} fontWeight={700}>
                {formatIndianCurrency(projectedBalance)}
              </Typography>
            </Stack>
          </Stack>
        </StyledPaper>
        {/* Only show Transactions card if monthly budget is set */}
        {monthlyBudget && (
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
        )}

        <StyledPaper sx={{ p: { xs: 2, sm: 4 } }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
              <Stack direction="row" spacing={2} alignItems="center">
                <AccountBalanceWalletIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>
                  Monthly Budget
                </Typography>
              </Stack>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ xs: 'center', sm: 'center' }}
                justifyContent={{ xs: 'center', sm: 'flex-end' }}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                <Button
                  variant="outlined"
                  onClick={() => setCategoryDialogOpen(true)}
                  sx={{ borderRadius: 2, width: { xs: '100%', sm: 'auto' } }}
                >
                  Add/Change Categories
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleOpenBudgetDialog}
                  sx={{ borderRadius: 2, width: { xs: '100%', sm: 'auto' } }}
                >
                  Set Budget
                </Button>
              </Stack>
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
                onClick={handleDownloadCurrentMonth}
                disabled={!monthEnded || !archivedMonth}
                sx={{ borderRadius: 2 }}
              >
                Download Current Month Data
              </Button>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleDownloadFY}
                sx={{ borderRadius: 2 }}
              >
                Download Current FY (FY {currentFY})
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<LockIcon />}
                onClick={() => setResetDialogOpen(true)}
                sx={{ borderRadius: 2 }}
              >
                Reset All
              </Button>
              <Typography variant="caption" color="text.secondary" textAlign="center">
                Download your transaction data in Excel format. FY option includes all ended months except the current month.
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
                  Add/Change Categories
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
              {/* Show computed total budget */}
              <TextField
                label="Total Monthly Budget (auto-calculated)"
                value={
                  Object.values(tempBudget.categories).reduce((sum, v) => sum + v, 0) + miscBudget
                }
                InputProps={{ readOnly: true }}
                fullWidth
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
                {/* Miscellaneous budget input */}
                <TextField
                  label="Miscellaneous"
                  type="number"
                  value={miscBudget}
                  onChange={e => setMiscBudget(parseFloat(e.target.value) || 0)}
                  fullWidth
                  inputProps={{ min: 0, step: 0.01 }}
                />
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setBudgetDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              const total = Object.values(tempBudget.categories).reduce((sum, v) => sum + v, 0) + miscBudget;
              handleUpdateBudget({ total, categories: { ...tempBudget.categories, Miscellaneous: miscBudget } });
            }} variant="contained" color="primary">
              Save
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle>Reset Data</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <Typography color="error" fontWeight={600}>Warning: This action cannot be undone!</Typography>
              <Button variant={resetType === 'month' ? 'contained' : 'outlined'} color="error" onClick={() => setResetType('month')} fullWidth>Reset Current Month</Button>
              <Button variant={resetType === 'fy' ? 'contained' : 'outlined'} color="error" onClick={() => setResetType('fy')} fullWidth>Reset Current FY</Button>
              <Button variant={resetType === 'all' ? 'contained' : 'outlined'} color="error" onClick={() => setResetType('all')} fullWidth>Reset All Data</Button>
              {resetType && (
                <>
                  <TextField
                    label="Enter your password to confirm"
                    type="password"
                    value={resetPassword}
                    onChange={e => setResetPassword(e.target.value)}
                    fullWidth
                    error={!!resetError}
                    helperText={resetError}
                    autoFocus
                  />
                  <Button variant="contained" color="error" onClick={handleResetConfirm} fullWidth>Confirm Reset</Button>
                </>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>

        <SyncPopup
          open={isSyncPopupOpen}
          onClose={() => setSyncPopupOpen(false)}
          onSync={handleSync}
        />
      </Box>
    </Box>
  );
}

/**
 * Utility functions for the application
 */

/**
 * Creates a throttled function that only invokes the provided function at most once per
 * specified interval.
 * 
 * @param func The function to throttle
 * @param wait The number of milliseconds to throttle invocations to
 * @returns A throttled version of the function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastResult: ReturnType<T>;
  let lastRan = 0;
  let currentPromise: Promise<ReturnType<T>> | null = null;

  function run() {
    const now = Date.now();
    if (lastRan && now < lastRan + wait) {
      // Haven't waited long enough, queue up a future run
      timeout = setTimeout(() => {
        lastRan = Date.now();
        timeout = null;
        if (lastArgs) {
          const args = lastArgs;
          lastArgs = null;
          currentPromise = Promise.resolve(func(...args));
        }
      }, lastRan + wait - now);
      return currentPromise; // Return the existing promise
    }

    // We can run immediately
    lastRan = now;
    if (lastArgs) {
      const args = lastArgs;
      lastArgs = null;
      lastResult = func(...args);
      currentPromise = Promise.resolve(lastResult);
    }
    return currentPromise;
  }

  // The throttled function
  return function throttled(...args: Parameters<T>): Promise<ReturnType<T>> {
    lastArgs = args;
    
    if (timeout) {
      // There's a scheduled run, let it handle our latest args
      return currentPromise!;
    }
    
    if (!currentPromise) {
      // Nothing in progress, start a new one
      return (currentPromise = Promise.resolve(func(...args)));
    }
    
    // Something is already running, queue up a future run
    return run() || currentPromise;
  };
}

/**
 * Creates a debounced function that delays invoking the provided function until after
 * wait milliseconds have elapsed since the last time the debounced function was invoked.
 * 
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function executedFunction(...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(later, wait);
  };
}

/**
 * Deep comparison of two objects
 * @param obj1 First object
 * @param obj2 Second object
 * @returns Whether the objects are equal
 */
export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  
  if (typeof obj1 !== 'object' || obj1 === null ||
      typeof obj2 !== 'object' || obj2 === null) {
    return false;
  }
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }
  
  return true;
}

/**
 * Generate a random ID
 * @returns A random string ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Format a date string to a human-readable format
 * @param dateString The date string to format
 * @returns Formatted date string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format a number as currency
 * @param amount The amount to format
 * @param currency The currency code (default: INR)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return formatter.format(amount);
}
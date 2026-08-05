import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import OAuthConsent from '@/pages/OAuthConsent';
import Splash from '@/pages/Splash';
import Home from '@/pages/Home';
import Strategy from '@/pages/Strategy';
import Settings from '@/pages/Settings';
import Statistics from '@/pages/Statistics';
import Subscription from '@/pages/Subscription';
import Admin from '@/pages/Admin';
import AISignals from '@/pages/AISignals';
import AIScanner from '@/pages/AIScanner';
import Account from '@/pages/Account';
import ConnectMT5 from '@/pages/ConnectMT5';
import Notifications from '@/pages/Notifications';
import Redeem from '@/pages/Redeem';
import LSR3RLayout from '@/components/lsr3r/LSR3RLayout';
import LSR3RScanner from '@/pages/LSR3RScanner';
import LSR3RHistory from '@/pages/LSR3RHistory';
import LSR3RAnalytics from '@/pages/LSR3RAnalytics';
import LSR3RSettings from '@/pages/LSR3RSettings';
import LSR3RWebhook from '@/pages/LSR3RWebhook';
import TradeJournal from '@/pages/TradeJournal';
import TradingView from '@/pages/TradingView';
import MarketStructure from '@/pages/MarketStructure';

const PageSlide = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, x: 18 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -18 }}
    transition={{ duration: 0.18, ease: "easeInOut" }}
    style={{ willChange: "opacity, transform" }}
  >
    {children}
  </motion.div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#00FF41]/30 border-t-[#00FF41] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PageSlide><Login /></PageSlide>} />
        <Route path="/register" element={<PageSlide><Register /></PageSlide>} />
        <Route path="/forgot-password" element={<PageSlide><ForgotPassword /></PageSlide>} />
        <Route path="/reset-password" element={<PageSlide><ResetPassword /></PageSlide>} />
        <Route path="/splash" element={<PageSlide><Splash /></PageSlide>} />
        <Route path="/oauth/consent" element={<OAuthConsent />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/admin" element={<PageSlide><Admin /></PageSlide>} />
          <Route element={<Layout />}>
            <Route path="/" element={<PageSlide><Home /></PageSlide>} />
            <Route path="/strategy" element={<PageSlide><Strategy /></PageSlide>} />
            <Route path="/settings" element={<PageSlide><Settings /></PageSlide>} />
            <Route path="/statistics" element={<PageSlide><Statistics /></PageSlide>} />
            <Route path="/subscription" element={<PageSlide><Subscription /></PageSlide>} />
            <Route path="/ai-signals" element={<PageSlide><AISignals /></PageSlide>} />
            <Route path="/ai-scanner" element={<PageSlide><AIScanner /></PageSlide>} />
            <Route path="/account" element={<PageSlide><Account /></PageSlide>} />
            <Route path="/connect-mt5" element={<PageSlide><ConnectMT5 /></PageSlide>} />
            <Route path="/notifications" element={<PageSlide><Notifications /></PageSlide>} />
            <Route path="/redeem" element={<PageSlide><Redeem /></PageSlide>} />
            <Route element={<LSR3RLayout />}>
              <Route path="/lsr3r" element={<PageSlide><LSR3RScanner /></PageSlide>} />
              <Route path="/lsr3r/history" element={<PageSlide><LSR3RHistory /></PageSlide>} />
              <Route path="/lsr3r/analytics" element={<PageSlide><LSR3RAnalytics /></PageSlide>} />
              <Route path="/lsr3r/settings" element={<PageSlide><LSR3RSettings /></PageSlide>} />
              <Route path="/lsr3r/webhook" element={<PageSlide><LSR3RWebhook /></PageSlide>} />
            </Route>
            <Route path="/trade-journal" element={<PageSlide><TradeJournal /></PageSlide>} />
            <Route path="/tradingview" element={<PageSlide><TradingView /></PageSlide>} />
            <Route path="/market-structure" element={<PageSlide><MarketStructure /></PageSlide>} />
          </Route>
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
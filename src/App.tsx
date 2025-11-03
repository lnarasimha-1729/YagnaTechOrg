import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/layout/Layout";
import Home from "./pages/Home";
import About from "./pages/About";
import Courses from "./pages/Courses";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import Register from "./pages/RegisterForm";
import FAQs from "./pages/FAQs";
import Students from "./pages/Students";
import Colleges from "./pages/Colleges";
import Companies from "./pages/Companies";
import StudentDashboard from "./pages/StudentDashboard";
import ProgramsPage from "./pages/Programspage";
import ProgramDetailPage from "./pages/ProgramDetailPage";
import PreAssessmentPage from "./pages/PreAssessmentPage";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Layout><Home /></Layout>} />
            <Route path="/about" element={<Layout><About /></Layout>} />
            <Route path="/courses" element={<Layout><Courses /></Layout>} />
            <Route path="/contact" element={<Layout><Contact /></Layout>} />
            <Route path="/register" element={<Layout><Register /></Layout>} />
            <Route path="/faqs" element={<Layout><FAQs /></Layout>} />
            <Route path="/students" element={<Layout><Students /></Layout>} />
            <Route path="/colleges" element={<Layout><Colleges /></Layout>} />
            <Route path="/companies" element={<Layout><Companies /></Layout>} />
            
            {/* Authentication Pages */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected Routes */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <StudentDashboard />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admindashboard" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <AdminDashboard />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/preassessment" 
              element={
                <ProtectedRoute>
                  <PreAssessmentPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/programs" 
              element={
                <ProtectedRoute>
                  <ProgramsPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/programdetail" 
              element={
                <ProtectedRoute>
                  <ProgramDetailPage />
                </ProtectedRoute>
              } 
            />
            
            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
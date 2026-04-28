import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import appIcon from '../assets/images/hub.svg';
import LoginForm from '../features/login/LoginForm';
import { Container, Layers, Server } from 'lucide-react';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-purple-500/10 rounded-full blur-3xl" />

        <motion.div
          animate={{
            y: [0, -20, 0],
            rotate: [0, 5, 0]
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 left-10 text-blue-400/20"
        >
          <Container size={80} />
        </motion.div>

        <motion.div
          animate={{
            y: [0, 20, 0],
            rotate: [0, -5, 0]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-20 right-20 text-purple-400/20"
        >
          <Layers size={100} />
        </motion.div>

        <motion.div
          animate={{
            y: [0, -15, 0],
            x: [0, 10, 0]
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 right-10 text-cyan-400/20"
        >
          <Server size={60} />
        </motion.div>
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="inline-flex items-center justify-center mb-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl blur-lg opacity-75" />
                <div className="relative w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                  <img src={appIcon} className="w-22 h-22 brightness-0 invert " />
                </div>
              </div>
            </motion.div>

            <p className="text-blue-200/70">
              Plataforma para o trabalho de devops.
            </p>
          </div>


          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20" />

            <div className="relative p-8">
              <h2 className="text-2xl text-white mb-6">
                Bem-vindo de volta
              </h2>

              <LoginForm />


              <div className="text-center">
                <p className="text-blue-100/70">
                  Não tem uma conta?{' '}
                  <button
                    onClick={() => navigate('/create-account')}
                    className="text-blue-300 hover:text-blue-200 transition-colors underline-offset-4 hover:underline"
                  >
                    Criar conta
                  </button>
                </p>
              </div>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center text-blue-200/50 text-sm mt-8"
          >
            Plataforma segura para gerenciamento de ambientes.
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};
export default LoginPage;

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Logo from "@/components/Logo";

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate("/"), 2600);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 grid-lines opacity-30" />
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      >
        <Logo size={120} withText />
      </motion.div>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: 160 }}
        transition={{ delay: 0.8, duration: 1.4 }}
        className="h-0.5 bg-red-500 neon-red mt-10 rounded-full"
      />
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="mt-4 text-xs uppercase tracking-[0.3em] text-muted-foreground"
      >
        Initializing trading engine…
      </motion.p>
    </div>
  );
}
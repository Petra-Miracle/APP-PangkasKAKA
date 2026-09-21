"use client";

import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Spinner } from "@heroui/react";

type LoadingScreenProps = {
  size?: number | string;
  message?: string;
  imageFront?: string;
  imageBack?: string;
  paused?: boolean;
  isLoading?: boolean;
};

export default function LoadingScreen({
  size = 140,
  message = "",
  imageFront = "/logo.jpeg",
  imageBack = "/logo.jpeg",
  paused = false,
  isLoading = true,
}: LoadingScreenProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
    return () => setMounted(false);
  }, []);

  if (!isLoading || !mounted) return null;

  const px = typeof size === "number" ? `${size}px` : size;
  const coinStyle = { width: px, height: px };

  const flipAnim = paused ? { rotateY: 0 } : { rotateY: [0, 180, 360] };
  const flipTransition = {
    duration: 1.6,
    ease: "easeInOut" as const,
    repeat: Infinity,
    repeatType: "loop" as const,
  };

  const backdropVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const contentVariants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.8, opacity: 0 },
  };

  const loadingContent = (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={backdropVariants}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0f1a2e]/70 backdrop-blur-sm"
      role="presentation"
      aria-hidden="true"
    >
      <motion.div
        variants={contentVariants}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center justify-center gap-6"
      >
        <div
          className="relative flex items-center justify-center"
          style={{ perspective: 1200 }}
          aria-hidden={paused}
        >
          <motion.div
            className="relative will-change-transform"
            style={coinStyle}
            animate={flipAnim}
            transition={flipTransition}
          >
            <div
              className="absolute inset-0 rounded-full overflow-hidden shadow-2xl"
              style={{ transformStyle: "preserve-3d" }}
            >
              <div
                className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white to-[#fdf0d9]"
                style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageFront} alt="PangkasKAKA" className="w-full h-full object-cover" />
              </div>
              <div
                className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white to-[#fdf0d9]"
                style={{
                  transform: "rotateY(180deg)",
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageBack} alt="" className="w-full h-full object-cover" />
              </div>
            </div>

            <motion.div
              className="absolute -inset-2 rounded-full pointer-events-none border-2 border-[#f5a524]/40"
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            <div className="absolute -inset-1 rounded-full pointer-events-none border border-white/20" />
          </motion.div>
        </div>

        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Spinner size="lg" color="current" className="text-white" />
          {message && <p className="mt-3 text-lg font-medium text-white">{message}</p>}
        </motion.div>
      </motion.div>
    </motion.div>
  );

  return typeof document !== "undefined" ? createPortal(loadingContent, document.body) : null;
}

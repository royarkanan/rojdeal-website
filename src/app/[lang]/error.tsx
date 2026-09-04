'use client';
import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center text-center p-6 bg-white rounded-[22px] border border-gray-100 my-8 shadow-sm">
      <div className="w-12 h-12 rounded-full bg-red-50 text-rojRed flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-black text-rojNavy mb-1">حدث خطأ أثناء تحميل البيانات</h2>
      <p className="text-xs text-gray-500 max-w-sm mb-4">تعذر الاتصال بالخادم في الوقت الحالي. يرجى إعادة المحاولة.</p>
      <button
        onClick={() => reset()}
        className="flex items-center gap-2 px-4 py-2 bg-rojRed hover:bg-rojRed-hover text-white text-xs font-bold rounded-xl transition"
      >
        <RotateCcw className="w-4 h-4" />
        <span>إعادة المحاولة</span>
      </button>
    </div>
  );
}

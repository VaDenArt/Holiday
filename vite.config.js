import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/Holiday/', // ← имя репозитория с косыми чертами по краям
});
import { dirname } from "path";
// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import next from 'eslint-config-next';
import globals from 'globals';

export default [
  // ignore บางโฟลเดอร์ตอน lint
  {
    ignores: ['.next/**', 'node_modules/**', 'dist/**', 'out/**'],
  },

  // กติกาพื้นฐาน JS + TS
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Next.js rules (core-web-vitals รวมอยู่ใน config ใหม่แล้ว)
  ...next,

  // ตั้งค่าภาษา/ตัวแปร global
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true, // ให้ TS ตรวจ type จาก tsconfig
      },
    },
    rules: {
      // เติม custom rules ได้ตามต้องการ
      // 'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },
];

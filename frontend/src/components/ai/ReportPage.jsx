import React, { forwardRef } from 'react';
import { Box } from '@mui/material';

import { goldGradient } from '../../theme.js';

/**
 * Printable A4-styled container that renders inside the app but prints as a
 * standalone formal document.
 *
 * The component injects a scoped <style> tag with @media print rules so that
 * only the report content is visible when window.print() is invoked.
 *
 * Props:
 *   children: ReactNode
 *   id?: string  (DOM id to scope print rules - default 'brewtrade-report-page')
 */
const ReportPage = forwardRef(function ReportPage(
  { children, id = 'brewtrade-report-page' },
  ref
) {
  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 14mm 12mm;
          }
          body * {
            visibility: hidden !important;
          }
          #${id}, #${id} * {
            visibility: visible !important;
          }
          #${id} {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 100%;
            box-shadow: none !important;
            border: none !important;
            background: #FFFFFF !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <Box
        id={id}
        ref={ref}
        sx={{
          width: '100%',
          maxWidth: '820px',
          mx: 'auto',
          background: '#FFFFFF',
          color: '#1A1A1A',
          border: '1px solid rgba(212,165,42,0.25)',
          borderRadius: 2,
          boxShadow:
            '0 32px 80px rgba(26,26,26,0.10), 0 1px 0 rgba(255,255,255,0.6) inset',
          overflow: 'hidden',
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          position: 'relative',
        }}
      >
        {/* Top gold gradient bar */}
        <Box
          sx={{
            height: 8,
            background: goldGradient,
          }}
        />

        <Box sx={{ p: { xs: 4, md: 6 } }}>{children}</Box>

        {/* Bottom gold gradient bar */}
        <Box
          sx={{
            height: 4,
            background: goldGradient,
            opacity: 0.6,
          }}
        />
      </Box>
    </>
  );
});

export default ReportPage;

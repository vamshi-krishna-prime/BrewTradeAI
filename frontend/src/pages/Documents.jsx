import React, { useMemo, useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  Stack,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Drawer,
  Divider,
  Chip,
  Skeleton,
  Alert,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import SearchIcon from '@mui/icons-material/Search';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import DescriptionIcon from '@mui/icons-material/Description';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import TableChartIcon from '@mui/icons-material/TableChart';
import ArticleIcon from '@mui/icons-material/Article';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PublicIcon from '@mui/icons-material/Public';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import LaunchIcon from '@mui/icons-material/Launch';
import ClearIcon from '@mui/icons-material/Clear';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import RefreshIcon from '@mui/icons-material/Refresh';

import PageHeader from '../components/common/PageHeader.jsx';
import GlassCard from '../components/common/GlassCard.jsx';
import client, { getDocuments } from '../api/client.js';
import { formatDate } from '../utils/format.js';
import { goldGradient } from '../theme.js';

// -----------------------------------------------------------------------------
// Folder definitions (canonical)
// -----------------------------------------------------------------------------
const FOLDERS = [
  {
    key: 'export',
    label: 'Export Documents',
    icon: <PublicIcon />,
    docType: 'export',
    keywords: ['export', 'bill of lading', 'bol', 'certificate'],
  },
  {
    key: 'statements',
    label: 'Statements',
    icon: <AccountBalanceIcon />,
    docType: 'statement',
    keywords: ['statement', 'account', 'ar', 'aging'],
  },
  {
    key: 'commercial_invoice',
    label: 'Commercial Invoices',
    icon: <ReceiptLongIcon />,
    docType: 'commercial_invoice',
    keywords: ['invoice', 'commercial'],
  },
  {
    key: 'caricom_invoice',
    label: 'CARICOM Invoices',
    icon: <AssignmentIcon />,
    docType: 'caricom_invoice',
    keywords: ['caricom'],
  },
  {
    key: 'shipping',
    label: 'Shipping Documents',
    icon: <LocalShippingIcon />,
    docType: 'shipping',
    keywords: ['shipping', 'packing', 'manifest', 'tracking'],
  },
];

// -----------------------------------------------------------------------------
// API helpers (resilient to backend shape variations)
// -----------------------------------------------------------------------------
async function fetchAllDocuments(customerId) {
  // Primary endpoint accepts {customer_id} and returns a list
  try {
    const data = await getDocuments({ customer_id: customerId });
    return normalizeList(data);
  } catch (_) {
    // Fall back to bare /documents
    try {
      const resp = await client.get('/documents');
      return normalizeList(resp.data);
    } catch (_) {
      return [];
    }
  }
}

async function fetchFolders(customerId) {
  // Optional endpoint - degrade gracefully if missing
  try {
    const resp = await client.get('/documents/folders', {
      params: customerId ? { customer_id: customerId } : {},
    });
    return normalizeList(resp.data);
  } catch (_) {
    return null;
  }
}

async function searchDocuments(query, customerId) {
  if (!query || !query.trim()) return null;
  try {
    const resp = await client.get('/documents/search', {
      params: { q: query, customer_id: customerId },
    });
    return normalizeList(resp.data);
  } catch (_) {
    return null;
  }
}

function normalizeList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.documents)) return data.documents;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

// -----------------------------------------------------------------------------
// Doc helpers
// -----------------------------------------------------------------------------
function getDocFilename(doc) {
  return doc.filename || doc.file_name || doc.name || doc.title || 'Document';
}
function getDocTitle(doc) {
  return doc.title || doc.name || doc.subject || doc.filename || 'Untitled Document';
}
function getDocDate(doc) {
  return doc.created_at || doc.uploaded_at || doc.date || doc.issued_at || null;
}
function getDocSize(doc) {
  const s = doc.size_bytes ?? doc.size ?? null;
  if (s == null) return doc.size_label || '-';
  const kb = s / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
function getDocType(doc) {
  return (
    doc.doc_type ||
    doc.type ||
    doc.category ||
    inferTypeFromFilename(getDocFilename(doc))
  );
}
function inferTypeFromFilename(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.includes('caricom')) return 'caricom_invoice';
  if (lower.includes('invoice')) return 'commercial_invoice';
  if (lower.includes('statement')) return 'statement';
  if (lower.includes('ship') || lower.includes('packing')) return 'shipping';
  if (lower.includes('export') || lower.includes('bol')) return 'export';
  return 'document';
}
function getFileIcon(doc) {
  const name = getDocFilename(doc).toLowerCase();
  if (name.endsWith('.pdf')) return <PictureAsPdfIcon />;
  if (name.match(/\.(png|jpg|jpeg|webp|gif)$/)) return <ImageIcon />;
  if (name.match(/\.(xls|xlsx|csv)$/)) return <TableChartIcon />;
  if (name.match(/\.(doc|docx|txt)$/)) return <ArticleIcon />;
  return <DescriptionIcon />;
}
function getDocPreviewText(doc) {
  const raw =
    doc.preview ||
    doc.summary ||
    doc.description ||
    doc.content ||
    doc.body ||
    doc.notes ||
    '';
  return String(raw || '').slice(0, 200);
}
function getDocDownloadUrl(doc) {
  if (doc.download_url) return doc.download_url;
  if (doc.url) return doc.url;
  if (doc.id) return `/api/documents/${doc.id}/download`;
  return null;
}

function classifyDoc(doc) {
  const t = String(getDocType(doc)).toLowerCase();
  const name = String(getDocFilename(doc)).toLowerCase();
  for (const f of FOLDERS) {
    if (t === f.docType || t === f.key) return f.key;
    if (f.keywords.some((k) => name.includes(k) || t.includes(k))) return f.key;
  }
  return null;
}

// -----------------------------------------------------------------------------
// Main page
// -----------------------------------------------------------------------------
export default function Documents() {
  const customerId =
    (typeof window !== 'undefined' && localStorage.getItem('customerId')) || '1';

  const [activeFolder, setActiveFolder] = useState(FOLDERS[0].key);
  const [view, setView] = useState('grid');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Debounce search input
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Load all documents (used for folder counts + fallback when no search)
  const allDocsQ = useQuery({
    queryKey: ['documents-all', customerId],
    queryFn: () => fetchAllDocuments(customerId),
    staleTime: 60_000,
    retry: 1,
  });

  // Optional folder counts endpoint
  const foldersQ = useQuery({
    queryKey: ['documents-folders', customerId],
    queryFn: () => fetchFolders(customerId),
    staleTime: 60_000,
    retry: 0,
  });

  // Server search - only fired when query is non-empty
  const searchQ = useQuery({
    queryKey: ['documents-search', debouncedSearch, customerId],
    queryFn: () => searchDocuments(debouncedSearch, customerId),
    enabled: debouncedSearch.length > 0,
    staleTime: 30_000,
    retry: 0,
  });

  const isSearching = debouncedSearch.length > 0;
  const isLoading =
    allDocsQ.isLoading || (isSearching && searchQ.isLoading);

  // Build folder metadata (counts + latest date)
  const folderMeta = useMemo(() => {
    const docs = allDocsQ.data || [];
    const remoteFolders = foldersQ.data || [];

    return FOLDERS.map((f) => {
      // Prefer remote folder data if it matches
      const remote = remoteFolders.find(
        (r) =>
          (r.key && r.key === f.key) ||
          (r.doc_type && r.doc_type === f.docType) ||
          (r.label && r.label.toLowerCase() === f.label.toLowerCase())
      );

      const matched = docs.filter((d) => classifyDoc(d) === f.key);
      const count = remote?.count ?? matched.length;
      const latestRaw =
        remote?.latest_date ||
        matched
          .map(getDocDate)
          .filter(Boolean)
          .sort()
          .slice(-1)[0] ||
        null;

      return {
        ...f,
        count,
        latest: latestRaw,
      };
    });
  }, [allDocsQ.data, foldersQ.data]);

  // Visible doc list
  const visibleDocs = useMemo(() => {
    if (isSearching) {
      // Server-side results if available, else local filter
      const remote = searchQ.data;
      const list =
        remote != null
          ? remote
          : (allDocsQ.data || []).filter((d) => {
              const q = debouncedSearch.toLowerCase();
              return (
                getDocFilename(d).toLowerCase().includes(q) ||
                getDocTitle(d).toLowerCase().includes(q) ||
                String(getDocType(d)).toLowerCase().includes(q)
              );
            });
      return list;
    }
    return (allDocsQ.data || []).filter((d) => classifyDoc(d) === activeFolder);
  }, [
    isSearching,
    searchQ.data,
    allDocsQ.data,
    debouncedSearch,
    activeFolder,
  ]);

  const activeFolderDef = FOLDERS.find((f) => f.key === activeFolder) || FOLDERS[0];

  const handleDownload = (doc) => {
    const url = getDocDownloadUrl(doc);
    if (!url) return;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener');
    }
  };

  return (
    <Box>
      <PageHeader
        title="Document Center"
        subtitle="All your trade and accounting documents in one secure place"
        breadcrumbs={[
          { label: 'Distributor', to: '/distributor/dashboard' },
          { label: 'Documents' },
          ...(isSearching
            ? [{ label: `Search: "${debouncedSearch}"` }]
            : [{ label: activeFolderDef.label }]),
        ]}
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            <ToggleButtonGroup
              size="small"
              value={view}
              exclusive
              onChange={(_, v) => v && setView(v)}
              aria-label="view toggle"
              sx={{
                background: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(212,165,42,0.25)',
                borderRadius: 2,
                '& .MuiToggleButton-root': {
                  border: 0,
                  px: 1.5,
                  '&.Mui-selected': {
                    background: goldGradient,
                    color: '#1A1A1A',
                  },
                },
              }}
            >
              <ToggleButton value="grid" aria-label="grid view">
                <GridViewIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="list" aria-label="list view">
                <ViewListIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title="Refresh">
              <IconButton
                onClick={() => {
                  allDocsQ.refetch();
                  if (isSearching) searchQ.refetch();
                }}
                sx={{
                  background: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(212,165,42,0.25)',
                }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />

      {/* Search bar */}
      <GlassCard hover={false} sx={{ p: 1.5, mb: 2.5 }}>
        <TextField
          fullWidth
          placeholder="Search across all documents (filename, title, type)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'rgba(26,26,26,0.45)' }} />
              </InputAdornment>
            ),
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
            sx: {
              background: 'transparent',
              '& fieldset': { border: 'none' },
              fontSize: '0.95rem',
            },
          }}
        />
      </GlassCard>

      {allDocsQ.isError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Could not load documents from the server. Showing any cached results.
        </Alert>
      )}

      <Grid container spacing={2.5}>
        {/* Left sidebar - folder browser */}
        <Grid item xs={12} md={3}>
          <GlassCard hover={false} sx={{ p: 0, position: 'sticky', top: 24 }}>
            <Box sx={{ p: 2, pb: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                  fontWeight: 700,
                }}
              >
                Folders
              </Typography>
            </Box>
            <List sx={{ p: 0.5, pb: 1 }}>
              {folderMeta.map((f) => {
                const isActive = !isSearching && activeFolder === f.key;
                return (
                  <ListItemButton
                    key={f.key}
                    selected={isActive}
                    onClick={() => {
                      setActiveFolder(f.key);
                      if (isSearching) setSearch('');
                    }}
                    sx={{
                      borderRadius: 2,
                      mx: 1,
                      my: 0.25,
                      transition: 'all 0.2s ease',
                      '&.Mui-selected': {
                        background:
                          'linear-gradient(135deg, rgba(212,165,42,0.18) 0%, rgba(242,200,73,0.10) 100%)',
                        border: '1px solid rgba(212,165,42,0.35)',
                        '&:hover': {
                          background:
                            'linear-gradient(135deg, rgba(212,165,42,0.24) 0%, rgba(242,200,73,0.14) 100%)',
                        },
                      },
                      '&:hover': {
                        background: 'rgba(212,165,42,0.06)',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 1.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isActive
                            ? goldGradient
                            : 'rgba(212,165,42,0.10)',
                          color: isActive ? '#1A1A1A' : '#B5891F',
                          boxShadow: isActive
                            ? '0 4px 12px rgba(212,165,42,0.35)'
                            : 'none',
                        }}
                      >
                        {isActive ? <FolderOpenIcon fontSize="small" /> : f.icon}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: isActive ? 700 : 600,
                            lineHeight: 1.2,
                          }}
                        >
                          {f.label}
                        </Typography>
                      }
                      secondary={
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
                        >
                          {f.count} {f.count === 1 ? 'file' : 'files'}
                          {f.latest ? ` - latest ${formatDate(f.latest)}` : ''}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </GlassCard>
        </Grid>

        {/* Center pane - file grid/list */}
        <Grid item xs={12} md={9}>
          <Box>
            {/* Sub-header */}
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1.5, px: 0.5 }}
            >
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {isSearching ? (
                  <>
                    Search results
                    <Typography
                      component="span"
                      sx={{
                        ml: 1,
                        color: 'text.secondary',
                        fontWeight: 500,
                        fontSize: '0.9rem',
                      }}
                    >
                      for "{debouncedSearch}"
                    </Typography>
                  </>
                ) : (
                  activeFolderDef.label
                )}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isLoading
                  ? 'Loading...'
                  : `${visibleDocs.length} ${
                      visibleDocs.length === 1 ? 'document' : 'documents'
                    }`}
              </Typography>
            </Stack>

            {isLoading ? (
              <LoadingState view={view} />
            ) : visibleDocs.length === 0 ? (
              <EmptyState
                isSearching={isSearching}
                folderLabel={activeFolderDef.label}
                onClear={() => setSearch('')}
              />
            ) : view === 'grid' ? (
              <DocGrid
                docs={visibleDocs}
                onSelect={setSelectedDoc}
                onDownload={handleDownload}
              />
            ) : (
              <DocList
                docs={visibleDocs}
                onSelect={setSelectedDoc}
                onDownload={handleDownload}
              />
            )}
          </Box>
        </Grid>
      </Grid>

      {/* Right preview drawer */}
      <PreviewDrawer
        doc={selectedDoc}
        onClose={() => setSelectedDoc(null)}
        onDownload={handleDownload}
      />
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------
function LoadingState({ view }) {
  if (view === 'list') {
    return (
      <GlassCard hover={false} sx={{ p: 0 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={56} sx={{ m: 1 }} />
        ))}
      </GlassCard>
    );
  }
  return (
    <Grid container spacing={2}>
      {Array.from({ length: 8 }).map((_, i) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={i}>
          <Skeleton variant="rounded" height={170} />
        </Grid>
      ))}
    </Grid>
  );
}

function EmptyState({ isSearching, folderLabel, onClear }) {
  return (
    <GlassCard hover={false} sx={{ p: 5, textAlign: 'center' }}>
      <Box
        sx={{
          width: 72,
          height: 72,
          mx: 'auto',
          mb: 2,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, rgba(212,165,42,0.15) 0%, rgba(242,200,73,0.08) 100%)',
          border: '1px solid rgba(212,165,42,0.22)',
        }}
      >
        {isSearching ? (
          <SearchIcon sx={{ fontSize: 32, color: '#B5891F' }} />
        ) : (
          <CloudOffIcon sx={{ fontSize: 32, color: '#B5891F' }} />
        )}
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
        {isSearching ? 'No matching documents' : `No ${folderLabel.toLowerCase()} yet`}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {isSearching
          ? 'Try a different search term or clear the search.'
          : 'New documents will appear here when they become available.'}
      </Typography>
      {isSearching && (
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<ClearIcon />}
          onClick={onClear}
        >
          Clear search
        </Button>
      )}
    </GlassCard>
  );
}

function DocGrid({ docs, onSelect, onDownload }) {
  return (
    <Grid container spacing={2}>
      <AnimatePresence mode="popLayout">
        {docs.map((doc, idx) => (
          <Grid
            item
            xs={12}
            sm={6}
            md={4}
            lg={3}
            key={doc.id || doc.filename || idx}
          >
            <motion.div
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{
                duration: 0.4,
                delay: Math.min(idx, 8) * 0.04,
                ease: [0.22, 1, 0.36, 1],
              }}
              whileHover={{ y: -4 }}
              onClick={() => onSelect(doc)}
              style={{ cursor: 'pointer' }}
            >
              <Box
                sx={{
                  background: 'rgba(255,255,255,0.78)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: '1px solid rgba(212,165,42,0.22)',
                  borderRadius: 3,
                  p: 2,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow:
                    '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 22px rgba(26,26,26,0.05)',
                  transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
                  '&:hover': {
                    borderColor: 'rgba(212,165,42,0.4)',
                    boxShadow:
                      '0 1px 0 rgba(255,255,255,0.6) inset, 0 16px 34px rgba(212,165,42,0.15)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    background: goldGradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#1A1A1A',
                    boxShadow: '0 6px 18px rgba(212,165,42,0.35)',
                    mb: 1.5,
                  }}
                >
                  {getFileIcon(doc)}
                </Box>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    minHeight: 36,
                  }}
                >
                  {getDocTitle(doc)}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    mt: 0.5,
                    display: 'block',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: '0.72rem',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                  title={getDocFilename(doc)}
                >
                  {getDocFilename(doc)}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mt: 1.5 }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(getDocDate(doc)) || '-'}
                  </Typography>
                  <Chip
                    size="small"
                    label={getDocSize(doc)}
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      background: 'rgba(212,165,42,0.10)',
                      color: '#8a5a10',
                      border: '1px solid rgba(212,165,42,0.22)',
                    }}
                  />
                </Stack>
              </Box>
            </motion.div>
          </Grid>
        ))}
      </AnimatePresence>
    </Grid>
  );
}

function DocList({ docs, onSelect, onDownload }) {
  return (
    <GlassCard hover={false} sx={{ p: 0, overflow: 'hidden' }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ background: 'rgba(212,165,42,0.06)' }}>
            <TableCell sx={{ fontWeight: 700 }}>Document</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Filename</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Size</TableCell>
            <TableCell sx={{ fontWeight: 700 }} align="right">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {docs.map((doc, idx) => (
            <TableRow
              key={doc.id || doc.filename || idx}
              hover
              onClick={() => onSelect(doc)}
              sx={{ cursor: 'pointer' }}
            >
              <TableCell>
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: 1.5,
                      background: goldGradient,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#1A1A1A',
                      flexShrink: 0,
                    }}
                  >
                    {getFileIcon(doc)}
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {getDocTitle(doc)}
                  </Typography>
                </Stack>
              </TableCell>
              <TableCell
                sx={{
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: '0.78rem',
                  color: 'text.secondary',
                  maxWidth: 240,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {getDocFilename(doc)}
              </TableCell>
              <TableCell>{formatDate(getDocDate(doc)) || '-'}</TableCell>
              <TableCell>{getDocSize(doc)}</TableCell>
              <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                <Tooltip title="Preview">
                  <IconButton size="small" onClick={() => onSelect(doc)}>
                    <LaunchIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Download">
                  <IconButton size="small" onClick={() => onDownload(doc)}>
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </GlassCard>
  );
}

function PreviewDrawer({ doc, onClose, onDownload }) {
  const open = Boolean(doc);
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 460 },
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(255,248,225,0.85) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(212,165,42,0.28)',
        },
      }}
    >
      {doc && (
        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                background: goldGradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1A1A1A',
                boxShadow: '0 6px 18px rgba(212,165,42,0.35)',
                mr: 1.5,
              }}
            >
              {getFileIcon(doc)}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                Document Preview
              </Typography>
              <Typography
                variant="h6"
                sx={{ fontWeight: 800, lineHeight: 1.2 }}
                noWrap
              >
                {getDocTitle(doc)}
              </Typography>
            </Box>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {/* Metadata */}
          <Stack spacing={1.25} sx={{ mb: 2.5 }}>
            <MetaRow label="Filename" value={getDocFilename(doc)} mono />
            <MetaRow label="Type" value={String(getDocType(doc)).replace(/_/g, ' ')} />
            <MetaRow label="Created" value={formatDate(getDocDate(doc)) || '-'} />
            <MetaRow label="Size" value={getDocSize(doc)} />
            {doc.order_number && <MetaRow label="Order" value={doc.order_number} />}
            {doc.invoice_number && (
              <MetaRow label="Invoice" value={doc.invoice_number} />
            )}
          </Stack>

          {/* Preview */}
          <Typography
            variant="caption"
            sx={{
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              fontWeight: 700,
              mb: 0.75,
              display: 'block',
            }}
          >
            Preview
          </Typography>
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(212,165,42,0.18)',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.85rem',
              lineHeight: 1.55,
              color: 'text.primary',
              minHeight: 120,
              whiteSpace: 'pre-wrap',
              flex: 1,
              overflow: 'auto',
            }}
          >
            {getDocPreviewText(doc) ||
              (
                <Typography
                  component="span"
                  variant="body2"
                  sx={{ color: 'text.secondary', fontStyle: 'italic' }}
                >
                  No preview text available for this document. Download the file to
                  view its full contents.
                </Typography>
              )}
            {getDocPreviewText(doc) && getDocPreviewText(doc).length >= 200 && (
              <Typography
                component="span"
                sx={{ color: 'text.secondary', fontStyle: 'italic' }}
              >
                ...
              </Typography>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Button
            fullWidth
            variant="contained"
            color="secondary"
            size="large"
            startIcon={<DownloadIcon />}
            onClick={() => onDownload(doc)}
            disabled={!getDocDownloadUrl(doc)}
            sx={{ fontWeight: 700 }}
          >
            Download Document
          </Button>
        </Box>
      )}
    </Drawer>
  );
}

function MetaRow({ label, value, mono }) {
  return (
    <Stack direction="row" spacing={2} alignItems="flex-start">
      <Typography
        variant="caption"
        sx={{
          flex: '0 0 80px',
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 700,
          fontSize: '0.7rem',
          pt: 0.25,
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          wordBreak: 'break-word',
          fontFamily: mono
            ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
            : 'inherit',
          fontSize: mono ? '0.8rem' : '0.875rem',
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

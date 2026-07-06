'use client';

import {useSelectedMower} from '@/stores/mowersStore';
import {outerCardStyles} from '@/lib/cardStyles';
import {CloudUpload as UploadIcon, Delete as DeleteIcon} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import {useCallback, useEffect, useRef, useState} from 'react';

interface AudioFile {
  name: string;
  size: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function nextTrackNumber(files: AudioFile[]): number {
  let max = 0;
  for (const file of files) {
    const match = file.name.match(/^(\d+)\.wav$/);
    if (match) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  }
  return max + 1;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x2000; // 8KB slices to avoid call-stack limits when spreading into String.fromCharCode
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function AudioFilesCard() {
  const theme = useTheme();
  const rpc = useSelectedMower((s) => s?.rpc);

  const [files, setFiles] = useState<AudioFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trackNumber, setTrackNumber] = useState(1);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AudioFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!rpc) return;
    try {
      const {files: newFiles} = await rpc.fs.list({path: 'audio'});
      setFiles(newFiles);
      setTrackNumber(nextTrackNumber(newFiles));
      setError(null);
    } catch (err) {
      console.error('Failed to list audio files:', err);
      setError('Failed to load audio files');
    }
  }, [rpc]);

  useEffect(() => {
    if (!rpc) {
      setError('No mower selected');
      setFiles(null);
      return;
    }
    refresh();
  }, [rpc, refresh]);

  const handleDeleteClick = (file: AudioFile) => {
    setConfirmTarget(file);
  };

  const handleConfirmDelete = async () => {
    if (!rpc || !confirmTarget) return;
    const file = confirmTarget;
    setConfirmTarget(null);
    setDeletingName(file.name);
    try {
      await rpc.fs.remove({path: 'audio/' + file.name});
      await refresh();
      setError(null);
    } catch (err) {
      console.error('Failed to remove audio file:', err);
      setError('Failed to delete audio file');
    } finally {
      setDeletingName(null);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = '';
    if (!file || !rpc) return;

    setUploading(true);
    try {
      const data = await fileToBase64(file);
      await rpc.fs.write({path: `audio/${trackNumber}.wav`, data});
      await refresh();
      setError(null);
    } catch (err) {
      console.error('Failed to upload audio file:', err);
      setError('Failed to upload audio file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card sx={outerCardStyles(theme)}>
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          Audio Files
        </Typography>

        {error && (
          <Alert severity="error" sx={{mb: 2}}>
            {error}
          </Alert>
        )}

        {!rpc ? null : files === null ? (
          <Box sx={{display: 'flex', justifyContent: 'center', py: 3}}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <List disablePadding>
            {files.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{py: 1}}>
                No audio files uploaded yet.
              </Typography>
            )}
            {files.map((file) => (
              <ListItem
                key={file.name}
                disableGutters
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    disabled={deletingName === file.name}
                    onClick={() => handleDeleteClick(file)}
                  >
                    {deletingName === file.name ? <CircularProgress size={20} /> : <DeleteIcon />}
                  </IconButton>
                }
              >
                <ListItemText primary={file.name} secondary={formatSize(file.size)} />
              </ListItem>
            ))}
          </List>
        )}

        <Box sx={{display: 'flex', alignItems: 'center', gap: 2, mt: 2, flexWrap: 'wrap'}}>
          <TextField
            label="Track #"
            type="number"
            size="small"
            value={trackNumber}
            onChange={(e) => setTrackNumber(parseInt(e.target.value, 10) || 1)}
            slotProps={{htmlInput: {min: 1}}}
            sx={{width: 120}}
            disabled={!rpc || uploading}
          />
          <Button
            variant="contained"
            startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
            onClick={handleUploadClick}
            disabled={!rpc || uploading}
          >
            Upload track
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,audio/wav"
            onChange={handleFileChange}
            style={{display: 'none'}}
          />
        </Box>
      </CardContent>

      <Dialog open={confirmTarget !== null} onClose={() => setConfirmTarget(null)}>
        <DialogTitle>Delete audio file?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete &quot;{confirmTarget?.name}&quot;? This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmTarget(null)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

import React, { useEffect, useState } from 'react';
import {
  FolderArchive,
  UploadCloud,
  Search,
  Trash2,
  Edit3,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  FileCode,
  X,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { ErrorAlert } from '../components/ui/ErrorAlert';
import { EmptyState } from '../components/ui/EmptyState';
import { CompanyAssetRecord, AssetCategory } from '../types/company';
import { fetchAssetsApi, uploadAssetApi, reuploadAssetApi, renameAssetApi, deleteAssetApi } from '../api/assets';
import { API_BASE_URL } from '../api/config';

export const CompanyAssetsPage: React.FC = () => {
  const [assets, setAssets] = useState<CompanyAssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Search, Filter, Sort state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'size'>('newest');

  // Preview Modal
  const [previewAsset, setPreviewAsset] = useState<CompanyAssetRecord | null>(null);

  // Rename Modal
  const [renameAsset, setRenameAsset] = useState<CompanyAssetRecord | null>(null);
  const [newFilename, setNewFilename] = useState('');

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<CompanyAssetRecord | null>(null);

  const loadAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAssetsApi({
        search: searchTerm,
        category: selectedCategory,
        sort: sortBy,
      });
      setAssets(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load company media assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [selectedCategory, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadAssets();
  };

  const handleFileUpload = async (file: File) => {
    setError(null);
    setIsUploading(true);
    try {
      await uploadAssetApi(file);
      await loadAssets();
    } catch (err: any) {
      setError(err.message || 'Failed to upload media asset.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameAsset || !newFilename.trim()) return;
    setIsRenaming(true);
    try {
      await renameAssetApi(renameAsset.id, newFilename);
      setRenameAsset(null);
      await loadAssets();
    } catch (err: any) {
      setError(err.message || 'Failed to rename asset.');
    } finally {
      setIsRenaming(false);
    }
  };

  const [reuploadTarget, setReuploadTarget] = useState<CompanyAssetRecord | null>(null);

  const handleReuploadFile = async (file: File) => {
    if (!reuploadTarget) return;
    setIsUploading(true);
    setError(null);
    try {
      const updated = await reuploadAssetApi(reuploadTarget.id, file);
      setReuploadTarget(null);
      if (previewAsset?.id === updated.id) setPreviewAsset(updated);
      await loadAssets();
    } catch (err: any) {
      setError(err.message || 'Failed to re-upload asset file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAssetApi(deleteTarget.id);
      setDeleteTarget(null);
      if (previewAsset?.id === deleteTarget.id) setPreviewAsset(null);
      await loadAssets();
    } catch (err: any) {
      setError(err.message || 'Failed to delete asset.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getCategoryIcon = (category: AssetCategory) => {
    switch (category) {
      case 'IMAGE':
        return <ImageIcon className="w-5 h-5 text-emerald-400" />;
      case 'GIF':
        return <FileCode className="w-5 h-5 text-purple-400" />;
      case 'VIDEO':
        return <Video className="w-5 h-5 text-sky-400" />;
      case 'AUDIO':
        return <Music className="w-5 h-5 text-amber-400" />;
      default:
        return <FileText className="w-5 h-5 text-slate-400" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <PageHeader
        title="Company Media Asset Library"
        description="Repository of images, videos, audio, GIFs, and documents for WhatsApp campaign broadcasts."
        badge={<Badge variant="info">Local Storage Active</Badge>}
        actions={
          <label className="cursor-pointer">
            <Button variant="primary" size="sm" isLoading={isUploading} leftIcon={<UploadCloud className="w-4 h-4" />}>
              Upload Media Asset
            </Button>
            <input
              type="file"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
          </label>
        }
      />

      {/* Hidden input for re-uploading single asset file */}
      <input
        id="single-asset-reupload-input"
        type="file"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleReuploadFile(e.target.files[0])}
      />

      {error && <ErrorAlert message={error} />}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="mb-6 border-2 border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-900/40 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
        onClick={() => document.getElementById('asset-file-input')?.click()}
      >
        <UploadCloud className="w-8 h-8 text-emerald-400 mb-2" />
        <h4 className="text-sm font-bold text-slate-200">
          Drag & Drop Media Assets Here or Click to Browse
        </h4>
        <p className="text-xs text-slate-400 mt-1">
          Supports Images (10MB), Videos (100MB), Audio (25MB), Documents (25MB), GIFs (15MB).
        </p>
        <input
          id="asset-file-input"
          type="file"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
        />
      </div>

      {/* Filters, Search & Sort Bar */}
      <Card className="p-4 mb-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {['ALL', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'GIF'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  selectedCategory === cat
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat === 'ALL' ? 'All Assets' : cat}
              </button>
            ))}
          </div>

          {/* Search & Sort Group */}
          <div className="flex items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search asset filename..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </form>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="name">Sort: Name (A-Z)</option>
              <option value="size">Sort: Size (Largest)</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Asset Grid */}
      {loading ? (
        <SkeletonLoader count={8} type="grid" />
      ) : assets.length === 0 ? (
        <EmptyState
          icon={FolderArchive}
          title="No Media Assets Found"
          description="Upload marketing banners, videos, voice notes, PDFs, or logos into the company asset library."
          actionLabel="Upload Media Asset"
          onAction={() => document.getElementById('asset-file-input')?.click()}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((asset) => (
            <Card key={asset.id} variant="bordered" className="flex flex-col justify-between group">
              {/* Media Preview Box */}
              <div
                className="h-36 bg-slate-950 rounded-lg border border-slate-800/80 overflow-hidden flex items-center justify-center relative cursor-pointer group-hover:border-emerald-500/40 transition-colors"
                onClick={() => setPreviewAsset(asset)}
              >
                {asset.category === 'IMAGE' || asset.category === 'GIF' ? (
                  <img
                    src={`${API_BASE_URL}/api/company/assets/${asset.id}/file`}
                    alt={asset.originalFilename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : asset.category === 'VIDEO' ? (
                  <div className="flex flex-col items-center justify-center text-sky-400 gap-1">
                    <Video className="w-10 h-10" />
                    <span className="text-[10px] font-semibold text-slate-400">Click to Play Video</span>
                  </div>
                ) : asset.category === 'AUDIO' ? (
                  <div className="flex flex-col items-center justify-center text-amber-400 gap-1">
                    <Music className="w-10 h-10" />
                    <span className="text-[10px] font-semibold text-slate-400">Audio Track</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-1">
                    <FileText className="w-10 h-10" />
                    <span className="text-[10px] font-semibold">{asset.mimeType}</span>
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <Badge variant="neutral" size="sm">{asset.category}</Badge>
                </div>
              </div>

              {/* Asset Meta Details */}
              <div className="pt-3">
                <h4 className="font-semibold text-slate-100 text-xs truncate" title={asset.originalFilename}>
                  {asset.originalFilename}
                </h4>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>{formatFileSize(asset.fileSize)}</span>
                  <span>
                    {(() => {
                      const rawDate = asset.uploadedAt || (asset as any).createdAt;
                      const parsed = rawDate ? new Date(rawDate) : null;
                      return parsed && !isNaN(parsed.getTime()) ? parsed.toLocaleDateString() : 'Recently';
                    })()}
                  </span>
                </div>
              </div>

              {/* Asset Actions */}
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-800/80">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewAsset(asset)}
                  leftIcon={<Eye className="w-3.5 h-3.5" />}
                >
                  Preview
                </Button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setReuploadTarget(asset);
                      document.getElementById('single-asset-reupload-input')?.click();
                    }}
                    className="p-1.5 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-800"
                    title="Re-upload file to server"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href={`${API_BASE_URL}/api/company/assets/${asset.id}/download`}
                    download={asset.originalFilename}
                    className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                    title="Download asset"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => {
                      setRenameAsset(asset);
                      setNewFilename(asset.originalFilename);
                    }}
                    className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                    title="Rename asset"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(asset)}
                    className="p-1.5 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800"
                    title="Delete asset"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* MEDIA PREVIEW MODAL */}
      {previewAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                {getCategoryIcon(previewAsset.category)}
                <div>
                  <h3 className="font-bold text-white text-sm">{previewAsset.originalFilename}</h3>
                  <span className="text-[11px] text-slate-400">{formatFileSize(previewAsset.fileSize)} • {previewAsset.mimeType}</span>
                </div>
              </div>
              <button onClick={() => setPreviewAsset(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-slate-950 flex items-center justify-center min-h-[300px]">
              {previewAsset.category === 'IMAGE' || previewAsset.category === 'GIF' ? (
                <img
                  src={`${API_BASE_URL}/api/company/assets/${previewAsset.id}/file`}
                  alt={previewAsset.originalFilename}
                  className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-xl"
                />
              ) : previewAsset.category === 'VIDEO' ? (
                <video
                  controls
                  autoPlay
                  className="max-h-[60vh] max-w-full rounded-lg shadow-xl"
                  src={`${API_BASE_URL}/api/company/assets/${previewAsset.id}/file`}
                >
                  Your browser does not support HTML5 video playback.
                </video>
              ) : previewAsset.category === 'AUDIO' ? (
                <div className="w-full max-w-md p-6 bg-slate-900 rounded-xl border border-slate-800 text-center space-y-4">
                  <Music className="w-12 h-12 text-amber-400 mx-auto" />
                  <audio controls className="w-full" src={`${API_BASE_URL}/api/company/assets/${previewAsset.id}/file`}>
                    Your browser does not support HTML5 audio.
                  </audio>
                </div>
              ) : (
                <div className="text-center p-8 space-y-3">
                  <FileText className="w-16 h-16 text-slate-500 mx-auto" />
                  <p className="text-sm text-slate-300 font-medium">Document File Preview</p>
                  <a
                    href={`${API_BASE_URL}/api/company/assets/${previewAsset.id}/download`}
                    download={previewAsset.originalFilename}
                  >
                    <Button variant="primary" size="sm" leftIcon={<Download className="w-4 h-4" />}>
                      Download Document
                    </Button>
                  </a>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-mono">Asset ID: {previewAsset.id}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReuploadTarget(previewAsset);
                    document.getElementById('single-asset-reupload-input')?.click();
                  }}
                  leftIcon={<UploadCloud className="w-4 h-4" />}
                >
                  Re-upload File
                </Button>
                <a href={`${API_BASE_URL}/api/company/assets/${previewAsset.id}/download`} download={previewAsset.originalFilename}>
                  <Button variant="outline" size="sm" leftIcon={<Download className="w-4 h-4" />}>
                    Download Asset
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {renameAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Rename Asset</h3>
              <button onClick={() => setRenameAsset(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenameSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">New Filename</label>
                <input
                  type="text"
                  value={newFilename}
                  onChange={(e) => setNewFilename(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setRenameAsset(null)} disabled={isRenaming}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isRenaming}>
                  Save Filename
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-white text-base">Confirm Asset Deletion</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">"{deleteTarget.originalFilename}"</strong>? This will permanently remove the physical file from server storage.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={handleDeleteConfirm} isLoading={isDeleting}>
                {isDeleting ? 'Deleting Asset...' : 'Delete Asset'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

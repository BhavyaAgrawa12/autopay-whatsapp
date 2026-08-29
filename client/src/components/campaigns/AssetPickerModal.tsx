import React, { useEffect, useState, useRef } from 'react';
import {
  FolderArchive,
  Image as ImageIcon,
  Video,
  FileText,
  UploadCloud,
  X,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { CompanyAssetRecord } from '../../types/company';
import { API_BASE_URL } from '../../api/config';
import { fetchAssetsApi, uploadAssetApi } from '../../api/assets';

interface AssetPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  headerFormat: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  onSelectAsset: (asset: CompanyAssetRecord) => void;
}

const DISALLOWED_EXTENSIONS = new Set([
  '.exe', '.sh', '.bat', '.cmd', '.js', '.py', '.php', '.pl', '.vbs', '.jar', '.com',
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif']);

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({
  isOpen,
  onClose,
  headerFormat,
  onSelectAsset,
}) => {
  const [assets, setAssets] = useState<CompanyAssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      let cat = 'IMAGE';
      if (headerFormat === 'VIDEO') cat = 'VIDEO';
      if (headerFormat === 'DOCUMENT') cat = 'DOCUMENT';

      const data = await fetchAssetsApi({ category: cat });
      setAssets(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch company assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAssets();
    }
  }, [isOpen, headerFormat]);

  if (!isOpen) return null;

  const handleUploadNew = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setError(null);

    // Client-side validation
    const filename = file.name.toLowerCase();
    const ext = filename.substring(filename.lastIndexOf('.'));

    if (DISALLOWED_EXTENSIONS.has(ext)) {
      setError(`Dangerous executable file extension '${ext}' is strictly prohibited.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (headerFormat === 'IMAGE') {
      if (!ALLOWED_IMAGE_EXTENSIONS.has(ext) && !file.type.startsWith('image/')) {
        setError(`Please select a valid image file (.jpg, .jpeg, .png, .webp, .svg, .gif).`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(`Image file size must not exceed 10 MB.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setIsUploading(true);

    try {
      const uploaded = await uploadAssetApi(file);
      // Refresh asset library list
      await loadAssets();
      // Auto-select newly uploaded asset
      onSelectAsset(uploaded);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to upload new asset.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getFormatIcon = () => {
    if (headerFormat === 'IMAGE') return <ImageIcon className="w-5 h-5 text-emerald-400" />;
    if (headerFormat === 'VIDEO') return <Video className="w-5 h-5 text-sky-400" />;
    return <FileText className="w-5 h-5 text-amber-400" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-800 border border-slate-700">
              {getFormatIcon()}
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Select {headerFormat} Asset</h3>
              <p className="text-xs text-slate-400">Choose a compatible media asset from Phase 4 Asset Library</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Badge variant="info">Category: {headerFormat}</Badge>

            <div>
              <Button
                variant="outline"
                size="sm"
                isLoading={isUploading}
                leftIcon={<UploadCloud className="w-4 h-4" />}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? `Uploading ${headerFormat}...` : `Upload New ${headerFormat}`}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={
                  headerFormat === 'IMAGE'
                    ? 'image/*'
                    : headerFormat === 'VIDEO'
                    ? 'video/*'
                    : 'application/pdf,.doc,.docx'
                }
                className="hidden"
                onChange={handleUploadNew}
              />
            </div>
          </div>

          {loading ? (
            <LoadingSpinner label={`Loading compatible ${headerFormat} assets...`} />
          ) : assets.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-dashed border-slate-800">
              <FolderArchive className="w-10 h-10 text-slate-500 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-slate-200">No Compatible {headerFormat} Assets Available</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Upload a new {headerFormat.toLowerCase()} asset above or add media to Company Assets.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => {
                    onSelectAsset(asset);
                    onClose();
                  }}
                  className="bg-slate-950 border border-slate-800 hover:border-emerald-500 rounded-xl p-3 cursor-pointer group transition-all"
                >
                  <div className="h-28 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center mb-2 border border-slate-800">
                    {asset.category === 'IMAGE' || asset.category === 'GIF' ? (
                      <img
                        src={`${API_BASE_URL}/api/company/assets/${asset.id}/file`}
                        alt={asset.originalFilename}
                        className="w-full h-full object-cover"
                      />
                    ) : asset.category === 'VIDEO' ? (
                      <Video className="w-8 h-8 text-sky-400" />
                    ) : (
                      <FileText className="w-8 h-8 text-amber-400" />
                    )}
                  </div>
                  <h5 className="font-semibold text-xs text-slate-100 truncate group-hover:text-emerald-400 transition-colors">
                    {asset.originalFilename}
                  </h5>
                  <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                    {(asset.fileSize / 1024).toFixed(1)} KB
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

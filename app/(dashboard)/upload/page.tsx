'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PRODUCT_TYPES } from '@/types/poster';

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [productType, setProductType] = useState('');
  const [initialInformation, setInitialInformation] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Handle clipboard paste
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            // Create a File object from the blob with a default name
            const pastedFile = new File([blob], `pasted-image-${Date.now()}.png`, {
              type: blob.type,
            });
            handleFile(pastedFile);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setError('Please select a JPG or PNG image file.');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      return;
    }

    setError('');
    setFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first.');
      return;
    }

    if (!productType) {
      setError('Please select a product type.');
      return;
    }

    try {
      setUploading(true);
      setError('');

      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('productType', productType);
      if (initialInformation.trim()) {
        formData.append('initialInformation', initialInformation.trim());
      }

      // Upload file
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        const errorMsg = errorData.details
          ? `${errorData.error}: ${errorData.details}`
          : errorData.error || 'Upload failed';
        throw new Error(errorMsg);
      }

      const uploadData = await uploadRes.json();
      const posterId = uploadData.posterId;

      // Trigger analysis
      setUploading(false);
      setAnalyzing(true);

      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posterId }),
      });

      if (!analyzeRes.ok) {
        const errorData = await analyzeRes.json();
        console.error('Analysis failed:', errorData);
        // Still redirect even if analysis fails - user can retry from detail page
      }

      // Redirect to poster detail page
      router.push(`/poster/${posterId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    setProductType('');
    setInitialInformation('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-900 mb-6">
        Upload New Poster
      </h1>

      <div className="bg-white rounded-lg shadow p-6">
        {!file ? (
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 hover:border-slate-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="text-6xl mb-4">📤</div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Drop, paste, or browse for your poster image
            </h3>
            <p className="text-slate-600 mb-4 text-sm">
              Drag & drop, Ctrl+V to paste, or click below
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              onChange={handleFileInput}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition"
            >
              Browse Files
            </button>
            <p className="text-sm text-slate-500 mt-4">
              Accepted formats: JPG, PNG (Max 10MB)
            </p>
          </div>
        ) : (
          <div>
            {/* Preview */}
            <div className="mb-6">
              <div className="flex items-start gap-4">
                <div className="w-64 h-80 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={preview!}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 mb-2">
                    {file.name}
                  </h3>
                  <p className="text-sm text-slate-600 mb-4">
                    Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    onClick={resetForm}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove & Select Different File
                  </button>
                </div>
              </div>
            </div>

            {/* Product Type */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Product Type <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-slate-600 mb-3">
                Select the type of item you're uploading. This helps guide the analysis and ensures accurate descriptions.
              </p>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              >
                <option value="">-- Select Product Type --</option>
                {PRODUCT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Initial Information */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Initial Information (Optional)
              </label>
              <p className="text-sm text-slate-600 mb-3">
                Provide any known details about this poster (auction descriptions, artist
                attribution, provenance notes, etc.). Claude will validate and enhance this
                information.
              </p>
              <textarea
                value={initialInformation}
                onChange={(e) => setInitialInformation(e.target.value)}
                placeholder="Example: French Art Nouveau poster, circa 1890s, attributed to Alphonse Mucha. From estate sale. Shows woman with flowing hair and flowers..."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                rows={6}
              />
            </div>

            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Upload Button */}
            <div className="flex gap-4">
              <button
                onClick={handleUpload}
                disabled={uploading || analyzing}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading
                  ? 'Uploading...'
                  : analyzing
                  ? 'Analyzing with Claude AI...'
                  : 'Upload & Analyze'}
              </button>
              <button
                onClick={resetForm}
                disabled={uploading || analyzing}
                className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            {(uploading || analyzing) && (
              <div className="mt-6 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                <p className="text-sm text-slate-600">
                  {uploading
                    ? 'Uploading your poster...'
                    : 'Claude is analyzing your poster. This may take 30-60 seconds...'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Pro Tips</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>You can paste images directly from your clipboard (Ctrl+V or Cmd+V)</li>
          <li>The more initial information you provide, the better Claude can validate and enhance your poster details</li>
        </ul>
      </div>
    </div>
  );
}

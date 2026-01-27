'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PRODUCT_TYPES } from '@/types/poster';

interface SupplementalFile {
  file: File;
  preview: string;
  description: string;
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supplementalInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [productType, setProductType] = useState('');
  const [initialInformation, setInitialInformation] = useState('');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState('');
  const [supplementalFiles, setSupplementalFiles] = useState<SupplementalFile[]>([]);
  const [showSupplementalSection, setShowSupplementalSection] = useState(false);

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

  /**
   * Compress image if it exceeds 5MB while maintaining quality for detail analysis
   * Uses high quality settings (0.95) to preserve small text and printer marks
   * Target is 4.95MB to stay just under the 5MB API limit
   */
  const compressImage = async (file: File, targetSizeMB: number = 4.95): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Keep original dimensions to preserve detail
          canvas.width = img.width;
          canvas.height = img.height;

          // Use high quality settings
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0);

          // Start with very high quality (95%) and reduce in small steps
          let quality = 0.95;
          const targetBytes = targetSizeMB * 1024 * 1024;
          const minQuality = 0.75; // Never go below 75% quality

          const tryCompress = () => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Compression failed'));
                  return;
                }

                // If still too large and we can reduce quality more, try again
                // Use smaller steps (2%) to find optimal quality
                if (blob.size > targetBytes && quality > minQuality) {
                  quality -= 0.02;
                  tryCompress();
                  return;
                }

                // Create compressed file
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });

                const originalSizeMB = (file.size / 1024 / 1024).toFixed(2);
                const compressedSizeMB = (compressedFile.size / 1024 / 1024).toFixed(2);
                setCompressionInfo(
                  `Compressed from ${originalSizeMB}MB to ${compressedSizeMB}MB (quality: ${Math.round(quality * 100)}%)`
                );

                resolve(compressedFile);
              },
              'image/jpeg',
              quality
            );
          };

          tryCompress();
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFile = async (selectedFile: File) => {
    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(selectedFile.type)) {
      setError('Please select a JPG or PNG image file.');
      return;
    }

    // Allow larger files initially (we'll compress them)
    if (selectedFile.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB.');
      return;
    }

    setError('');
    setCompressionInfo('');

    try {
      let processedFile = selectedFile;

      // Compress if over 5MB to meet Claude API requirements
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (selectedFile.size > maxSize) {
        setCompressing(true);
        const sizeMB = (selectedFile.size / 1024 / 1024).toFixed(2);
        setCompressionInfo(`Compressing ${sizeMB}MB image to preserve quality while meeting API requirements...`);

        try {
          processedFile = await compressImage(selectedFile);
        } catch (err) {
          setError('Failed to compress image. Please try a smaller file.');
          setCompressing(false);
          return;
        }

        setCompressing(false);
      }

      setFile(processedFile);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(processedFile);
    } catch (err) {
      setError('Failed to process image.');
      setCompressing(false);
    }
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

      // Upload supplemental images if any
      if (supplementalFiles.length > 0) {
        for (const suppFile of supplementalFiles) {
          const suppFormData = new FormData();
          suppFormData.append('file', suppFile.file);
          if (suppFile.description) {
            suppFormData.append('description', suppFile.description);
          }

          try {
            await fetch(`/api/posters/${posterId}/supplemental-image`, {
              method: 'POST',
              body: suppFormData,
            });
          } catch (err) {
            console.error('Failed to upload supplemental image:', err);
            // Continue with analysis even if supplemental upload fails
          }
        }
      }

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
    setSupplementalFiles([]);
    setShowSupplementalSection(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSupplementalFile = async (selectedFile: File) => {
    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(selectedFile.type)) {
      setError('Please select a JPG or PNG image file.');
      return;
    }

    // Check limit
    if (supplementalFiles.length >= 5) {
      setError('Maximum of 5 supplemental images allowed.');
      return;
    }

    setError('');

    try {
      let processedFile = selectedFile;

      // Compress if over 5MB
      const maxSize = 5 * 1024 * 1024;
      if (selectedFile.size > maxSize) {
        setCompressing(true);
        try {
          processedFile = await compressImage(selectedFile);
        } catch (err) {
          setError('Failed to compress supplemental image.');
          setCompressing(false);
          return;
        }
        setCompressing(false);
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setSupplementalFiles(prev => [...prev, {
          file: processedFile,
          preview: reader.result as string,
          description: '',
        }]);
      };
      reader.readAsDataURL(processedFile);
    } catch (err) {
      setError('Failed to process supplemental image.');
    }
  };

  const removeSupplementalFile = (index: number) => {
    setSupplementalFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateSupplementalDescription = (index: number, description: string) => {
    setSupplementalFiles(prev => prev.map((item, i) =>
      i === index ? { ...item, description } : item
    ));
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
              Accepted formats: JPG, PNG (Max 20MB - automatically compressed if needed)
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
                  <p className="text-sm text-slate-600 mb-2">
                    Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {compressionInfo && (
                    <p className="text-sm text-green-600 mb-3 bg-green-50 p-2 rounded">
                      ✓ {compressionInfo}
                    </p>
                  )}
                  {compressing && (
                    <p className="text-sm text-blue-600 mb-3 bg-blue-50 p-2 rounded animate-pulse">
                      ⏳ Compressing image...
                    </p>
                  )}
                  <button
                    onClick={resetForm}
                    className="text-sm text-red-600 hover:text-red-700"
                    disabled={compressing}
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

            {/* Supplemental Images */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700">
                  Supplemental Images (Optional)
                </label>
                {!showSupplementalSection && (
                  <button
                    type="button"
                    onClick={() => setShowSupplementalSection(true)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Add reference photos
                  </button>
                )}
              </div>

              {showSupplementalSection && (
                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <p className="text-sm text-slate-600 mb-3">
                    Add up to 5 additional photos to help with analysis (back of item, close-ups of signatures,
                    condition details, original publication, etc.)
                  </p>

                  {/* Existing supplemental images */}
                  {supplementalFiles.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                      {supplementalFiles.map((item, idx) => (
                        <div key={idx} className="relative">
                          <img
                            src={item.preview}
                            alt={`Supplemental ${idx + 1}`}
                            className="w-full h-24 object-cover rounded border border-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeSupplementalFile(idx)}
                            className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 text-xs"
                            title="Remove"
                          >
                            ×
                          </button>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateSupplementalDescription(idx, e.target.value)}
                            placeholder="What's in this image?"
                            className="w-full mt-1 px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add more supplemental images */}
                  {supplementalFiles.length < 5 && (
                    <label className="block w-full px-3 py-3 text-sm text-center border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                      <input
                        ref={supplementalInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={(e) => {
                          const selectedFile = e.target.files?.[0];
                          if (selectedFile) {
                            handleSupplementalFile(selectedFile);
                            e.target.value = '';
                          }
                        }}
                        className="hidden"
                      />
                      + Add supplemental image ({supplementalFiles.length}/5)
                    </label>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowSupplementalSection(false);
                      setSupplementalFiles([]);
                    }}
                    className="mt-3 text-xs text-slate-500 hover:text-slate-700"
                  >
                    Cancel & remove all supplemental images
                  </button>
                </div>
              )}
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
                disabled={uploading || analyzing || compressing}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {compressing
                  ? 'Compressing Image...'
                  : uploading
                  ? 'Uploading...'
                  : analyzing
                  ? 'Analyzing with Claude AI...'
                  : 'Upload & Analyze'}
              </button>
              <button
                onClick={resetForm}
                disabled={uploading || analyzing || compressing}
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

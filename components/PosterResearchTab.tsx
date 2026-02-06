'use client';

import { useState } from 'react';
import { Poster } from '@/types/poster';
import ImagePreview from '@/components/ImagePreview';
import ProductDescriptionEditor from '@/components/ProductDescriptionEditor';
import { formatDate } from '@/lib/utils';

interface PosterResearchTabProps {
  poster: Poster;
  onUpdate: () => void;
  // Pass through handlers from parent
  onTriggerAnalysis: (forceReanalyze: boolean, context: string, skepticalMode: boolean) => void;
  analyzing: boolean;
  // Additional state that parent manages
  linkedArtist: any;
  linkedPrinter: any;
  linkedPublisher: any;
  linkedBook: any;
}

// Helper functions for Wikipedia links
function getPrintingWikiUrl(technique: string): string {
  const lowerTechnique = technique.toLowerCase();
  const wikiMap: [string, string][] = [
    ['offset lithograph', 'Offset_printing'],
    ['offset litho', 'Offset_printing'],
    ['chromolithograph', 'Chromolithography'],
    ['lithograph', 'Lithography'],
    ['steel engraving', 'Steel_engraving'],
    ['wood engraving', 'Wood_engraving'],
    ['engraving', 'Engraving'],
    ['etching', 'Etching'],
    ['woodcut', 'Woodcut'],
    ['screenprint', 'Screen_printing'],
    ['silkscreen', 'Screen_printing'],
    ['letterpress', 'Letterpress_printing'],
  ];
  for (const [key, wiki] of wikiMap) {
    if (lowerTechnique.includes(key)) {
      return `https://en.wikipedia.org/wiki/${wiki}`;
    }
  }
  return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(technique)} printmaking`;
}

export default function PosterResearchTab({
  poster,
  onUpdate,
  onTriggerAnalysis,
  analyzing,
  linkedArtist,
  linkedPrinter,
  linkedPublisher,
  linkedBook,
}: PosterResearchTabProps) {
  const [showVerificationDetails, setShowVerificationDetails] = useState(false);
  const [showPrinterVerificationDetails, setShowPrinterVerificationDetails] = useState(false);

  return (
    <div className="space-y-6">
      {/* Hero Image */}
      <div className="bg-white rounded-lg shadow p-4">
        <ImagePreview
          src={poster.imageUrl}
          alt={poster.title || poster.fileName}
          className="w-full h-auto max-h-[600px] object-contain bg-slate-100 rounded-lg"
        />
        <div className="mt-4 text-sm text-slate-600">
          {poster.productType && (
            <div className="mb-3">
              <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                {poster.productType}
              </span>
            </div>
          )}
          <p><strong>Uploaded:</strong> {formatDate(poster.uploadDate)}</p>
          <p><strong>File:</strong> {poster.fileName}</p>
        </div>
      </div>

      {/* Initial Information Provided */}
      {(poster.title || poster.condition || poster.userNotes) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Initial Information</h3>
          <div className="space-y-3 text-sm">
            {poster.title && (
              <div>
                <span className="font-medium text-slate-700">Title:</span>
                <span className="ml-2 text-slate-900">{poster.title}</span>
              </div>
            )}
            {poster.condition && (
              <div>
                <span className="font-medium text-slate-700">Condition:</span>
                <span className="ml-2 text-slate-900">{poster.condition}</span>
              </div>
            )}
            {poster.conditionDetails && (
              <div>
                <span className="font-medium text-slate-700">Condition Details:</span>
                <p className="text-slate-600 mt-1 whitespace-pre-wrap">{poster.conditionDetails}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation Results */}
      {poster.analysisCompleted && poster.rawAiResponse?.validation && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Validation Results</h3>
          <div className="space-y-4">
            {/* AI Analysis */}
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <h4 className="font-semibold text-amber-900 mb-2">AI Analysis</h4>
              <p className="text-sm text-amber-800">
                Analysis completed with Claude claude-opus-4-5-20251101.
                Confidence level: {poster.artistConfidenceScore || 'N/A'}%
              </p>
            </div>

            {/* Source Data Validation */}
            {poster.rawAiResponse?.validation?.sourceDataValidation && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">Source Data Validation</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  {poster.rawAiResponse.validation.sourceDataValidation.confirmedClaims?.map((claim: string, i: number) => (
                    <p key={i} className="flex items-start gap-2">
                      <span className="text-green-600">✓</span>
                      <span>{claim}</span>
                    </p>
                  ))}
                  {poster.rawAiResponse.validation.sourceDataValidation.contradictedClaims?.map((claim: string, i: number) => (
                    <p key={i} className="flex items-start gap-2">
                      <span className="text-red-500">✗</span>
                      <span>{claim}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Identification */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold text-slate-900 mb-4">Identification</h3>
        <div className="space-y-4">
          {/* Product Type */}
          {poster.productType && (
            <div className="border-b border-slate-100 pb-3">
              <label className="text-sm font-medium text-slate-700">Product Type</label>
              <p className="text-slate-900">{poster.productType}</p>
            </div>
          )}

          {/* Artist */}
          <div className="border-b border-slate-100 pb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700">Artist</label>
              {poster.artistConfidence && (
                <button
                  onClick={() => setShowVerificationDetails(!showVerificationDetails)}
                  className={`text-xs px-2 py-0.5 rounded cursor-pointer hover:opacity-80 transition flex items-center gap-1 ${
                    poster.artistConfidence === 'confirmed' ? 'bg-green-100 text-green-800' :
                    poster.artistConfidence === 'likely' ? 'bg-blue-100 text-blue-800' :
                    poster.artistConfidence === 'uncertain' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}
                >
                  {poster.artistConfidence}
                  {poster.artistConfidenceScore && (
                    <span className="opacity-70">({poster.artistConfidenceScore}%)</span>
                  )}
                </button>
              )}
            </div>
            <p className="text-slate-900 font-medium">{poster.artist || 'Unknown'}</p>
            {poster.artistSource && (
              <p className="text-xs text-slate-500 mt-1">Source: {poster.artistSource}</p>
            )}

            {/* Attribution Basis */}
            {showVerificationDetails && poster.attributionBasis && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm">
                <span className="text-xs font-medium text-slate-500">Attribution Basis: </span>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  poster.attributionBasis === 'visible_signature' ? 'bg-green-100 text-green-800' :
                  poster.attributionBasis === 'printed_credit' ? 'bg-green-100 text-green-800' :
                  poster.attributionBasis === 'external_knowledge' ? 'bg-blue-100 text-blue-800' :
                  poster.attributionBasis === 'stylistic_analysis' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {poster.attributionBasis === 'visible_signature' ? '✍️ Visible Signature' :
                   poster.attributionBasis === 'printed_credit' ? '📝 Printed Credit' :
                   poster.attributionBasis === 'external_knowledge' ? '📚 External Knowledge' :
                   poster.attributionBasis === 'stylistic_analysis' ? '🎨 Stylistic Analysis' :
                   poster.attributionBasis}
                </span>
              </div>
            )}

            {/* Linked Artist */}
            {linkedArtist && (
              <div className="mt-2 p-2 bg-green-50 rounded border border-green-200">
                <a
                  href={linkedArtist.wikipediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-green-700 hover:underline"
                >
                  View on Wikipedia →
                </a>
              </div>
            )}
          </div>

          {/* Date */}
          {poster.estimatedDate && (
            <div className="border-b border-slate-100 pb-3">
              <label className="text-sm font-medium text-slate-700">Date</label>
              <p className="text-slate-900">{poster.estimatedDate}</p>
            </div>
          )}

          {/* Dimensions */}
          {poster.dimensionsEstimate && (
            <div className="border-b border-slate-100 pb-3">
              <label className="text-sm font-medium text-slate-700">Dimensions (Estimated)</label>
              <p className="text-slate-900">{poster.dimensionsEstimate}</p>
            </div>
          )}

          {/* Printing Technique */}
          {poster.printingTechnique && (
            <div className="border-b border-slate-100 pb-3">
              <label className="text-sm font-medium text-slate-700">Printing Technique</label>
              <a
                href={getPrintingWikiUrl(poster.printingTechnique)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-900 hover:text-blue-600 hover:underline block"
              >
                {poster.printingTechnique}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Product Descriptions */}
      <ProductDescriptionEditor poster={poster} onUpdate={onUpdate} />

      {/* Source Citations */}
      {poster.sourceCitations && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Source Citations</h3>
          <div className="prose prose-sm max-w-none text-slate-700">
            {typeof poster.sourceCitations === 'string'
              ? <p className="whitespace-pre-wrap">{poster.sourceCitations}</p>
              : <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto">{JSON.stringify(poster.sourceCitations, null, 2)}</pre>
            }
          </div>
        </div>
      )}

      {/* Printing Information */}
      {(linkedPrinter || linkedPublisher || linkedBook || poster.rawAiResponse?.printingInfo) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Printing Information</h3>
          <div className="space-y-4">
            {linkedPrinter && (
              <div className="border-b border-slate-100 pb-3">
                <label className="text-sm font-medium text-slate-700">Printer</label>
                <p className="text-slate-900">{linkedPrinter.name}</p>
                {linkedPrinter.wikipediaUrl && (
                  <a href={linkedPrinter.wikipediaUrl} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-blue-600 hover:underline">
                    Wikipedia →
                  </a>
                )}
              </div>
            )}
            {linkedPublisher && (
              <div className="border-b border-slate-100 pb-3">
                <label className="text-sm font-medium text-slate-700">Publisher</label>
                <p className="text-slate-900">{linkedPublisher.name}</p>
              </div>
            )}
            {linkedBook && (
              <div className="border-b border-slate-100 pb-3">
                <label className="text-sm font-medium text-slate-700">Source Publication</label>
                <p className="text-slate-900">{linkedBook.title}</p>
                {linkedBook.author && <p className="text-xs text-slate-500">by {linkedBook.author}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Talking Points */}
      {poster.rawAiResponse?.talkingPoints && poster.rawAiResponse.talkingPoints.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Talking Points</h3>
          <ul className="space-y-2">
            {poster.rawAiResponse.talkingPoints.map((point: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-slate-700">
                <span className="text-amber-500">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Colors */}
      {poster.colors && poster.colors.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Colors</h3>
          <div className="flex flex-wrap gap-2">
            {poster.colors.map((color, idx) => (
              <span key={idx} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
                {color}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notable Figures */}
      {poster.rawAiResponse?.notableFigures && poster.rawAiResponse.notableFigures.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Notable Figures</h3>
          <div className="space-y-2">
            {poster.rawAiResponse.notableFigures.map((figure: any, idx: number) => (
              <div key={idx} className="border-b border-slate-100 pb-2 last:border-0">
                <p className="font-medium text-slate-900">{figure.name}</p>
                {figure.role && <p className="text-sm text-slate-500">{figure.role}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Design Profile */}
      {poster.rawAiResponse?.designProfile && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Design Profile</h3>
          <p className="text-slate-700 whitespace-pre-wrap">{poster.rawAiResponse.designProfile}</p>
        </div>
      )}

      {/* Time & Place */}
      {poster.rawAiResponse?.historicalContext && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Time & Place</h3>
          <div className="prose prose-sm max-w-none text-slate-700">
            {poster.rawAiResponse.historicalContext.period && (
              <p><strong>Period:</strong> {poster.rawAiResponse.historicalContext.period}</p>
            )}
            {poster.rawAiResponse.historicalContext.location && (
              <p><strong>Location:</strong> {poster.rawAiResponse.historicalContext.location}</p>
            )}
            {poster.rawAiResponse.historicalContext.context && (
              <p className="whitespace-pre-wrap">{poster.rawAiResponse.historicalContext.context}</p>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {(poster.userNotes || poster.itemNotes) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-slate-900 mb-4">Notes</h3>
          {poster.itemNotes && (
            <div className="mb-4">
              <label className="text-sm font-medium text-slate-700 block mb-1">Research Notes</label>
              <p className="text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded">{poster.itemNotes}</p>
            </div>
          )}
          {poster.userNotes && (
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Internal Notes</label>
              <p className="text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded">{poster.userNotes}</p>
            </div>
          )}
        </div>
      )}

      {/* Re-Analyze Button */}
      <div className="bg-white rounded-lg shadow p-6">
        <button
          onClick={() => onTriggerAnalysis(true, '', false)}
          disabled={analyzing}
          className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition disabled:opacity-50"
        >
          {analyzing ? 'Re-analyzing...' : 'Re-Analyze'}
        </button>
        <p className="text-xs text-slate-500 mt-2 text-center">
          Re-run AI analysis on this poster's image
        </p>
      </div>
    </div>
  );
}

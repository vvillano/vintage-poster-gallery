// Core Poster type matching database schema
export interface Poster {
  id: number;
  imageUrl: string;
  imageBlobId: string;
  fileName: string;
  fileSize: number;
  uploadDate: Date;
  uploadedBy: string;

  // Initial information provided at upload (optional)
  initialInformation?: string | null;

  // AI Analysis Results
  artist?: string | null;
  title?: string | null;
  estimatedDate?: string | null;
  dimensionsEstimate?: string | null;
  historicalContext?: string | null;
  significance?: string | null;
  printingTechnique?: string | null;
  rarityAnalysis?: string | null;
  valueInsights?: string | null;
  validationNotes?: string | null;  // AI notes on validating initial information

  // Metadata
  analysisCompleted: boolean;
  analysisDate?: Date | null;
  rawAiResponse?: any | null;
  userNotes?: string | null;
  lastModified: Date;
}

// Structured analysis response from Claude
export interface PosterAnalysis {
  identification: {
    artist: string;
    title: string;
    estimatedDate: string;
    estimatedDimensions: string;
  };
  historicalContext: {
    periodMovement: string;
    culturalSignificance: string;
    originalPurpose: string;
  };
  technicalAnalysis: {
    printingTechnique: string;
    colorPalette: string;
    typography: string;
    composition: string;
  };
  conditionAuthenticity: {
    ageIndicators: string[];
    conditionIssues: string[];
  };
  rarityValue: {
    rarityAssessment: string;
    valueFactors: string[];
    comparableExamples: string;
    collectorInterest: string;
  };
  validationNotes?: string;  // Present when initial information was provided
}

// Request/Response types for API routes
export interface AnalysisRequest {
  posterId: number;
  imageUrl: string;
  initialInformation?: string;
}

export interface AnalysisResponse {
  success: boolean;
  posterId: number;
  analysis?: PosterAnalysis;
  error?: string;
}

export interface UploadRequest {
  file: File;
  initialInformation?: string;
}

export interface UploadResponse {
  success: boolean;
  posterId?: number;
  imageUrl?: string;
  error?: string;
}

// For creating/updating posters
export interface CreatePosterInput {
  imageUrl: string;
  imageBlobId: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  initialInformation?: string;
}

export interface UpdatePosterInput {
  artist?: string;
  title?: string;
  estimatedDate?: string;
  dimensionsEstimate?: string;
  historicalContext?: string;
  significance?: string;
  printingTechnique?: string;
  rarityAnalysis?: string;
  valueInsights?: string;
  validationNotes?: string;
  userNotes?: string;
}

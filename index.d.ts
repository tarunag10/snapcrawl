export interface SnapcrawlCiOptions {
  config?: string;
  baseline?: string;
  dir?: string;
  threshold?: number;
  updateBaseline?: boolean;
  skipCapture?: boolean;
}

export interface SnapcrawlCapture {
  file: string;
  url?: string;
  name?: string;
  size?: string;
  viewport?: {
    name?: string;
    width?: number;
    height?: number;
    fullPage?: boolean;
  };
}

export interface SnapcrawlFinding {
  file?: string;
  url?: string;
  severity: 'low' | 'medium' | 'high';
  category: 'layout' | 'mobile' | 'contrast' | 'content' | 'interaction' | 'accessibility' | 'performance';
  title: string;
  description: string;
  recommendation?: string;
  ownerHint?: string;
}

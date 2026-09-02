export interface AIToolOutputSettings {
  duration?: number;
  ratio?: string;
  size?: string;
  volume?: number;
  timestamp: string;
}

export interface AIToolOutputData {
  projectName?: string;
  settings?: AIToolOutputSettings;
  asset?: unknown;
  [key: string]: unknown;
}

export interface AIAsset {
  id: string;
  tool_name: string;
  output_data: AIToolOutputData;
  created_at: string;
  user_id?: string;
}

export interface MediaAsset {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  asset_type: string;
  created_at: string;
  user_id?: string;
  team_id?: string | null;
  file_size?: number;
  title?: string;
}

export type Asset = AIAsset | MediaAsset;

export function isMediaAsset(asset: Asset): asset is MediaAsset {
  return 'file_name' in asset;
}

export function isAIAsset(asset: Asset): asset is AIAsset {
  return 'tool_name' in asset;
}

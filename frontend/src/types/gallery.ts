// Gallery item from API
export interface GalleryItem {
  id: string;
  name: string;
  image_url: string;
  thumb_url?: string;
  model_url: string;
  spz_url?: string | null;
  size?: number;
  spz_size?: number | null;
  created_at?: string;
}

// Model format preference
export type ModelFormat = 'ply' | 'spz';

// API response for gallery list
export interface GalleryListResponse {
  items: GalleryItem[];
}

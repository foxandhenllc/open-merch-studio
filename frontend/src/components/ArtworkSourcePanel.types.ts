import type { RefObject } from 'react';
import type { DesignDraft } from '../types/catalog';
import type { CreationPath, SurfaceError } from '../studio-view-model.types';

export type ArtworkPlacement = {
  displayName: string;
};

export type ArtworkSourcePanelProps = {
  productTitle: string;
  variantName: string;
  activePlacement?: ArtworkPlacement;
  creationPath: CreationPath;
  uploadFile: File | null;
  uploadPreview: string | null;
  uploadRightsConfirmed: boolean;
  removeUploadBackground: boolean;
  referenceAssets: DesignDraft[];
  referenceRightsConfirmed: boolean;
  prompt: string;
  promptBlocked: boolean;
  generating: boolean;
  error?: SurfaceError;
  promptRef: RefObject<HTMLTextAreaElement>;
  onShowConfigure: () => void;
  onCreationPathChange: (path: CreationPath) => void;
  onUploadFileChange: (file: File | null) => void;
  onUploadRightsChange: (confirmed: boolean) => void;
  onRemoveUploadBackgroundChange: (remove: boolean) => void;
  onReferenceRightsChange: (confirmed: boolean) => void;
  onAddReferenceImages: (files: File[]) => void;
  onRemoveReferenceAsset: (id: string) => void;
  onPromptChange: (prompt: string) => void;
  onSubmit: () => void;
};

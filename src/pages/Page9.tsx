import AIToolsHub from '../components/AIToolsHub';
import { getToolsForPage } from '../data/aiTools';

interface PageProps {
  onNavigate: (page: number) => void;
  onOpenAssetPage: (toolName: string, mode: 'upload' | 'create') => void;
}

export default function Page9({ onNavigate, onOpenAssetPage }: PageProps) {
  return (
    <AIToolsHub
      tools={getToolsForPage(9)}
      pageNumber={9}
      onNavigate={onNavigate}
      onOpenAssetPage={onOpenAssetPage}
    />
  );
}

import AIToolsHub from '../components/AIToolsHub';
import { getToolsForPage } from '../data/aiTools';

interface PageProps {
  onNavigate: (page: number) => void;
  onOpenAssetPage: (toolName: string, mode: 'upload' | 'create') => void;
}

export default function Page8({ onNavigate, onOpenAssetPage }: PageProps) {
  return (
    <AIToolsHub
      tools={getToolsForPage(8)}
      pageNumber={8}
      onNavigate={onNavigate}
      onOpenAssetPage={onOpenAssetPage}
    />
  );
}

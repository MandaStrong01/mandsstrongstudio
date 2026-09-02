import AIToolsHub from '../components/AIToolsHub';
import { getToolsForPage } from '../data/aiTools';

interface PageProps {
  onNavigate: (page: number) => void;
  onOpenAssetPage: (toolName: string, mode: 'upload' | 'create') => void;
}

export default function Page5({ onNavigate, onOpenAssetPage }: PageProps) {
  return (
    <AIToolsHub
      tools={getToolsForPage(5)}
      pageNumber={5}
      onNavigate={onNavigate}
      onOpenAssetPage={onOpenAssetPage}
    />
  );
}

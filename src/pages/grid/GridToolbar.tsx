import { Button } from '@/components/ui/button';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { Tab } from './types';

interface GridToolbarProps {
  tabs: Tab[];
  syncing: boolean;
  scrollToColumn: number;
  onSync: () => void;
  onExport: () => void;
  onScrollToColumn: (col: number) => void;
}

const GridToolbar = ({ tabs, syncing, scrollToColumn, onSync, onExport, onScrollToColumn }: GridToolbarProps) => {
  return (
    <>
      {/* Desktop toolbar */}
      <div className="hidden md:flex flex-col items-start space-y-2 mb-2">
        <div className="flex items-center gap-2 w-full">
          <TabsList className="overflow-x-auto bg-card h-auto flex-wrap">
            {tabs.map(tab => (
              <TabsTrigger key={tab.id} value={tab.id.toString()} className="text-[10px] md:text-xs px-2 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                {tab.name}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex items-center gap-2 ml-auto">
            <Button onClick={onSync} variant="outline" size="sm" disabled={syncing} className="flex-shrink-0">
              <Icon name={syncing ? "Loader2" : "RefreshCw"} size={16} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Обновление...' : 'Обновить'}
            </Button>
            <Button onClick={onExport} variant="outline" size="sm" className="flex-shrink-0">
              <Icon name="Download" size={16} className="mr-2" />
              Экспорт в Excel
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-card rounded-lg p-1">
          {Array.from({ length: 10 }, (_, i) => (
            <button
              key={i}
              onClick={() => onScrollToColumn(i)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                scrollToColumn === i
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile toolbar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border pb-8 pt-2 px-2 space-y-2 z-50">
        <div className="flex items-center gap-2 mb-2">
          <Button onClick={onSync} variant="outline" size="sm" disabled={syncing} className="flex-1">
            <Icon name={syncing ? "Loader2" : "RefreshCw"} size={16} className={`mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Обновление...' : 'Обновить'}
          </Button>
          <Button onClick={onExport} variant="outline" size="sm" className="flex-1">
            <Icon name="Download" size={16} className="mr-2" />
            Экспорт в Excel
          </Button>
        </div>
        <TabsList className="w-full justify-center overflow-x-auto bg-card h-auto flex-wrap">
          {tabs.map(tab => (
            <TabsTrigger key={tab.id} value={tab.id.toString()} className="text-[10px] px-2 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {tab.name}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="flex items-center gap-1 bg-card rounded-lg p-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {Array.from({ length: 10 }, (_, i) => (
            <button
              key={i}
              onClick={() => onScrollToColumn(i)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex-shrink-0 ${
                scrollToColumn === i
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default GridToolbar;

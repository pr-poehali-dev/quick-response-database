import { memo } from 'react';
import Icon from '@/components/ui/icon';
import { Cell } from './types';

interface CellComponentProps {
  cellKey: string;
  cell: Cell | undefined;
  row: number;
  col: number;
  tabId: number;
  activeTab: number;
  onCellClick: (row: number, col: number) => void;
  onCellDoubleClick: (row: number, col: number) => void;
  onHeaderChange: (key: string, header: string) => void;
}

const CellComponent = memo(function CellComponent({ cellKey, cell, row, col, tabId, activeTab, onCellClick, onCellDoubleClick, onHeaderChange }: CellComponentProps) {
  return (
    <div
      className="bg-card hover:bg-accent transition-colors cursor-pointer p-2 min-h-[110px] md:min-h-[105px] group relative flex flex-col"
      onClick={() => onCellClick(row, col)}
      onDoubleClick={() => onCellDoubleClick(row, col)}
    >
      <input
        type="text"
        value={cell?.header || ''}
        onChange={(e) => {
          e.stopPropagation();
          onHeaderChange(cellKey, e.target.value);
        }}
        onClick={(e) => e.stopPropagation()}
        className="text-lg text-foreground bg-transparent border-b border-border/30 focus:border-primary/50 outline-none px-1 py-1 mb-2 placeholder:text-foreground/5 uppercase font-medium"
        placeholder="заголовок..."
      />
      <div className="text-sm text-foreground/60 line-clamp-5 whitespace-pre-wrap break-words flex-1">{cell?.content || ''}</div>
      {cell?.content && <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="Copy" size={12} className="text-muted-foreground" /></div>}
    </div>
  );
});

export default CellComponent;

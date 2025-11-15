import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';
import * as XLSX from 'xlsx';

const API_URLS = {
  tabs: 'https://functions.poehali.dev/86104f38-169c-4ce4-b077-38f1883a61c5',
  cells: 'https://functions.poehali.dev/f2f9a3f0-13c8-4862-8b02-aea4ab6b62d4'
};

const GRID_CONFIG = {
  rows: 25,
  cols: 15,
  desktopWidth: 552
};



interface Cell {
  id?: number;
  tab_id: number;
  row_index: number;
  col_index: number;
  content: string;
  header?: string;
}

interface Tab {
  id: number;
  name: string;
  position: number;
}

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
  onHeaderBlur: (key: string) => Promise<void>;
}

const CellComponent = memo(function CellComponent({ cellKey, cell, row, col, tabId, activeTab, onCellClick, onCellDoubleClick, onHeaderChange, onHeaderBlur }: CellComponentProps) {
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
        onBlur={() => onHeaderBlur(cellKey)}
        onClick={(e) => e.stopPropagation()}
        className="text-lg text-foreground bg-transparent border-b border-border/30 focus:border-primary/50 outline-none px-1 py-1 mb-2 placeholder:text-foreground/5 uppercase font-medium"
        placeholder="заголовок..."
      />
      <div className="text-sm text-foreground/60 line-clamp-5 whitespace-pre-wrap break-words flex-1">{cell?.content || ''}</div>
      {cell?.content && <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="Copy" size={12} className="text-muted-foreground" /></div>}
    </div>
  );
});

const Index = () => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [columnNames, setColumnNames] = useState<Record<string, Record<number, string>>>({});
  const [editingColumn, setEditingColumn] = useState<number | null>(null);
  const [editColumnValue, setEditColumnValue] = useState('');
  const [scrollToColumn, setScrollToColumn] = useState<number>(0);
  const [savingHeaders, setSavingHeaders] = useState<Set<string>>(new Set());

  const getCellKey = useCallback((tabId: number, row: number, col: number) => `${tabId}-${row}-${col}`, []);

  const loadInitialData = useCallback(async () => {
    try {
      const [cellsResponse, columnsResponse] = await Promise.all([
        fetch(API_URLS.cells),
        fetch(API_URLS.cells + '?action=get_columns')
      ]);

      if (cellsResponse.ok && columnsResponse.ok) {
        const cellsData = await cellsResponse.json();
        const columnsData = await columnsResponse.json();

        const cellsByTab: Record<number, Record<string, Cell>> = {};
        
        cellsData.cells.forEach((cell: Cell) => {
          if (!cellsByTab[cell.tab_id]) {
            cellsByTab[cell.tab_id] = {};
          }
          const key = getCellKey(cell.tab_id, cell.row_index, cell.col_index);
          cellsByTab[cell.tab_id][key] = cell;
        });

        for (const [tabId, tabCells] of Object.entries(cellsByTab)) {
          localStorage.setItem(`cells_${tabId}`, JSON.stringify(tabCells));
        }

        if (columnsData.columnNames) {
          setColumnNames(columnsData.columnNames);
          localStorage.setItem('columnNamesByTab', JSON.stringify(columnsData.columnNames));
        }
      }
    } catch (error) {
      const savedColumns = localStorage.getItem('columnNamesByTab');
      if (savedColumns) setColumnNames(JSON.parse(savedColumns));
    }
  }, [getCellKey]);

  useEffect(() => {
    loadTabs();
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab && tabs.length > 0) {
      loadCells(activeTab);
      setScrollToColumn(0);
    }
  }, [activeTab, tabs.length, loadCells]);

  const loadTabs = async () => {
    try {
      const response = await fetch(API_URLS.tabs);
      if (!response.ok) throw new Error();
      const data = await response.json();
      setTabs(data.tabs || []);
      if (data.tabs?.length > 0) {
        setActiveTab(data.tabs[0].id);
        localStorage.setItem('tabs_backup', JSON.stringify(data.tabs));
      }
    } catch {
      const savedTabs = localStorage.getItem('tabs_backup');
      if (savedTabs) {
        const parsedTabs = JSON.parse(savedTabs);
        setTabs(parsedTabs);
        if (parsedTabs.length > 0) setActiveTab(parsedTabs[0].id);
      } else {
        const defaultTabs = [{ id: 1, name: 'УПРАЖНЕНИЯ', position: 1 }, { id: 2, name: 'Картинки', position: 2 }];
        setTabs(defaultTabs);
        setActiveTab(1);
        localStorage.setItem('tabs_backup', JSON.stringify(defaultTabs));
      }
    }
  };

  const loadCells = useCallback(async (tabId: number) => {
    try {
      const cacheKey = `cells_${tabId}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setCells(JSON.parse(cached));
        setLoading(false);
      } else {
        setLoading(true);
      }
      const res = await fetch(`${API_URLS.cells}?tab_id=${tabId}`);
      const data = await res.json();
      const map: Record<string, Cell> = {};
      (data.cells || []).forEach((c: Cell) => {
        map[getCellKey(tabId, c.row_index, c.col_index)] = c;
      });
      setCells(map);
      localStorage.setItem(cacheKey, JSON.stringify(map));
    } catch {
      !localStorage.getItem(`cells_${tabId}`) && toast.error('Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [getCellKey]);

  const handleCellClick = useCallback((row: number, col: number) => {
    const content = cells[getCellKey(activeTab, row, col)]?.content;
    if (content) {
      navigator.clipboard.writeText(content);
      toast.success('Скопировано!');
    }
  }, [activeTab, cells, getCellKey]);

  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    setEditValue(cells[getCellKey(activeTab, row, col)]?.content || '');
    setEditingCell({ row, col });
  }, [activeTab, cells, getCellKey]);

  const handleSaveCell = async () => {
    if (!editingCell) return;
    try {
      const key = getCellKey(activeTab, editingCell.row, editingCell.col);
      const currentCell = cells[key];
      const res = await fetch(API_URLS.cells, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab_id: activeTab, row_index: editingCell.row, col_index: editingCell.col, content: editValue, header: currentCell?.header || '' }),
      });
      if (res.ok) {
        const updated = { ...cells, [key]: { tab_id: activeTab, row_index: editingCell.row, col_index: editingCell.col, content: editValue, header: currentCell?.header || '' } };
        setCells(updated);
        localStorage.setItem(`cells_${activeTab}`, JSON.stringify(updated));
        toast.success('Сохранено!');
      }
    } catch {
      toast.error('Ошибка');
    } finally {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleColumnDoubleClick = useCallback((colIndex: number) => {
    const tabColumns = columnNames[activeTab] || {};
    setEditColumnValue(tabColumns[colIndex] || `УРОК ${colIndex + 1}`);
    setEditingColumn(colIndex);
  }, [activeTab, columnNames]);

  const handleSaveColumnName = useCallback(() => {
    if (editingColumn === null) return;
    const tabColumns = columnNames[activeTab] || {};
    const updatedTabColumns = { ...tabColumns, [editingColumn]: editColumnValue };
    const newColumnNames = { ...columnNames, [activeTab]: updatedTabColumns };
    setColumnNames(newColumnNames);
    localStorage.setItem('columnNamesByTab', JSON.stringify(newColumnNames));
    setEditingColumn(null);
    setEditColumnValue('');
    toast.success('Название колонки сохранено!');
  }, [editingColumn, columnNames, activeTab, editColumnValue]);

  const handleHeaderChange = useCallback((key: string, header: string) => {
    const [tabIdStr, rowStr, colStr] = key.split('-');
    const tabId = parseInt(tabIdStr);
    const row = parseInt(rowStr);
    const col = parseInt(colStr);
    const cell = cells[key];
    const updated = { ...cells, [key]: { ...cell, tab_id: tabId, row_index: row, col_index: col, content: cell?.content || '', header } };
    setCells(updated);
    localStorage.setItem(`cells_${activeTab}`, JSON.stringify(updated));
  }, [cells, activeTab]);

  const handleHeaderBlur = useCallback(async (key: string) => {
    const currentCell = cells[key];
    const newHeader = currentCell?.header || '';
    if (savingHeaders.has(key)) return;
    
    setSavingHeaders(prev => new Set(prev).add(key));
    try {
      await fetch(API_URLS.cells, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tab_id: currentCell?.tab_id, 
          row_index: currentCell?.row_index, 
          col_index: currentCell?.col_index, 
          content: currentCell?.content || '', 
          header: newHeader 
        }),
      });
    } finally {
      setSavingHeaders(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [cells, savingHeaders]);

  const handleExportToExcel = async () => {
    try {
      toast.info('Загрузка данных...');
      
      const response = await fetch(API_URLS.cells);
      const data = await response.json();
      
      const allCells: Record<string, Cell> = {};
      (data.cells || []).forEach((cell: Cell) => {
        const key = getCellKey(cell.tab_id, cell.row_index, cell.col_index);
        allCells[key] = cell;
      });
      
      const workbook = XLSX.utils.book_new();
      
      tabs.forEach(tab => {
        const tabColumns = columnNames[tab.id] || {};
        const sheetData: any[][] = [];
        
        const headerRow = Array.from({ length: GRID_CONFIG.cols }, (_, i) => 
          tabColumns[i] || `УРОК ${i + 1}`
        );
        sheetData.push(headerRow);
        
        for (let row = 0; row < GRID_CONFIG.rows; row++) {
          const rowData = [];
          for (let col = 0; col < GRID_CONFIG.cols; col++) {
            const key = getCellKey(tab.id, row, col);
            const cell = allCells[key];
            const cellText = [cell?.header, cell?.content].filter(Boolean).join('\n');
            rowData.push(cellText || '');
          }
          sheetData.push(rowData);
        }
        
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
        XLSX.utils.book_append_sheet(workbook, worksheet, tab.name.substring(0, 31));
      });
      
      XLSX.writeFile(workbook, 'данные.xlsx');
      toast.success('Excel файл загружен!');
    } catch (error) {
      toast.error('Ошибка экспорта');
    }
  };

  const isMobile = useMemo(() => typeof window !== 'undefined' && window.innerWidth < 768, []);
  const colWidth = useMemo(() => isMobile ? (typeof window !== 'undefined' ? window.innerWidth - 16 : 300) : GRID_CONFIG.desktopWidth, [isMobile]);

  return (
    <div className="min-h-screen bg-background p-2 md:pb-0">
      <div className="max-w-[100vw] mx-auto flex flex-col h-screen md:h-auto">
        <Tabs value={activeTab.toString()} onValueChange={(v) => setActiveTab(Number(v))} className="w-full flex flex-col h-full md:h-auto">
          <div className="hidden md:flex flex-col items-center space-y-2 mb-2">
            <div className="flex items-center gap-2 w-full justify-center">
              <TabsList className="justify-center overflow-x-auto bg-card h-auto flex-wrap">
                {tabs.map(tab => (
                  <TabsTrigger key={tab.id} value={tab.id.toString()} className="text-[10px] md:text-xs px-2 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    {tab.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              <Button onClick={handleExportToExcel} variant="outline" size="sm" className="flex-shrink-0">
                <Icon name="Download" size={16} className="mr-2" />
                Экспорт в Excel
              </Button>
            </div>
            <div className="flex items-center gap-1 bg-card rounded-lg p-1">
              {Array.from({ length: 10 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setScrollToColumn(i)}
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

          {tabs.map(tab => (
            <TabsContent key={tab.id} value={tab.id.toString()} className="mt-0 flex-1 md:flex-none mb-[140px] md:mb-0">
              <div 
                className="border border-border rounded-lg overflow-x-auto overflow-y-auto bg-card h-[calc(100vh-10rem)] md:h-[calc(100vh-10rem)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" 
                ref={(el) => {
                  if (el) {
                    el.scrollLeft = scrollToColumn * colWidth;
                    el.scrollTop = 0;
                  }
                }}
              >
                <div className="min-w-max">
                  <div className="grid gap-[1px] md:gap-[2px] bg-border p-[1px] md:p-[2px]" style={{ gridTemplateColumns: `repeat(${GRID_CONFIG.cols}, ${colWidth}px)`, gridTemplateRows: `auto repeat(${GRID_CONFIG.rows}, minmax(105px, auto))` }}>
                    {Array.from({ length: GRID_CONFIG.cols }, (_, i) => {
                      const tabColumns = columnNames[activeTab] || {};
                      return (
                        <div key={i} className="bg-muted text-muted-foreground text-base md:text-xs font-medium p-3 md:p-2 text-center cursor-pointer hover:bg-muted/80 transition-colors" onDoubleClick={() => handleColumnDoubleClick(i)}>
                          {tabColumns[i] || `УРОК ${i + 1}`}
                        </div>
                      );
                    })}
                    {Array.from({ length: GRID_CONFIG.rows * GRID_CONFIG.cols }, (_, idx) => {
                      const row = Math.floor(idx / GRID_CONFIG.cols);
                      const col = idx % GRID_CONFIG.cols;
                      const key = getCellKey(tab.id, row, col);
                      const cell = cells[key];
                      return (
                        <CellComponent
                          key={key}
                          cellKey={key}
                          cell={cell}
                          row={row}
                          col={col}
                          tabId={tab.id}
                          activeTab={activeTab}
                          onCellClick={handleCellClick}
                          onCellDoubleClick={handleCellDoubleClick}
                          onHeaderChange={handleHeaderChange}
                          onHeaderBlur={handleHeaderBlur}
                        />
                      );
                    })}
                    </div>
                  </div>
                </div>
            </TabsContent>
          ))}

          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border pb-8 pt-2 px-2 space-y-2 z-50">
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
                  onClick={() => setScrollToColumn(i)}
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
        </Tabs>
      </div>

      <Dialog open={editingCell !== null} onOpenChange={(open) => !open && setEditingCell(null)}>
        <DialogContent className="bg-card md:max-w-3xl">
          <DialogHeader><DialogTitle>Редактировать ячейку</DialogTitle></DialogHeader>
          <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="Введите текст..." rows={18} className="resize-none bg-background md:min-h-[500px]" />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setEditingCell(null)}>Отмена</Button>
            <Button onClick={handleSaveCell}>Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editingColumn !== null} onOpenChange={(open) => !open && setEditingColumn(null)}>
        <DialogContent className="bg-card">
          <DialogHeader><DialogTitle>Переименовать колонку</DialogTitle></DialogHeader>
          <input type="text" value={editColumnValue} onChange={(e) => setEditColumnValue(e.target.value)} placeholder="Название колонки..." className="w-full p-2 rounded bg-background border border-border text-foreground" autoFocus />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setEditingColumn(null)}>Отмена</Button>
            <Button onClick={handleSaveColumnName}>Сохранить</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
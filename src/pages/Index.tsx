import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import * as XLSX from 'xlsx';
import { API_URLS, GRID_CONFIG, Cell, Tab } from './grid/types';
import CellComponent from './grid/CellComponent';
import GridToolbar from './grid/GridToolbar';
import { EditCellDialog, EditColumnDialog } from './grid/EditDialogs';

const Index = () => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [columnNames, setColumnNames] = useState<Record<string, Record<number, string>>>({});
  const [editingColumn, setEditingColumn] = useState<number | null>(null);
  const [editColumnValue, setEditColumnValue] = useState('');
  const [scrollToColumn, setScrollToColumn] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);

  const getCellKey = useCallback((tabId: number, row: number, col: number) => `${tabId}-${row}-${col}`, []);

  const loadFromCache = useCallback(() => {
    const savedTabs = localStorage.getItem('tabs');
    const savedColumnNames = localStorage.getItem('columnNames');

    if (savedTabs) {
      const parsedTabs = JSON.parse(savedTabs);
      setTabs(parsedTabs);
      if (parsedTabs.length > 0) {
        setActiveTab(parsedTabs[0].id);
        const savedCells = localStorage.getItem(`cells_${parsedTabs[0].id}`);
        if (savedCells) {
          setCells(JSON.parse(savedCells));
        }
      }
    }

    if (savedColumnNames) {
      setColumnNames(JSON.parse(savedColumnNames));
    }
  }, []);

  const syncWithServer = useCallback(async () => {
    setSyncing(true);
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
        await new Promise(resolve => {
          navigator.serviceWorker.addEventListener('message', function handler(e) {
            if (e.data && e.data.type === 'CACHE_CLEARED') {
              navigator.serviceWorker.removeEventListener('message', handler);
              resolve(null);
            }
          });
          setTimeout(resolve, 1000);
        });
      }

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('cells_') || key === 'tabs' || key === 'columnNames')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      const [tabsResponse, cellsResponse, columnsResponse] = await Promise.all([
        fetch(API_URLS.tabs),
        fetch(API_URLS.cells),
        fetch(API_URLS.cells + '?action=get_columns')
      ]);

      let newTabs: Tab[] = [];
      let newActiveTabId = activeTab;

      if (tabsResponse.ok) {
        const tabsData = await tabsResponse.json();
        if (tabsData.tabs && tabsData.tabs.length > 0) {
          newTabs = tabsData.tabs;
          setTabs(newTabs);
          localStorage.setItem('tabs', JSON.stringify(newTabs));
          newActiveTabId = newTabs[0].id;
          setActiveTab(newActiveTabId);
        }
      }

      if (cellsResponse.ok) {
        const cellsData = await cellsResponse.json();
        const cellsByTab: Record<number, Record<string, Cell>> = {};

        cellsData.cells?.forEach((cell: Cell) => {
          if (!cellsByTab[cell.tab_id]) {
            cellsByTab[cell.tab_id] = {};
          }
          const key = getCellKey(cell.tab_id, cell.row_index, cell.col_index);
          cellsByTab[cell.tab_id][key] = cell;
        });

        for (const [tabId, tabCells] of Object.entries(cellsByTab)) {
          localStorage.setItem(`cells_${tabId}`, JSON.stringify(tabCells));
        }

        if (cellsByTab[newActiveTabId]) {
          setCells(cellsByTab[newActiveTabId]);
        }
      }

      if (columnsResponse.ok) {
        const columnsData = await columnsResponse.json();
        if (columnsData.columnNames) {
          setColumnNames(columnsData.columnNames);
          localStorage.setItem('columnNames', JSON.stringify(columnsData.columnNames));
        }
      }

      toast.success('Данные обновлены! Перезагрузка...');
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      toast.error('Ошибка обновления');
      setSyncing(false);
    }
  }, [getCellKey, activeTab]);

  useEffect(() => {
    loadFromCache();
  }, [loadFromCache]);

  useEffect(() => {
    if (activeTab) {
      const savedCells = localStorage.getItem(`cells_${activeTab}`);
      if (savedCells) {
        setCells(JSON.parse(savedCells));
      } else {
        setCells({});
      }
      setScrollToColumn(0);
    }
  }, [activeTab]);

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

      const updatedCell = {
        tab_id: activeTab,
        row_index: editingCell.row,
        col_index: editingCell.col,
        content: editValue,
        header: currentCell?.header || ''
      };

      const updated = { ...cells, [key]: updatedCell };
      setCells(updated);
      localStorage.setItem(`cells_${activeTab}`, JSON.stringify(updated));

      const res = await fetch(API_URLS.cells, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCell),
      });

      if (res.ok) {
        toast.success('Сохранено!');
      } else {
        toast.error('Ошибка сохранения на сервере');
      }
    } catch {
      toast.error('Ошибка сохранения');
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
    localStorage.setItem('columnNames', JSON.stringify(newColumnNames));
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
    const updated = {
      ...cells,
      [key]: {
        ...cell,
        tab_id: tabId,
        row_index: row,
        col_index: col,
        content: cell?.content || '',
        header
      }
    };
    setCells(updated);
    localStorage.setItem(`cells_${activeTab}`, JSON.stringify(updated));

    fetch(API_URLS.cells, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tab_id: tabId,
        row_index: row,
        col_index: col,
        content: cell?.content || '',
        header
      }),
    }).catch(() => {});
  }, [cells, activeTab]);

  const handleExportToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();

      tabs.forEach(tab => {
        const tabCells = JSON.parse(localStorage.getItem(`cells_${tab.id}`) || '{}');
        const tabColumns = columnNames[tab.id] || {};
        const sheetData: string[][] = [];

        const headerRow = Array.from({ length: GRID_CONFIG.cols }, (_, i) =>
          tabColumns[i] || `УРОК ${i + 1}`
        );
        sheetData.push(headerRow);

        for (let row = 0; row < GRID_CONFIG.rows; row++) {
          const rowData = [];
          for (let col = 0; col < GRID_CONFIG.cols; col++) {
            const key = getCellKey(tab.id, row, col);
            const cell = tabCells[key];
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
      <Button
        onClick={syncWithServer}
        disabled={syncing}
        variant="outline"
        size="icon"
        className="fixed top-4 right-4 z-50 rounded-full shadow-lg"
        title="Синхронизация с сервером"
      >
        <Icon name={syncing ? "RefreshCw" : "CloudUpload"} size={20} className={syncing ? 'animate-spin' : ''} />
      </Button>

      <div className="max-w-[100vw] mx-auto flex flex-col h-screen md:h-auto">
        <Tabs value={activeTab.toString()} onValueChange={(v) => setActiveTab(Number(v))} className="w-full flex flex-col h-full md:h-auto">
          <GridToolbar
            tabs={tabs}
            syncing={syncing}
            scrollToColumn={scrollToColumn}
            onSync={syncWithServer}
            onExport={handleExportToExcel}
            onScrollToColumn={setScrollToColumn}
          />

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
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <EditCellDialog
          open={!!editingCell}
          value={editValue}
          onChange={setEditValue}
          onSave={handleSaveCell}
          onClose={() => { setEditingCell(null); setEditValue(''); }}
        />

        <EditColumnDialog
          open={editingColumn !== null}
          value={editColumnValue}
          onChange={setEditColumnValue}
          onSave={handleSaveColumnName}
          onClose={() => { setEditingColumn(null); setEditColumnValue(''); }}
        />
      </div>
    </div>
  );
};

export default Index;

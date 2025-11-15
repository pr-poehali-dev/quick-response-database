import { useState, useEffect, useCallback, FC, memo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';

const API_URLS = {
  tabs: 'https://functions.poehali.dev/86104f38-169c-4ce4-b077-38f1883a61c5',
  cells: 'https://functions.poehali.dev/f2f9a3f0-13c8-4862-8b02-aea4ab6b62d4',
  images: 'https://functions.poehali.dev/98030051-bc07-464d-98f9-7504adfd39e1'
};

const GRID_CONFIG = {
  rows: 25,
  cols: 15,
  desktopWidth: 552
};

interface LazyImageProps {
  imageId: number;
  fileName: string;
  onImageClick: (url: string) => void;
  onDeleteClick: (e: React.MouseEvent, id: number) => void;
  loadImageData: (id: number) => Promise<string | null>;
}

const LazyImage: FC<LazyImageProps> = memo(({ imageId, fileName, onImageClick, onDeleteClick, loadImageData }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadImageData(imageId).then(url => {
      setImageUrl(url);
      setLoading(false);
    });
  }, [imageId, loadImageData]);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card hover:ring-2 hover:ring-primary transition-all cursor-pointer group" onDoubleClick={() => imageUrl && onImageClick(imageUrl)}>
      <div className="aspect-square relative">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Icon name="Loader2" className="animate-spin" size={24} />
          </div>
        ) : imageUrl ? (
          <>
            <img src={imageUrl} alt={fileName} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Icon name="Copy" size={24} className="text-white" />
            </div>
            <Button size="sm" variant="destructive" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0" onClick={(e) => onDeleteClick(e, imageId)}>
              <Icon name="Trash2" size={16} />
            </Button>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
            <Icon name="ImageOff" size={24} />
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-xs text-muted-foreground truncate">{fileName}</p>
      </div>
    </div>
  );
});

interface Cell {
  id?: number;
  tab_id: number;
  row_index: number;
  col_index: number;
  content: string;
}

interface Tab {
  id: number;
  name: string;
  position: number;
}

interface Image {
  id: number;
  file_name: string;
  file_url: string | null;
  created_at: string;
}

const Index = () => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<Image[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleteImageId, setDeleteImageId] = useState<number | null>(null);
  const [columnNames, setColumnNames] = useState<Record<string, Record<number, string>>>({});
  const [editingColumn, setEditingColumn] = useState<number | null>(null);
  const [editColumnValue, setEditColumnValue] = useState('');
  const [imageCache, setImageCache] = useState<Record<number, string>>({});
  const [scrollToColumn, setScrollToColumn] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);

  const getCellKey = useCallback((tabId: number, row: number, col: number) => `${tabId}-${row}-${col}`, []);

  useEffect(() => {
    loadTabs();
    const savedColumns = localStorage.getItem('columnNamesByTab');
    if (savedColumns) setColumnNames(JSON.parse(savedColumns));
  }, []);

  useEffect(() => {
    if (activeTab && tabs.length > 0) {
      const currentTab = tabs.find(t => t.id === activeTab);
      currentTab?.name === 'Картинки' ? loadImages() : loadCells(activeTab);
      setScrollToColumn(0);
    }
  }, [activeTab, tabs]);



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

  const loadCells = async (tabId: number) => {
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
  };

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
      const res = await fetch(API_URLS.cells, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab_id: activeTab, row_index: editingCell.row, col_index: editingCell.col, content: editValue }),
      });
      if (res.ok) {
        const key = getCellKey(activeTab, editingCell.row, editingCell.col);
        const updated = { ...cells, [key]: { tab_id: activeTab, row_index: editingCell.row, col_index: editingCell.col, content: editValue } };
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

  const handleColumnDoubleClick = (colIndex: number) => {
    const tabColumns = columnNames[activeTab] || {};
    setEditColumnValue(tabColumns[colIndex] || `УРОК ${colIndex + 1}`);
    setEditingColumn(colIndex);
  };

  const handleSaveColumnName = () => {
    if (editingColumn === null) return;
    const tabColumns = columnNames[activeTab] || {};
    const updatedTabColumns = { ...tabColumns, [editingColumn]: editColumnValue };
    const newColumnNames = { ...columnNames, [activeTab]: updatedTabColumns };
    setColumnNames(newColumnNames);
    localStorage.setItem('columnNamesByTab', JSON.stringify(newColumnNames));
    setEditingColumn(null);
    setEditColumnValue('');
    toast.success('Название колонки сохранено!');
  };

  const loadImages = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_URLS.images);
      const data = await response.json();
      setImages(data.images || []);
    } catch {
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  const loadImageData = useCallback(async (imageId: number) => {
    if (imageCache[imageId]) return imageCache[imageId];
    try {
      const response = await fetch(`${API_URLS.images}?id=${imageId}`);
      const data = await response.json();
      if (data.image?.file_url) {
        setImageCache(prev => ({ ...prev, [imageId]: data.image.file_url }));
        return data.image.file_url;
      }
    } catch (error) {
      console.error('Ошибка загрузки изображения:', error);
    }
    return null;
  }, [imageCache]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const response = await fetch(API_URLS.images, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_name: file.name, file_data: event.target?.result })
          });
          if (response.ok) {
            const result = await response.json();
            if (result.image) setImageCache(prev => ({ ...prev, [result.image.id]: result.image.file_url }));
            await loadImages();
            toast.success('Изображение загружено!');
          }
        } catch {
          toast.error('Ошибка загрузки');
        }
      };
      reader.readAsDataURL(file);
    }
    setUploading(false);
    e.target.value = '';
  };

  const handleSyncToServer = async () => {
    setSyncing(true);
    try {
      const allCells: any[] = [];
      
      for (const tab of tabs) {
        if (tab.name === 'Картинки') continue;
        
        const cacheKey = `cells_${tab.id}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const tabCells = JSON.parse(cached);
          Object.values(tabCells).forEach((cell: any) => {
            if (cell.content) {
              allCells.push({
                tab_id: cell.tab_id,
                row_index: cell.row_index,
                col_index: cell.col_index,
                content: cell.content
              });
            }
          });
        }
      }

      const response = await fetch(API_URLS.cells, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_all', cells: allCells, columnNames })
      });

      if (response.ok) {
        toast.success('Все изменения сохранены на сервер!');
      } else {
        const errorText = await response.text();
        console.error('Sync error:', errorText);
        toast.error('Ошибка синхронизации');
      }
    } catch (error) {
      console.error('Sync exception:', error);
      toast.error('Ошибка синхронизации');
    }
    setSyncing(false);
  };

  const handleSyncFromServer = async () => {
    setSyncing(true);
    try {
      const [cellsResponse, columnsResponse] = await Promise.all([
        fetch(API_URLS.cells),
        fetch(API_URLS.cells + '?action=get_columns')
      ]);

      if (cellsResponse.ok && columnsResponse.ok) {
        const cellsData = await cellsResponse.json();
        const columnsData = await columnsResponse.json();

        console.log('Loaded cells:', cellsData.cells?.length);
        console.log('Loaded columns:', columnsData.columnNames);

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
          console.log(`Saved ${Object.keys(tabCells).length} cells for tab ${tabId}`);
        }

        if (columnsData.columnNames) {
          setColumnNames(columnsData.columnNames);
          localStorage.setItem('columnNamesByTab', JSON.stringify(columnsData.columnNames));
        }

        const currentTabCells = cellsByTab[activeTab] || {};
        setCells(currentTabCells);
        console.log(`Set ${Object.keys(currentTabCells).length} cells for current tab ${activeTab}`);

        toast.success(`Данные загружены! Ячеек: ${cellsData.cells?.length || 0}`);
      } else {
        const errorText = await cellsResponse.text();
        console.error('Load error:', errorText);
        toast.error('Ошибка загрузки данных');
      }
    } catch (error) {
      console.error('Load exception:', error);
      toast.error('Ошибка загрузки данных');
    }
    setSyncing(false);
  };

  const handleImageClick = async (imageUrl: string) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      canvas.toBlob(async (blob) => {
        if (blob) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          toast.success('Изображение скопировано!');
        }
      }, 'image/png');
    } catch {
      toast.error('Ошибка копирования');
    }
  };

  const handleImageDeleteConfirm = async () => {
    if (!deleteImageId) return;
    try {
      const response = await fetch(`${API_URLS.images}?id=${deleteImageId}`, { method: 'DELETE' });
      if (response.ok) {
        setImages(prev => prev.filter(img => img.id !== deleteImageId));
        toast.success('Изображение удалено!');
      }
    } catch {
      toast.error('Ошибка удаления');
    } finally {
      setDeleteImageId(null);
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const colWidth = isMobile ? (typeof window !== 'undefined' ? window.innerWidth - 16 : 300) : GRID_CONFIG.desktopWidth;

  return (
    <div className="min-h-screen bg-background p-2 md:pb-0">
      <div className="max-w-[100vw] mx-auto flex flex-col h-screen md:h-auto">
        <Tabs value={activeTab.toString()} onValueChange={(v) => setActiveTab(Number(v))} className="w-full flex flex-col h-full md:h-auto">
          <div className="hidden md:flex flex-col items-center space-y-2 mb-2">
            <TabsList className="justify-center overflow-x-auto bg-card h-auto flex-wrap">
              {tabs.map(tab => (
                <TabsTrigger key={tab.id} value={tab.id.toString()} className="text-[10px] md:text-xs px-2 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  {tab.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.find(t => t.id === activeTab)?.name !== 'Картинки' && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-card rounded-lg p-1 border border-border">
                  <Button
                    onClick={handleSyncToServer}
                    disabled={syncing}
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3"
                    title="Сохранить все изменения на сервер"
                  >
                    <Icon name="CloudUpload" size={16} />
                  </Button>
                  <Button
                    onClick={handleSyncFromServer}
                    disabled={syncing}
                    variant="ghost"
                    size="sm"
                    className="h-8 px-3"
                    title="Загрузить данные с сервера"
                  >
                    <Icon name="CloudDownload" size={16} />
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
            )}
          </div>

          {tabs.map(tab => (
            <TabsContent key={tab.id} value={tab.id.toString()} className="mt-0 flex-1 md:flex-none mb-[140px] md:mb-0">
              {tab.name === 'Картинки' ? (
                <div className="space-y-4">
                  <Button onClick={() => document.getElementById('image-upload')?.click()} disabled={uploading}>
                    <Icon name="Upload" size={16} className="mr-2" />
                    {uploading ? 'Загрузка...' : 'Загрузить'}
                  </Button>
                  <input id="image-upload" type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {images.map(image => (
                      <LazyImage key={image.id} imageId={image.id} fileName={image.file_name} onImageClick={handleImageClick} onDeleteClick={(e, id) => { e.stopPropagation(); setDeleteImageId(id); }} loadImageData={loadImageData} />
                    ))}
                  </div>
                </div>
              ) : (
                <>
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
                          <div key={key} className="bg-card hover:bg-accent transition-colors cursor-pointer p-3 min-h-[110px] md:min-h-[105px] group relative" onClick={() => handleCellClick(row, col)} onDoubleClick={() => handleCellDoubleClick(row, col)}>
                            <div className="text-base text-foreground line-clamp-6 whitespace-pre-wrap break-words">{cell?.content || ''}</div>
                            {cell?.content && <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"><Icon name="Copy" size={12} className="text-muted-foreground" /></div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                </>
              )}
            </TabsContent>
          ))}

          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border pb-8 pt-2 px-2 space-y-2 z-50">
            {tabs.find(t => t.id === activeTab)?.name !== 'Картинки' && (
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
            )}
            <TabsList className="w-full justify-center overflow-x-auto bg-card h-auto">
              {tabs.map(tab => (
                <TabsTrigger key={tab.id} value={tab.id.toString()} className="text-[10px] px-2 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  {tab.name}
                </TabsTrigger>
              ))}
              {tabs.find(t => t.id === activeTab)?.name !== 'Картинки' && (
                <>
                  <Button
                    onClick={handleSyncToServer}
                    disabled={syncing}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 flex-shrink-0"
                    title="Сохранить все изменения на сервер"
                  >
                    <Icon name="CloudUpload" size={16} />
                  </Button>
                  <Button
                    onClick={handleSyncFromServer}
                    disabled={syncing}
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 flex-shrink-0"
                    title="Загрузить данные с сервера"
                  >
                    <Icon name="CloudDownload" size={16} />
                  </Button>
                </>
              )}
            </TabsList>
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

      <AlertDialog open={deleteImageId !== null} onOpenChange={(open) => !open && setDeleteImageId(null)}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить изображение?</AlertDialogTitle>
            <AlertDialogDescription>Это действие нельзя отменить.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteImageId(null)}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleImageDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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